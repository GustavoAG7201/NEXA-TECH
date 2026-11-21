import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const dummyHash = 'scrypt-v1$' + '0'.repeat(32) + '$' + '0'.repeat(128);

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await derive(password, salt, 64, options);
  return 'scrypt-v1$' + salt.toString('hex') + '$' + key.toString('hex');
}

export async function verifyPassword(password, stored = dummyHash) {
  const [, salt, digest] = stored.split('$');
  const key = await derive(password, Buffer.from(salt, 'hex'), 64, options);
  return timingSafeEqual(key, Buffer.from(digest, 'hex'));
}
