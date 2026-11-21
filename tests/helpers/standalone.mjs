import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { createServer as createVite } from 'vite';
import { Client } from '../../server/db.mjs';
import { until } from './local-browser.mjs';

async function reservePort() {
  const server = createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise(resolve => server.close(resolve));
  return port;
}

export async function startStandalone(prefix, backup, mail = {}) {
  const workRoot = resolve('.nexa/private');
  await mkdir(workRoot, { recursive: true, mode: 0o700 });
  const work = await mkdtemp(resolve(workRoot, prefix + '-'));
  const env = { ...process.env };
  const database = 'nexa_test_' + randomBytes(8).toString('hex');
  for (const key of ['NEXATECH_OWNER_URL', 'DATABASE_URL']) {
    assert.ok(env[key], 'Configura .env con npm run local:setup.');
    const url = new URL(env[key]);
    assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'La suite requiere PostgreSQL local.');
    url.pathname = '/' + database;
    env[key] = url.href;
  }
  const setup = (...args) => execFileSync(process.execPath, ['scripts/database.mjs', ...args],
    { env, stdio: 'inherit', windowsHide: true });
  if (backup) {
    setup('prepare');
    setup('restore', backup);
  } else setup('init', '--seed', '--demo');
  const db = new Client({ connectionString: env.NEXATECH_OWNER_URL });
  await db.connect();
  const apiPort = await reservePort();
  const port = await reservePort();
  const origin = 'http://127.0.0.1:' + port;
  let child, stopped, vite;
  async function startApi() {
    const appEnv = { ...env, ...mail, APP_ORIGIN: origin, API_HOST: '127.0.0.1', API_PORT: String(apiPort),
      TRUST_PROXY: '0', NODE_ENV: 'test' };
    delete appEnv.NEXATECH_OWNER_URL;
    child = spawn(process.execPath, ['server/index.mjs'], { env: appEnv, stdio: 'inherit', windowsHide: true });
    stopped = once(child, 'close');
    await until(async () => (await fetch('http://127.0.0.1:' + apiPort + '/api/health').catch(() => null))?.ok, 'API ready');
  }
  async function stopApi() {
    if (child && child.exitCode === null) child.kill();
    await stopped;
  }
  function close() {
    return Promise.all([stopApi(), vite?.close(), db.end()]);
  }
  try {
    vite = await createVite({ configFile: false, plugins: [react()], logLevel: 'error', server: {
      host: '127.0.0.1', port, strictPort: true, watch: null, proxy: { '/api': 'http://127.0.0.1:' + apiPort },
    } });
    await vite.listen();
    await startApi();
    return { origin, db, work, close, env, startApi, stopApi };
  } catch (error) {
    await close();
    throw error;
  }
}

export async function post(origin, path, payload, actor, options = {}) {
  const headers = { 'Content-Type': 'application/json', Origin: origin, ...options };
  if (actor?.cookie) headers.Cookie = actor.cookie;
  if (actor?.uid) headers['X-Nexa-User'] = actor.uid;
  const response = await fetch(origin + '/api/' + path, { method: 'POST', headers, body: JSON.stringify(payload) });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error), { code: data.error, status: response.status });
  return { data, cookie: response.headers.get('set-cookie') };
}

export async function identity(store, email, password, name, role, verified = true) {
  const { data: { user }, cookie } = await post(store.origin, 'auth/register', { email, password, name });
  if (verified) await store.db.query('UPDATE nexa_auth.identity SET email_verified = true WHERE uid = $1', [user.uid]);
  if (role) await store.db.query('INSERT INTO public.user_role(user_uid, role_code) VALUES ($1, $2)', [user.uid, role]);
  return { uid: user.uid, email, cookie: cookie.split(';')[0], origin: store.origin };
}

export async function operation(name, actor, variables = {}) {
  return (await post(actor.origin, 'operations/' + name, variables, actor)).data;
}
