import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { cp, mkdir, mkdtemp, open, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const mode = process.argv[2] ?? '--phase-d';
if (!['--phase-d', '--phase-e1', '--phase-e2', '--phase-e3', '--store'].includes(mode)) throw new Error('Unknown local PostgreSQL mode: ' + mode);
const windows = process.platform === 'win32';
const pgBin = process.env.NEXATECH_PG_BIN;
if (!pgBin) throw new Error('Set NEXATECH_PG_BIN to the PostgreSQL 18 bin directory.');

const firebaseTools = process.env.NEXATECH_FIREBASE_TOOLS_DIR
  ?? join(execFileSync(process.execPath, [process.env.npm_execpath, 'root', '--global'], { encoding: 'utf8' }).trim(), 'firebase-tools');
const pg = name => join(pgBin, name + (windows ? '.exe' : ''));
for (const name of ['postgres', 'pg_dump', 'pg_restore']) {
  const version = execFileSync(pg(name), ['--version'], { encoding: 'utf8' }).trim();
  if (!/\(PostgreSQL\) 18\./.test(version)) throw new Error('Expected PostgreSQL 18: ' + version);
  console.log(version);
}

// Reserve distinct loopback ports before starting either process.
const reservations = [];
async function reservePort() {
  const server = createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  reservations.push(server);
  return server.address().port;
}

const work = await mkdtemp(join(tmpdir(), 'nexatech-pg18-'));
const data = join(work, 'pgdata');
const owner = 'nexa_' + randomUUID().replaceAll('-', '');
const project = 'demo-nexa-' + owner.slice(-12);
const database = 'fdcdb';
let postgres;
let postgresExit;
const postgresLog = join(work, 'postgres.log');
// Firebase CLI records the child environment in its debug log.
const localKeys = new Set([
  'PATH', 'PATHEXT', 'SYSTEMROOT', 'SYSTEMDRIVE', 'COMSPEC', 'WINDIR',
  'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'HOMEDRIVE', 'HOMEPATH', 'HOME',
  'TEMP', 'TMP', 'TMPDIR', 'LANG', 'LC_ALL', 'TERM', 'NO_COLOR',
  'DATACONNECT_EMULATOR_BINARY_PATH', 'NEXATECH_PG_BIN',
  'NEXATECH_G1_SCHEMA_REFERENCE',
  'NEXATECH_TEST_CHROME', 'NEXATECH_TEST_EDGE', 'NEXATECH_TEST_BROWSER_NO_SANDBOX', 'NEXATECH_E1_SCREENSHOTS_DIR',
]);
const localEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => localKeys.has(key.toUpperCase())));
try {
  const [pgPort, authPort, connectPort, hubPort, loggingPort] = await Promise.all(Array.from({ length: 5 }, reservePort));
  const sources = join(work, 'dataconnect');
  await mkdir(sources);
  const serviceConfig = await readFile(join(root, 'dataconnect', 'dataconnect.yaml'), 'utf8');
  const databaseEntry = /^([ \t]+database:)[^\r\n]+/m;
  if (!databaseEntry.test(serviceConfig)) throw new Error('Missing database in dataconnect.yaml.');
  // Match the emulator's original strict behavior for the disposable schema drift test.
  const localServiceConfig = serviceConfig.replace(databaseEntry, `$1 "${database}"`)
    .replace(/^([ \t]+schemaValidation:)[^\r\n]+/m, '$1 "STRICT"');
  await writeFile(join(sources, 'dataconnect.yaml'), localServiceConfig);
  for (const name of ['schema', 'storefront', 'account', 'staff']) {
    await cp(join(root, 'dataconnect', name), join(sources, name), { recursive: true });
  }
  const config = {
    dataconnect: { source: 'dataconnect' },
    emulators: {
      auth: { host: '127.0.0.1', port: authPort },
      dataconnect: { host: '127.0.0.1', port: connectPort },
      hub: { host: '127.0.0.1', port: hubPort },
      logging: { host: '127.0.0.1', port: loggingPort },
      ui: { enabled: false },
    },
  };
  await writeFile(join(work, 'firebase.local.json'), JSON.stringify(config));
  // This cluster contains only synthetic fixtures and listens exclusively on loopback.
  execFileSync(pg('initdb'), ['-D', data, '-U', owner, '--encoding=UTF8', '--locale=C', '--auth=trust'], { stdio: 'inherit', env: localEnv });
  for (const reservation of reservations) reservation.close();
  const log = await open(postgresLog, 'w');
  try {
    postgres = spawn(pg('postgres'), ['-D', data, '-h', '127.0.0.1', '-p', String(pgPort)], {
      stdio: ['ignore', log.fd, log.fd], env: localEnv, windowsHide: true,
    });
    await once(postgres, 'spawn');
    postgresExit = once(postgres, 'close');
  } finally {
    await log.close();
  }
  const pgEndpoint = ['-h', '127.0.0.1', '-p', String(pgPort), '-U', owner];
  let ready = false;
  for (let attempt = 0; !ready && attempt < 100 && postgres.exitCode === null; attempt++) {
    ready = spawnSync(pg('pg_isready'), [...pgEndpoint, '-d', 'postgres', '-q'], { env: localEnv }).status === 0;
    if (!ready) await setTimeout(100);
  }
  if (!ready) throw new Error('Temporary PostgreSQL failed to start.\n' + await readFile(postgresLog, 'utf8'));
  execFileSync(pg('createdb'), [...pgEndpoint, database], { stdio: 'inherit', env: localEnv });

  const connection = `postgresql://${owner}@127.0.0.1:${pgPort}/${database}?sslmode=disable`;
  const suite = join(root, 'tests', 'dataconnect-' + mode.slice(2) + '.test.mjs');
  const command = mode === '--store' ? `node "${join(root, 'scripts', 'local-store.mjs')}"` :
    `node --test --test-force-exit "${suite}"`;
  const emulators = ['emulators:exec', '--config', 'firebase.local.json', '--project', project, '--only', 'dataconnect,auth',
    command];
  const cli = spawn(process.execPath, [join(firebaseTools, 'lib', 'bin', 'firebase.js'), ...emulators], {
    cwd: work,
    stdio: 'inherit',
    env: {
      ...localEnv,
      XDG_CONFIG_HOME: join(work, 'firebase-cli'),
      FIREBASE_DATACONNECT_POSTGRESQL_STRING: connection,
      NEXATECH_FIREBASE_TOOLS_DIR: firebaseTools,
      NEXATECH_PG18_WORK: work,
      NEXATECH_PG18_PROJECT: project,
      NEXATECH_PG18_AUTH_PORT: String(authPort),
      NEXATECH_PG18_CONNECT_PORT: String(connectPort),
    },
  });
  // The console sends Ctrl+C to the whole Windows process group. Wait for the
  // Firebase CLI to stop its children before closing the database.
  const interrupt = () => { if (!windows && cli.exitCode === null) cli.kill('SIGINT'); };
  process.on('SIGINT', interrupt);
  try {
    const [code, signal] = await once(cli, 'close');
    if (code !== 0 && code !== 130 && signal !== 'SIGINT') process.exitCode = code || 1;
  } finally {
    process.off('SIGINT', interrupt);
  }
} finally {
  for (const reservation of reservations) reservation.close();
  if (postgresExit && postgres.exitCode === null) {
    try {
      execFileSync(pg('pg_ctl'), ['stop', '-w', '-m', 'fast', '-D', data], { stdio: 'inherit', env: localEnv });
      await postgresExit;
    } catch (error) {
      console.error('Could not confirm disposable PostgreSQL shutdown. Logs and data: ' + work);
      throw error;
    }
  }
  await rm(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
