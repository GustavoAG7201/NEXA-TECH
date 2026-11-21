-- Run as the schema auditor with psql -XAtq -v nexa_runtime=<effective connector login>.
-- Every row is a release blocker. Safe results return zero rows.
WITH requested_role AS (
  SELECT * FROM pg_catalog.pg_roles WHERE rolname = :'nexa_runtime'
), public_tables AS (
  SELECT c.oid, c.relname, c.relowner FROM pg_catalog.pg_class c
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p', 'v', 'm')
), allowed_insert(table_name, column_name) AS (
  VALUES ('app_user', 'uid'), ('app_user', 'display_name'), ('commerce_command', 'actor_uid'),
    ('commerce_command', 'idempotency_key'), ('commerce_command', 'kind'), ('commerce_command', 'input')
), failures(issue) AS (
  SELECT 'No se encontró el rol efectivo' WHERE NOT EXISTS (SELECT 1 FROM requested_role)
  UNION ALL
  SELECT 'El rol efectivo tiene privilegios administrativos o de propiedad'
  FROM requested_role r WHERE r.rolsuper OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication
    OR pg_catalog.has_database_privilege(r.oid, current_database(), 'CREATE')
    OR EXISTS (SELECT 1 FROM public_tables t WHERE pg_catalog.pg_has_role(r.oid, t.relowner, 'MEMBER'))
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_namespace n WHERE n.nspname IN ('public', 'nexa_internal', 'nexa_migrations')
      AND pg_catalog.pg_has_role(r.oid, n.nspowner, 'MEMBER'))
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc p WHERE p.pronamespace = 'nexa_internal'::regnamespace
      AND pg_catalog.pg_has_role(r.oid, p.proowner, 'MEMBER'))
  UNION ALL
  SELECT 'Acceso innecesario al esquema ' || n.nspname
  FROM requested_role r CROSS JOIN pg_catalog.pg_namespace n
  WHERE (n.nspname = 'public' AND pg_catalog.has_schema_privilege(r.oid, n.oid, 'CREATE'))
    OR (n.nspname IN ('nexa_internal', 'nexa_migrations') AND pg_catalog.has_schema_privilege(r.oid, n.oid, 'USAGE, CREATE'))
  UNION ALL
  SELECT 'Permiso de escritura fuera de los comandos en ' || t.relname
  FROM requested_role r CROSS JOIN public_tables t
  WHERE pg_catalog.has_table_privilege(r.oid, t.oid, 'DELETE, TRUNCATE, TRIGGER')
    OR pg_catalog.has_any_column_privilege(r.oid, t.oid, 'UPDATE')
  UNION ALL
  SELECT 'INSERT no previsto en ' || t.relname || '.' || a.attname
  FROM requested_role r CROSS JOIN public_tables t JOIN pg_catalog.pg_attribute a ON a.attrelid = t.oid
  WHERE a.attnum > 0 AND NOT a.attisdropped AND pg_catalog.has_column_privilege(r.oid, t.oid, a.attnum, 'INSERT')
    AND NOT EXISTS (SELECT 1 FROM allowed_insert i WHERE i.table_name = t.relname AND i.column_name = a.attname)
  UNION ALL
  SELECT 'Falta INSERT en ' || i.table_name || '.' || i.column_name
  FROM requested_role r CROSS JOIN allowed_insert i JOIN public_tables t ON t.relname = i.table_name
  WHERE NOT pg_catalog.has_column_privilege(r.oid, t.oid, i.column_name, 'INSERT')
  UNION ALL
  SELECT 'Rutina interna ejecutable por el rol efectivo o PUBLIC: ' || p.oid::regprocedure::text
  FROM requested_role r CROSS JOIN pg_catalog.pg_proc p
  WHERE p.pronamespace = 'nexa_internal'::regnamespace AND (pg_catalog.has_function_privilege(r.oid, p.oid, 'EXECUTE')
    OR EXISTS (SELECT 1 FROM pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) acl
      WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'))
)
SELECT issue FROM failures ORDER BY issue COLLATE "C";
