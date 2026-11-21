import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdir, open, readFile, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';

const mode = process.argv[2] ?? 'start';
const root = new URL('../', import.meta.url);
const local = resolve('.nexa/local');
const data = join(local, 'pgdata');
const windows = process.platform === 'win32';
const envFile = new URL('.env', root);
if (existsSync(envFile)) process.loadEnvFile(envFile);

const port = Number(process.env.NEXATECH_LOCAL_PG_PORT ?? 55432);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Puerto PostgreSQL local inválido.');
const owner = 'nexa_owner';
const database = 'nexatech';
const runtime = 'nexa_runtime';
const binary = name => process.env.NEXATECH_PG_BIN
  ? join(process.env.NEXATECH_PG_BIN, name + (windows ? '.exe' : '')) : name;
const options = { stdio: 'inherit', windowsHide: true };

function started() {
  return spawnSync(binary('pg_ctl'), ['status', '-D', data], { windowsHide: true }).status === 0;
}

async function start() {
  if (!windows) {
    execFileSync(binary('pg_ctl'), ['start', '-w', '-D', data, '-l', join(local, 'postgres.log'),
      '-o', '-h 127.0.0.1 -p ' + port], options);
    return;
  }
  const log = await open(join(local, 'postgres.log'), 'a', 0o600);
  try {
    const child = spawn(binary('postgres'), ['-D', data, '-h', '127.0.0.1', '-p', String(port)], {
      detached: true, windowsHide: true, stdio: ['ignore', log.fd, log.fd],
    });
    await once(child, 'spawn');
    for (let attempt = 0; attempt < 100 && child.exitCode === null; attempt++) {
      if (started() && spawnSync(binary('pg_isready'), ['-q', '-h', '127.0.0.1', '-p', String(port)],
        { windowsHide: true }).status === 0) {
        child.unref();
        return;
      }
      await setTimeout(100);
    }
    throw new Error('PostgreSQL no inició. Consulta .nexa/local/postgres.log.');
  } finally {
    await log.close();
  }
}

if (!['setup', 'start', 'stop'].includes(mode)) throw new Error('Usa setup, start o stop.');
if (mode === 'stop') {
  if (started()) execFileSync(binary('pg_ctl'), ['stop', '-w', '-m', 'fast', '-D', data], options);
} else {
  if (!existsSync(join(data, 'PG_VERSION')) && mode !== 'setup') throw new Error('Ejecuta npm run local:setup primero.');
  const version = execFileSync(binary('postgres'), ['--version'], { windowsHide: true, encoding: 'utf8' }).trim();
  if (!/\(PostgreSQL\) 18\./.test(version)) throw new Error('Se requiere PostgreSQL 18.');
  if (mode === 'setup') {
    await mkdir(local, { recursive: true, mode: 0o700 });
    if (!existsSync(envFile)) {
      const secret = () => randomBytes(32).toString('hex');
      const ownerPassword = secret();
      const runtimePassword = secret();
      const example = await readFile(new URL('.env.example', root), 'utf8');
      const env = example
        .replace(/^NEXATECH_LOCAL_PG_PORT=.*$/m, 'NEXATECH_LOCAL_PG_PORT=' + port)
        .replace(/^NEXATECH_PG_BIN=.*$/m, () => 'NEXATECH_PG_BIN=' + (process.env.NEXATECH_PG_BIN ?? ''))
        .replace(/^DATABASE_URL=.*$/m, 'DATABASE_URL=postgresql://' + runtime + ':' + runtimePassword + '@127.0.0.1:' + port + '/' + database)
        .replace(/^NEXATECH_OWNER_URL=.*$/m, 'NEXATECH_OWNER_URL=postgresql://' + owner + ':' + ownerPassword + '@127.0.0.1:' + port + '/' + database);
      await writeFile(envFile, env, { flag: 'wx', mode: 0o600 });
      process.loadEnvFile(envFile);
    }
    const target = new URL(process.env.NEXATECH_OWNER_URL ?? 'about:blank');
    const application = new URL(process.env.DATABASE_URL ?? 'about:blank');
    const expected = '127.0.0.1:' + port + '/' + database;
    if (target.host + target.pathname !== expected || application.host + application.pathname !== expected ||
        target.username !== owner || !target.password || application.username !== runtime || !application.password) {
      throw new Error('Para configurar el clúster local, .env debe apuntar exclusivamente a la base NexaTech del puerto elegido.');
    }
    if (!existsSync(join(data, 'PG_VERSION'))) {
      const pass = join(local, 'initdb-password');
      await writeFile(pass, decodeURIComponent(target.password) + '\n', { flag: 'wx', mode: 0o600 });
      try {
        execFileSync(binary('initdb'), ['-D', data, '-U', owner, '--encoding=UTF8', '--locale=C',
          '--auth-host=scram-sha-256', '--auth-local=scram-sha-256', '--pwfile=' + pass], options);
      } finally {
        await unlink(pass);
      }
    }
  }
  if (!started()) await start();
  if (mode === 'setup') execFileSync(process.execPath, ['scripts/database.mjs', 'init', '--seed'], options);
}
