-- Run with psql -XAt and ON_ERROR_STOP. The output contains schema metadata only.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path = pg_catalog;
WITH application_tables AS (
  SELECT c.oid, n.nspname AS namespace, c.relname AS name, c.relrowsecurity, c.relforcerowsecurity
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r', 'p') AND n.nspname IN ('public', 'nexa_migrations')
), objects(kind, namespace, target, name, definition) AS (
  SELECT 'table', t.namespace, t.name, '', jsonb_build_array(t.relrowsecurity, t.relforcerowsecurity)
  FROM application_tables t
  UNION ALL
  SELECT 'column', t.namespace, t.name, a.attname, jsonb_build_array(
    a.attnum, format_type(a.atttypid, a.atttypmod), a.attnotnull, a.attidentity, a.attgenerated,
    CASE WHEN a.attcollation <> 0 THEN a.attcollation::regcollation::text END, pg_get_expr(d.adbin, d.adrelid))
  FROM application_tables t JOIN pg_attribute a ON a.attrelid = t.oid
  LEFT JOIN pg_attrdef d ON d.adrelid = t.oid AND d.adnum = a.attnum
  WHERE a.attnum > 0 AND NOT a.attisdropped
  UNION ALL
  SELECT 'constraint', t.namespace, t.name, c.conname,
    jsonb_build_array(c.contype, c.convalidated, c.conenforced, pg_get_constraintdef(c.oid))
  FROM application_tables t JOIN pg_constraint c ON c.conrelid = t.oid
  UNION ALL
  SELECT 'index', t.namespace, t.name, c.relname,
    jsonb_build_array(i.indisvalid, i.indisready, i.indislive, pg_get_indexdef(i.indexrelid))
  FROM application_tables t JOIN pg_index i ON i.indrelid = t.oid
  JOIN pg_class c ON c.oid = i.indexrelid
  UNION ALL
  SELECT 'trigger', t.namespace, t.name, g.tgname, jsonb_build_array(g.tgenabled, pg_get_triggerdef(g.oid))
  FROM application_tables t JOIN pg_trigger g ON g.tgrelid = t.oid WHERE NOT g.tgisinternal
  UNION ALL
  SELECT 'routine', n.nspname, '', p.oid::regprocedure::text, to_jsonb(pg_get_functiondef(p.oid))
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'nexa_internal' AND p.prokind IN ('f', 'p')
  UNION ALL
  SELECT 'view', n.nspname, '', c.relname,
    jsonb_build_array(pg_get_viewdef(c.oid), ARRAY(SELECT unnest(c.reloptions) ORDER BY 1))
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm')
  UNION ALL
  SELECT 'policy', t.namespace, t.name, p.polname, jsonb_build_array(p.polcmd, p.polpermissive,
    ARRAY(SELECT CASE WHEN r = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(r)::text END
          FROM unnest(p.polroles) r ORDER BY 1), pg_get_expr(p.polqual, p.polrelid),
    pg_get_expr(p.polwithcheck, p.polrelid))
  FROM application_tables t JOIN pg_policy p ON p.polrelid = t.oid
)
SELECT jsonb_build_array(kind, namespace, target, name, definition)::text AS entry
FROM objects ORDER BY kind COLLATE "C", namespace COLLATE "C", target COLLATE "C", name COLLATE "C";
COMMIT;
