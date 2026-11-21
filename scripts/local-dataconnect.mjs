import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const demoProject = 'demo-nexatech';
export const sqlConnectHost = '127.0.0.1';
export const sqlConnectPort = 9399;
export const authOrigin = 'http://127.0.0.1:9099';
const postgresPort = 9543;
const database = 'nexatech-58ce3-database';

export async function connectLocalDatabase() {
  const connectHost = process.env.FIREBASE_DATACONNECT_EMULATOR_HOST;
  if (process.env.GCLOUD_PROJECT !== demoProject ||
      connectHost !== sqlConnectHost + ':' + sqlConnectPort ||
      process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099' ||
      process.env.FIREBASE_DATACONNECT_POSTGRESQL_STRING) {
    throw new Error('Start the isolated demo with firebase.local.json and emulators:exec.');
  }

  const response = await fetch('http://' + connectHost + '/emulator/info', { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('The SQL Connect emulator is unavailable.');
  const { services } = await response.json();
  const expectedServer = "host='127.0.0.1' port='" + postgresPort + "'";
  if (!services.some(service => service.serviceId === 'nexatech-store'
    && service.connectionString.includes(expectedServer) && service.connectionString.includes(`dbname='${database}'`))) {
    throw new Error('The SQL Connect emulator must use the isolated local PGlite instance.');
  }

  // Use the PostgreSQL client that the installed Firebase CLI already uses for PGlite.
  const firebaseTools = process.env.NEXATECH_FIREBASE_TOOLS_DIR
    ?? join(execSync('npm root --global', { encoding: 'utf8' }).trim(), 'firebase-tools');
  const { Client } = createRequire(join(firebaseTools, 'package.json'))('pg');
  const client = new Client({
    host: sqlConnectHost, port: postgresPort, database, user: 'postgres', connectionTimeoutMillis: 5000,
  });
  await client.connect();
  return client;
}

async function inTransaction(db, action) {
  await db.query('BEGIN');
  try {
    await action();
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

export async function applyLocalSql(db, { catalog = false } = {}) {
  const migrations = new URL('../dataconnect/migrations/', import.meta.url);
  const names = (await readdir(migrations)).filter(name => /^\d{3}_.+\.sql$/.test(name)).sort();
  await db.query('CREATE SCHEMA IF NOT EXISTS nexa_migrations');
  await db.query('CREATE TABLE IF NOT EXISTS nexa_migrations.applied (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');

  for (const name of names) {
    const statement = await readFile(new URL(name, migrations), 'utf8');
    const checksum = createHash('sha256').update(statement.replaceAll('\r\n', '\n')).digest('hex');
    await inTransaction(db, async () => {
      await db.query('LOCK TABLE nexa_migrations.applied IN EXCLUSIVE MODE');
      const { rows: [previous] } = await db.query('SELECT checksum FROM nexa_migrations.applied WHERE name = $1', [name]);
      if (previous?.checksum === checksum) return;
      if (previous) throw new Error('An applied migration has changed. Use a fresh disposable local database.');
      await db.query(statement);
      await db.query('INSERT INTO nexa_migrations.applied(name, checksum) VALUES ($1, $2)', [name, checksum]);
    });
  }

  const { rows: [status] } = await db.query('SELECT nexa_internal.commerce_schema_ready() AS ready');
  if (!status.ready) throw new Error('Supplemental constraints changed. Restart the disposable emulator before running the seed.');

  const seeds = catalog ? ['demo.sql', 'catalog-e1.sql'] : ['demo.sql'];
  await inTransaction(db, async () => {
    for (const name of seeds) {
      const seed = await readFile(new URL('../dataconnect/seed/' + name, import.meta.url), 'utf8');
      await db.query(seed);
    }
  });
  console.log('Applied ' + names.length + ' supplemental SQL migrations and ' + seeds.join(', ') + '.');
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const databaseClient = await connectLocalDatabase();
  try {
    await applyLocalSql(databaseClient, { catalog: process.argv.includes('--catalog') });
  } finally {
    await databaseClient.end();
  }
}
