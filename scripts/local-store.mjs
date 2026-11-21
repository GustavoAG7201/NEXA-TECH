import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { applyLocalSql } from './local-dataconnect.mjs';

const env = process.env;
const root = fileURLToPath(new URL('../', import.meta.url));
export const localProject = env.NEXATECH_PG18_PROJECT;
export const localWork = env.NEXATECH_PG18_WORK;
export const authPort = Number(env.NEXATECH_PG18_AUTH_PORT);
export const connectPort = Number(env.NEXATECH_PG18_CONNECT_PORT);

export async function connectStoreDatabase() {
  const connection = new URL(env.FIREBASE_DATACONNECT_POSTGRESQL_STRING ?? 'about:blank');
  if (!localWork || !/^demo-nexa-[a-f0-9]{12}$/.test(localProject ?? '') ||
      env.GCLOUD_PROJECT !== localProject ||
      env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:' + authPort ||
      env.FIREBASE_DATACONNECT_EMULATOR_HOST !== '127.0.0.1:' + connectPort ||
      connection.protocol !== 'postgresql:' || connection.hostname !== '127.0.0.1' ||
      connection.pathname !== '/fdcdb' || !/^nexa_[a-f0-9]{32}$/.test(connection.username)) {
    throw new Error('Launch the store using the isolated PostgreSQL 18 runner.');
  }
  const { Client } = createRequire(join(env.NEXATECH_FIREBASE_TOOLS_DIR, 'package.json'))('pg');
  const db = new Client({ connectionString: connection.href, connectionTimeoutMillis: 5000 });
  await db.connect();
  try {
    const { rows: [server] } = await db.query("SELECT current_setting('server_version_num') AS version, current_setting('data_directory') AS data");
    if (Math.floor(Number(server.version) / 10000) !== 18 ||
        server.data.replaceAll('\\', '/') !== join(localWork, 'pgdata').replaceAll('\\', '/')) {
      throw new Error('PostgreSQL must be the temporary cluster created by the local runner.');
    }
    return db;
  } catch (error) {
    await db.end();
    throw error;
  }
}

export async function startStorefront(port) {
  env.VITE_NEXATECH_PROJECT = localProject;
  env.VITE_NEXATECH_AUTH_PORT = String(authPort);
  env.VITE_NEXATECH_CONNECT_PORT = String(connectPort);
  const vite = await createServer({ root, server: { host: '127.0.0.1', port } });
  await vite.listen();
  return vite;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const db = await connectStoreDatabase();
  try {
    await applyLocalSql(db, { catalog: true });
  } finally {
    await db.end();
  }
  const vite = await startStorefront(5173);
  vite.printUrls();
  vite.bindCLIShortcuts({ print: true });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => vite.close().then(() => process.exit(0)));
  }
}
