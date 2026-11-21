import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import nodemailer from 'nodemailer';
import { transaction } from './db.mjs';
import { HttpError } from './errors.mjs';
import { hashPassword, verifyPassword } from './password.mjs';

const sessionAge = 7 * 24 * 60 * 60;
const tokenPattern = /^[a-f0-9]{64}$/;
const digest = value => createHash('sha256').update(value).digest('hex');
const makeToken = () => randomBytes(32).toString('hex');

function emailAddress(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s\p{Cc}@<>(),:;"\\]+@[^\s\p{Cc}@<>(),:;"\\]+\.[^\s\p{Cc}@<>(),:;"\\]+$/u.test(email)) {
    throw new HttpError(400, 'INVALID_EMAIL');
  }
  return email;
}

function newPassword(value) {
  if (typeof value !== 'string' || value.length < 12 || Buffer.byteLength(value) > 256) {
    throw new HttpError(400, 'WEAK_PASSWORD');
  }
  return value;
}

function displayName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name || name.length > 120 || /\p{Cc}/u.test(name)) throw new HttpError(400, 'INVALID_NAME');
  return name;
}

function publicUser(row) {
  return { uid: row.uid, email: row.email, displayName: row.display_name, emailVerified: row.email_verified };
}

export async function bootstrapFirstAdmin(pool, emailInput, passwordInput, nameInput) {
  const email = emailAddress(emailInput);
  const name = displayName(nameInput);
  const stored = await hashPassword(newPassword(passwordInput));
  return transaction(pool, async db => {
    // Serialize grants while checking whether this is the first administrator.
    await db.query('LOCK TABLE public.user_role IN SHARE ROW EXCLUSIVE MODE');
    const existing = await db.query("SELECT 1 FROM public.user_role WHERE role_code = 'ADMIN' LIMIT 1");
    if (existing.rowCount) throw new HttpError(409, 'ADMIN_EXISTS');
    const uid = randomUUID();
    await db.query('INSERT INTO public.app_user (uid, display_name) VALUES ($1, $2)', [uid, name]);
    const result = await db.query(`
      INSERT INTO nexa_auth.identity (uid, email, password_hash, email_verified) VALUES ($1, $2, $3, true)
      ON CONFLICT (email) DO NOTHING RETURNING uid`, [uid, email, stored]);
    if (!result.rowCount) throw new HttpError(409, 'EMAIL_IN_USE');
    await db.query("INSERT INTO public.user_role (user_uid, role_code, granted_by_uid) VALUES ($1, 'ADMIN', $1)", [uid]);
    await db.query(`
      INSERT INTO public.audit_log (actor_uid, action, entity_type, entity_key)
      VALUES ($1, 'BOOTSTRAP_ADMIN', 'APP_USER', $1)`, [uid]);
    return uid;
  });
}

async function createSession(db, uid) {
  const token = makeToken();
  await db.query('INSERT INTO nexa_auth.session (token_hash, uid, expires_at) VALUES ($1, $2, now() + $3 * interval \'1 second\')',
    [digest(token), uid, sessionAge]);
  return token;
}

async function rateLimit(pool, bucket, max, seconds) {
  const { rows: [row] } = await pool.query(`
    INSERT INTO nexa_auth.rate_limit (bucket, hits, expires_at)
    VALUES ($1, 1, now() + $2 * interval '1 second')
    ON CONFLICT (bucket) DO UPDATE
      SET hits = CASE WHEN rate_limit.expires_at <= now() THEN 1 ELSE rate_limit.hits + 1 END,
          expires_at = CASE WHEN rate_limit.expires_at <= now() THEN EXCLUDED.expires_at ELSE rate_limit.expires_at END
      WHERE rate_limit.expires_at <= now() OR rate_limit.hits < $3
    RETURNING hits`, [digest(bucket), seconds, max]);
  if (!row) throw new HttpError(429, 'RATE_LIMIT');
}

export function createAuth(pool, { origin, secure, trustProxy }) {
  const cookieName = secure ? '__Host-nexa_session' : 'nexa_session';
  const cookie = (token, age) => cookieName + '=' + token + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + age +
    (secure ? '; Secure' : '');
  const readToken = req => (req.headers.cookie ?? '').split(';').map(part => part.trim())
    .find(part => part.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
  const address = req => trustProxy && isIP(req.headers['x-nexa-client-ip'])
    ? req.headers['x-nexa-client-ip'] : req.socket.remoteAddress;
  const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
  const smtp = smtpConfigured ? nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_PORT === '465',
    requireTLS: process.env.SMTP_REQUIRE_TLS !== 'false',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000,
  }) : null;

  async function session(req) {
    const token = readToken(req);
    if (!tokenPattern.test(token ?? '')) return null;
    const { rows: [row] } = await pool.query(`
      SELECT a.uid, a.display_name, i.email, i.email_verified,
        ARRAY(SELECT role_code FROM public.user_role WHERE user_uid = a.uid) AS roles
      FROM nexa_auth.session s
      JOIN nexa_auth.identity i ON i.uid = s.uid
      JOIN public.app_user a ON a.uid = i.uid
      WHERE s.token_hash = $1 AND s.expires_at > now() AND a.status = 'ACTIVE'`, [digest(token)]);
    return row ?? null;
  }

  async function invalidatePreviousSession(db, req) {
    const previous = readToken(req);
    if (tokenPattern.test(previous ?? '')) {
      await db.query('DELETE FROM nexa_auth.session WHERE token_hash = $1', [digest(previous)]);
    }
  }

  async function register(req, fields) {
    await rateLimit(pool, 'register-ip:' + address(req), 12, 3600);
    const email = emailAddress(fields.email);
    const name = displayName(fields.name);
    const password = await hashPassword(newPassword(fields.password));
    return transaction(pool, async db => {
      const uid = randomUUID();
      await db.query('INSERT INTO public.app_user (uid, display_name) VALUES ($1, $2)', [uid, name]);
      const identity = await db.query(`
        INSERT INTO nexa_auth.identity (uid, email, password_hash) VALUES ($1, $2, $3)
        ON CONFLICT (email) DO NOTHING RETURNING uid`, [uid, email, password]);
      if (!identity.rowCount) throw new HttpError(409, 'EMAIL_IN_USE');
      await invalidatePreviousSession(db, req);
      return { user: { uid, email, displayName: name, emailVerified: false }, token: await createSession(db, uid) };
    });
  }

  async function login(req, fields) {
    await rateLimit(pool, 'login-ip:' + address(req), 60, 900);
    const email = emailAddress(fields.email);
    await rateLimit(pool, 'login-email:' + email, 8, 900);
    const password = fields.password;
    if (typeof password !== 'string' || Buffer.byteLength(password) > 256) throw new HttpError(401, 'INVALID_CREDENTIALS');
    const { rows: [identity] } = await pool.query('SELECT uid, password_hash FROM nexa_auth.identity WHERE email = $1', [email]);
    if (!await verifyPassword(password, identity?.password_hash) || !identity) throw new HttpError(401, 'INVALID_CREDENTIALS');
    return transaction(pool, async db => {
      const { rows: [row] } = await db.query(`
        SELECT i.uid, i.email, i.email_verified, a.display_name
        FROM nexa_auth.identity i JOIN public.app_user a ON a.uid = i.uid
        WHERE i.uid = $1 AND i.password_hash = $2 AND a.status = 'ACTIVE' FOR UPDATE OF i`, [identity.uid, identity.password_hash]);
      if (!row) throw new HttpError(401, 'INVALID_CREDENTIALS');
      await invalidatePreviousSession(db, req);
      return { user: publicUser(row), token: await createSession(db, row.uid) };
    });
  }

  async function deliverToken(purpose, identity) {
    const token = makeToken();
    await pool.query(`
      INSERT INTO nexa_auth.email_token (token_hash, uid, purpose, expires_at)
      VALUES ($1, $2, $3, now() + interval '30 minutes')`, [digest(token), identity.uid, purpose]);
    const reset = purpose === 'reset';
    const link = new URL(reset ? '/restablecer-clave' : '/verificar-correo', origin);
    link.hash = token;
    try {
      const result = await smtp.sendMail({
        from: process.env.SMTP_FROM, to: { name: '', address: identity.email },
        subject: reset ? 'Restablecer contraseña de NexaTech' : 'Verificar correo de NexaTech',
        text: (reset ? 'Para cambiar tu contraseña, abre este enlace.' : 'Para confirmar tu correo, abre este enlace.') +
          '\n\n' + link.href + '\n\nEl enlace vence en 30 minutos.',
      });
      if (!result.accepted.length) throw new Error('SMTP rejected delivery');
    } catch {
      await pool.query('DELETE FROM nexa_auth.email_token WHERE token_hash = $1', [digest(token)]);
      throw new HttpError(503, 'EMAIL_DELIVERY_ERROR');
    }
  }

  async function useToken(fields, purpose) {
    if (!tokenPattern.test(typeof fields.token === 'string' ? fields.token : '')) throw new HttpError(400, 'INVALID_TOKEN');
    const token = digest(fields.token);
    const { rows: [initial] } = await pool.query(`
      SELECT uid FROM nexa_auth.email_token WHERE token_hash = $1 AND purpose = $2 AND expires_at > now()`, [token, purpose]);
    if (!initial) throw new HttpError(400, 'INVALID_TOKEN');
    const password = purpose === 'reset' ? await hashPassword(newPassword(fields.password)) : null;
    await transaction(pool, async db => {
      await db.query('SELECT uid FROM nexa_auth.identity WHERE uid = $1 FOR UPDATE', [initial.uid]);
      const { rows: [record] } = await db.query(`
        DELETE FROM nexa_auth.email_token WHERE token_hash = $1 AND purpose = $2 AND expires_at > now()
        RETURNING uid`, [token, purpose]);
      if (!record) throw new HttpError(400, 'INVALID_TOKEN');
      if (purpose === 'verify') {
        await db.query('UPDATE nexa_auth.identity SET email_verified = true WHERE uid = $1', [record.uid]);
      } else {
        await db.query('UPDATE nexa_auth.identity SET password_hash = $1 WHERE uid = $2', [password, record.uid]);
        await db.query('DELETE FROM nexa_auth.session WHERE uid = $1', [record.uid]);
      }
      await db.query('DELETE FROM nexa_auth.email_token WHERE uid = $1 AND purpose = $2', [record.uid, purpose]);
    });
  }

  async function action(name, req, fields, res) {
    switch (name) {
      case 'register':
      case 'login': {
        const { user, token } = await (name === 'register' ? register(req, fields) : login(req, fields));
        res.setHeader('Set-Cookie', cookie(token, sessionAge));
        return { user };
      }
      case 'logout':
        await invalidatePreviousSession(pool, req);
        res.setHeader('Set-Cookie', cookie('', 0));
        return { user: null };
      case 'request-reset': {
        if (!smtp) throw new HttpError(503, 'EMAIL_UNAVAILABLE');
        await rateLimit(pool, 'reset-ip:' + address(req), 20, 3600);
        const email = emailAddress(fields.email);
        await rateLimit(pool, 'reset-email:' + email, 3, 3600);
        const { rows: [row] } = await pool.query(`
          SELECT i.uid, i.email FROM nexa_auth.identity i JOIN public.app_user a ON a.uid = i.uid
          WHERE i.email = $1 AND a.status = 'ACTIVE'`, [email]);
        if (row) await deliverToken('reset', row);
        return {};
      }
      case 'request-verification': {
        if (!smtp) throw new HttpError(503, 'EMAIL_UNAVAILABLE');
        const row = await session(req);
        if (!row) throw new HttpError(401, 'SESSION_CHANGED');
        if (req.headers['x-nexa-user'] !== row.uid) throw new HttpError(409, 'SESSION_CHANGED');
        await rateLimit(pool, 'verify-ip:' + address(req), 20, 3600);
        await rateLimit(pool, 'verify-uid:' + row.uid, 3, 3600);
        if (row.email_verified) throw new HttpError(409, 'EMAIL_VERIFIED');
        await deliverToken('verify', row);
        return {};
      }
      case 'reset':
      case 'verify':
        await rateLimit(pool, name + '-ip:' + address(req), 30, 900);
        await useToken(fields, name);
        // Revoke the reset account in SQL. Keep a different account's browser session.
        return {};
      default:
        throw new HttpError(404, 'NOT_FOUND');
    }
  }

  return { session, action, publicUser };
}
