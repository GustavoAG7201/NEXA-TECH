import { execFileSync } from 'node:child_process';
import { createHash, createHmac, pbkdf2Sync, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { chmod, mkdir, readFile, readdir, rename } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '../server/db.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const command = process.argv[2];
const args = process.argv.slice(3);
const maintenanceOrigin = process.env.NEXATECH_OWNER_URL;
const runtimeOrigin = process.env.DATABASE_URL;
const allowName = /^[a-z][a-z0-9_]{0,62}$/;
const lockKey = 1835103337;
const quote = value => '"' + value.replaceAll('"', '""') + '"';
const read = file => readFile(new URL('../' + file, import.meta.url), 'utf8');
const checksum = sql => createHash('sha256').update(sql.replaceAll('\r\n', '\n')).digest('hex');

function connection(value) {
  if (!value) throw new Error('Configura NEXATECH_OWNER_URL y DATABASE_URL.');
  const url = new URL(value);
  const database = decodeURIComponent(url.pathname.slice(1));
  const user = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  if (url.protocol !== 'postgresql:' || !allowName.test(database) || !allowName.test(user) || !url.hostname ||
      !password || ['postgres', 'template0', 'template1'].includes(database)) {
    throw new Error('Se requiere una URL PostgreSQL dedicada a NexaTech.');
  }
  return { url, database, user, password };
}

function pgTool(name, database, args) {
  const executable = process.env.NEXATECH_PG_BIN
    ? join(process.env.NEXATECH_PG_BIN, name + (process.platform === 'win32' ? '.exe' : '')) : name;
  const { url, user, password } = database;
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^PG/i.test(name)));
  Object.assign(env, { PGHOST: url.hostname.replace(/^\[|\]$/g, ''), PGPORT: url.port || '5432', PGUSER: user,
    PGPASSWORD: password, PGDATABASE: database.database, PGSSLMODE: url.searchParams.get('sslmode') ?? 'prefer' });
  execFileSync(executable, args, { env, stdio: 'inherit', windowsHide: true });
}

function verifier(password) {
  // Generate PostgreSQL's SCRAM verifier locally so the SQL contains no plaintext password.
  const salt = randomBytes(16);
  const iterations = 4096;
  const secret = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
  const key = label => createHmac('sha256', secret).update(label).digest();
  const stored = createHash('sha256').update(key('Client Key')).digest('base64');
  return 'SCRAM-SHA-256$' + iterations + ':' + salt.toString('base64') + '$' + stored + ':' + key('Server Key').toString('base64');
}

async function transact(db, action) {
  await db.query('BEGIN');
  try {
    const result = await action();
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

async function using(connectionString, action) {
  const db = new Client({ connectionString, connectionTimeoutMillis: 7000 });
  await db.connect();
  try {
    const { rows: [row] } = await db.query('SHOW server_version_num');
    if (!row.server_version_num.startsWith('18')) throw new Error('NexaTech requiere PostgreSQL 18.');
    return await action(db);
  } finally {
    await db.end();
  }
}

const migrations = (await readdir(new URL('../dataconnect/migrations/', import.meta.url)))
  .filter(name => /^\d{3}_.+\.sql$/.test(name)).sort().map(name => 'dataconnect/migrations/' + name);
const sources = ['database/000_schema.sql', ...migrations, 'database/006_staff_views.sql', 'database/007_auth.sql'];
const seedSources = ['dataconnect/seed/demo.sql', 'dataconnect/seed/catalog-e1.sql'];

async function apply(db, files) {
  for (const file of files) {
    const name = file.split('/').at(-1);
    const sql = await read(file);
    await transact(db, async () => {
      const { rows: [previous] } = await db.query('SELECT checksum FROM nexa_migrations.applied WHERE name = $1', [name]);
      if (previous?.checksum === checksum(sql)) return;
      if (previous) throw new Error('Cambió un SQL aplicado: ' + name);
      await db.query(sql);
      await db.query('INSERT INTO nexa_migrations.applied (name, checksum) VALUES ($1, $2)', [name, checksum(sql)]);
    });
  }
}

async function migrate(db) {
  const { rows: [existing] } = await db.query(`
    SELECT to_regclass('nexa_migrations.applied') IS NULL AND
      EXISTS (SELECT 1 FROM pg_class WHERE relnamespace = 'public'::regnamespace) AS unmanaged`);
  if (existing.unmanaged) throw new Error('La base contiene objetos ajenos al registro de migraciones de NexaTech.');
  await db.query(`
    CREATE SCHEMA IF NOT EXISTS nexa_migrations;
    REVOKE ALL ON SCHEMA nexa_migrations FROM PUBLIC;
    CREATE TABLE IF NOT EXISTS nexa_migrations.applied (
      name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
    )`);
  await apply(db, sources);
  if (args.includes('--seed')) await apply(db, seedSources);
}

const allowedReads = [
  'address', 'app_user', 'audit_log', 'cart', 'cart_item', 'category', 'checkout_quote', 'commerce_command',
  'coupon', 'coupon_redemption', 'customer_order', 'favorite', 'inventory_movement', 'legal_document',
  'notification', 'order_address', 'order_item', 'order_status_event', 'payment', 'product', 'product_image',
  'product_variant', 'refund', 'return_event', 'return_evidence', 'return_item', 'return_request', 'review',
  'shipment', 'shipment_event', 'support_message', 'support_ticket', 'terms_acceptance', 'user_role',
  'staff_audit_event', 'staff_catalog_product', 'staff_catalog_tax', 'staff_catalog_variant', 'staff_category',
  'staff_coupon', 'staff_customer', 'staff_daily_sale', 'staff_inventory', 'staff_operation_total',
  'staff_operator', 'staff_order', 'staff_queue_entry', 'staff_return_case', 'staff_return_summary',
  'staff_sku_sale', 'staff_stock_alert', 'staff_ticket',
];

async function configurePrivileges(db, runtime) {
  const role = quote(runtime.user);
  await transact(db, async () => {
    await db.query(`
      REVOKE ALL ON DATABASE ${quote(runtime.database)} FROM PUBLIC;
      GRANT CONNECT ON DATABASE ${quote(runtime.database)} TO ${role};
      REVOKE CREATE ON SCHEMA public FROM PUBLIC;
      REVOKE ALL ON SCHEMA nexa_auth, nexa_internal, nexa_migrations FROM PUBLIC;
      REVOKE ALL ON ALL FUNCTIONS IN SCHEMA nexa_internal FROM PUBLIC;
      GRANT USAGE ON SCHEMA public, nexa_auth TO ${role};
      GRANT SELECT ON ${allowedReads.map(name => 'public.' + quote(name)).join(', ')} TO ${role};
      GRANT INSERT (uid, display_name) ON public.app_user TO ${role};
      GRANT INSERT (actor_uid, idempotency_key, kind, input) ON public.commerce_command TO ${role};
      GRANT SELECT, INSERT ON nexa_auth.identity TO ${role};
      GRANT UPDATE (password_hash, email_verified) ON nexa_auth.identity TO ${role};
      GRANT SELECT, INSERT, DELETE ON nexa_auth.session, nexa_auth.email_token TO ${role};
      GRANT SELECT, INSERT, UPDATE, DELETE ON nexa_auth.rate_limit TO ${role}`);
  });
}

async function initialize(owner, runtime) {
  const url = new URL(owner.url);
  url.pathname = '/postgres';
  await using(url.href, async db => {
    await db.query('SELECT pg_advisory_lock($1)', [lockKey]);
    const current = await db.query('SELECT 1 FROM pg_database WHERE datname = $1', [owner.database]);
    const role = await db.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [runtime.user]);
    if (!current.rowCount) await db.query('CREATE DATABASE ' + quote(owner.database) + ' TEMPLATE template0 ENCODING \'UTF8\'');
    if (!role.rowCount) await db.query(`CREATE ROLE ${quote(runtime.user)}
      LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${verifier(runtime.password)}'`);
  });
}

async function verify(db, runtime, demo) {
  const { rows: [row] } = await db.query(await read('database/verify.sql'));
  const ledger = await db.query('SELECT name, checksum FROM nexa_migrations.applied');
  const previous = new Map(ledger.rows.map(item => [item.name, item.checksum]));
  for (const file of sources) {
    if (previous.get(file.split('/').at(-1)) !== checksum(await read(file))) {
      throw new Error('Falta una migración o cambió su huella: ' + file);
    }
  }
  if (!row.protections_ready || row.commerce_tables !== '40' || row.staff_views !== '18' ||
      [row.inventory_differences, row.invalid_constraints, row.invalid_indexes, row.disabled_triggers].some(value => value !== '0') ||
      (demo && (row.products !== '153' || row.categories !== '6' || Number(row.variants) < 153 || Number(row.units) <= 0))) {
    throw new Error('Verificación PostgreSQL fallida: ' + JSON.stringify(row));
  }
  const audit = (await read('scripts/runtime-audit.sql')).replace(":'nexa_runtime'", '$1');
  const failures = await db.query(audit, [runtime.user]);
  if (failures.rowCount) throw new Error(failures.rows.map(failure => failure.issue).join('\n'));
  await using(runtime.url.href, async connection => {
    await connection.query('SELECT email_verified FROM nexa_auth.identity LIMIT 1');
    await connection.query('SELECT id FROM public.product LIMIT 1');
  });
  console.log(JSON.stringify(row));
}

const seedTables = [
  'category', 'coupon', 'delivery_method', 'delivery_rate', 'delivery_zone', 'inventory_movement', 'legal_document',
  'product', 'product_image', 'product_variant', 'role', 'tax_class',
];

function privateBackup(path) {
  if (!path || !path.endsWith('.backup')) throw new Error('Indica un archivo privado con extensión .backup.');
  const output = resolve(path);
  const inRepo = relative(root, output);
  const privateFolder = join('.nexa', 'private') + (process.platform === 'win32' ? '\\' : '/');
  if (!inRepo.startsWith('..') && !isAbsolute(inRepo) && !inRepo.startsWith(privateFolder)) {
    throw new Error('Guarda el respaldo en .nexa/private/ o fuera del repositorio.');
  }
  return output;
}

async function createBackup(owner, path) {
  const output = privateBackup(path);
  if (existsSync(output) || existsSync(output + '.partial')) throw new Error('Elige un nombre de respaldo sin usar.');
  await mkdir(dirname(output), { recursive: true, mode: 0o700 });
  // Build a clean template database with only seed data. The live database is untouched.
  const template = await using(owner.url.href, async db => {
    const name = 'nexa_seed_' + randomBytes(8).toString('hex');
    await db.query('CREATE DATABASE ' + quote(name) + ' TEMPLATE template0 ENCODING \'UTF8\'');
    await db.query('REVOKE ALL ON DATABASE ' + quote(name) + ' FROM PUBLIC');
    const url = new URL(owner.url);
    url.pathname = '/' + name;
    return { url, database: name, user: owner.user, password: owner.password };
  });
  await using(template.url.href, async db => {
    await migrate(db);
    if (!args.includes('--seed')) await apply(db, seedSources);
    const { rows: [report] } = await db.query(await read('database/verify.sql'));
    if (report.products !== '153' || report.inventory_differences !== '0' || !report.protections_ready) {
      throw new Error('Respaldo suspendido por error en las semillas.');
    }
    const { rows } = await db.query(`
      SELECT n.nspname AS schema, c.relname AS name FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname IN ('public', 'nexa_auth', 'nexa_migrations') AND c.relkind IN ('r','p')`);
    const excluded = rows.filter(({ schema, name }) => schema !== 'nexa_migrations' &&
      !(schema === 'public' && seedTables.includes(name)));
    pgTool('pg_dump', template, ['-Fc', '--no-owner', '--no-privileges',
      ...excluded.map(({ schema, name }) => '--exclude-table-data=' + schema + '.' + name),
      '--file', output + '.partial']);
  });
  if (process.platform !== 'win32') await chmod(output + '.partial', 0o600);
  await rename(output + '.partial', output);
  console.log(output);
}

async function restore(db, owner, path) {
  const file = resolve(path ?? '');
  if (!file.endsWith('.backup') || !existsSync(file)) throw new Error('Indica un respaldo .backup existente.');
  const { rows: [row] } = await db.query(`
    SELECT EXISTS (SELECT 1 FROM pg_class WHERE relnamespace = 'public'::regnamespace)
      OR to_regnamespace('nexa_auth') IS NOT NULL OR to_regnamespace('nexa_migrations') IS NOT NULL AS occupied`);
  if (row.occupied) throw new Error('La restauración requiere una base NexaTech vacía.');
  await db.query('REVOKE ALL ON DATABASE ' + quote(owner.database) + ' FROM PUBLIC');
  pgTool('pg_restore', owner, ['--dbname', owner.database, '--single-transaction', '--exit-on-error', '--no-owner',
    '--no-privileges', file]);
}

try {
  const owner = connection(maintenanceOrigin);
  const runtime = connection(runtimeOrigin);
  if (owner.database !== runtime.database || owner.url.host !== runtime.url.host || owner.user === runtime.user ||
      runtime.user === 'postgres' || !/^[!-~]{24,}$/.test(runtime.password)) {
    throw new Error('Usa la misma base en ambas URLs y un rol API separado con contraseña aleatoria de al menos 24 caracteres ASCII.');
  }
  if (['init', 'prepare'].includes(command)) await initialize(owner, runtime);
  if (command === 'prepare') {
    console.log('Base preparada para migrar o restaurar.');
  } else if (command === 'backup') {
    await createBackup(owner, args[0]);
  } else {
    await using(owner.url.href, async db => {
      await db.query('SELECT pg_advisory_lock($1)', [lockKey]);
      if (['init', 'migrate'].includes(command)) await migrate(db);
      else if (command === 'restore') await restore(db, owner, args[0]);
      else if (command !== 'verify') throw new Error('Usa init, prepare, migrate, verify, backup o restore.');
      if (command !== 'verify') await configurePrivileges(db, runtime);
      await verify(db, runtime, args.includes('--demo') || command === 'restore');
    });
  }
} catch (error) {
  console.error(error.code ? 'PostgreSQL rechazó la operación (' + error.code + ').' : error.message);
  process.exitCode = 1;
}
