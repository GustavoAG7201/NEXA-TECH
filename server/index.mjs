import { createServer } from 'node:http';
import { createAuth } from './auth.mjs';
import { createPool } from './db.mjs';
import { HttpError } from './errors.mjs';
import { getLegalContact } from './legal-contact.mjs';
import { executeOperation, findOperation } from './operations.mjs';

const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
const origin = new URL(process.env.APP_ORIGIN ?? 'http://127.0.0.1:5173');
const secure = origin.protocol === 'https:';
if (origin.href !== origin.origin + '/' || origin.username || origin.password ||
    (!secure && (origin.protocol !== 'http:' || !localHosts.has(origin.hostname))) ||
    (process.env.NODE_ENV === 'production' && !secure)) {
  throw new Error('APP_ORIGIN debe ser un origen HTTPS en producción o HTTP sobre loopback para desarrollo.');
}
const pool = createPool(process.env.DATABASE_URL);
const auth = createAuth(pool, { origin, secure, trustProxy: process.env.TRUST_PROXY === '1' });
const port = Number(process.env.API_PORT ?? 8787);
const host = process.env.API_HOST ?? '127.0.0.1';
const maxBody = 3 * 1024 * 1024;
const legalContact = getLegalContact();

function send(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  const contentType = req.headers['content-type']?.split(';')[0];
  if (contentType !== 'application/json') throw new HttpError(415, 'JSON_REQUIRED');
  if (Number(req.headers['content-length']) > maxBody) throw new HttpError(413, 'BODY_TOO_LARGE');
  const chunks = [];
  let bytes = 0;
  // Keep the connection available for the 413 response when a chunked body exceeds the limit.
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    bytes += chunk.length;
    if (bytes > maxBody) throw new HttpError(413, 'BODY_TOO_LARGE');
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  } catch {
    throw new HttpError(400, 'INVALID_DATA');
  }
  throw new HttpError(400, 'INVALID_DATA');
}

function authorize(req, operation, identity) {
  if (operation.access === 'public') return;
  if (!identity) throw new HttpError(401, 'SESSION_CHANGED');
  if (req.headers['x-nexa-user'] !== identity.uid) throw new HttpError(409, 'SESSION_CHANGED');
  if (operation.access === 'customer') return;
  const permitted = identity.roles.includes('ADMIN') ||
    (operation.access === 'staff' && identity.roles.includes('SUPPORT'));
  if (!permitted || !identity.email_verified) throw new HttpError(403, 'FORBIDDEN');
}

const server = createServer({ requestTimeout: 30000, headersTimeout: 10000 }, async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/api/health') {
      try {
        await pool.query('SELECT 1 FROM public.product, nexa_auth.identity LIMIT 0');
        return send(res, 200, { status: 'ok' });
      } catch {
        return send(res, 503, { status: 'unavailable' });
      }
    }
    if (req.method === 'GET' && req.url === '/api/auth/session') {
      const identity = await auth.session(req);
      return send(res, 200, { user: identity ? auth.publicUser(identity) : null });
    }
    if (req.method === 'GET' && req.url === '/api/legal-contact') return send(res, 200, legalContact);
    const route = /^\/api\/(auth|operations)\/([a-zA-Z-]+)$/.exec(req.url);
    if (!route || req.method !== 'POST') throw new HttpError(404, 'NOT_FOUND');
    if (req.headers.origin !== origin.origin) throw new HttpError(403, 'CSRF');
    const [, group, name] = route;
    const fields = await readBody(req);
    if (group === 'auth') return send(res, 200, await auth.action(name, req, fields, res));
    const operation = findOperation(name);
    const identity = operation.access === 'public' ? null : await auth.session(req);
    authorize(req, operation, identity);
    return send(res, 200, await executeOperation(pool, operation, fields, identity));
  } catch (error) {
    if (error instanceof HttpError) {
      if (error.status === 413) {
        res.setHeader('Connection', 'close');
        req.resume();
      }
      return send(res, error.status, { error: error.code });
    }
    if (/^22[0-9]{3}$/.test(error.code ?? '')) return send(res, 400, { error: 'INVALID_DATA' });
    console.error('Error interno al procesar solicitud.', /^[A-Z0-9_]+$/.test(error.code ?? '') ? error.code : 'INTERNAL');
    return send(res, 500, { error: 'SERVER_ERROR' });
  }
});

server.listen(port, host, () => console.log('API NexaTech en puerto ' + server.address().port));
const expiry = setInterval(async () => {
  try {
    await pool.query(`
      DELETE FROM nexa_auth.session WHERE expires_at <= now();
      DELETE FROM nexa_auth.email_token WHERE expires_at <= now();
      DELETE FROM nexa_auth.rate_limit WHERE expires_at <= now()`);
  } catch {
    console.error('No se pudo limpiar el estado de autenticación vencido.');
  }
}, 15 * 60 * 1000);
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  clearInterval(expiry);
  server.close(() => void pool.end());
});
