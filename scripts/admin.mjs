import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { bootstrapFirstAdmin } from '../server/auth.mjs';
import { createPool } from '../server/db.mjs';

const email = process.argv[2];
const name = process.argv[3] ?? 'Administración';
if (!email || !process.stdin.isTTY || !process.env.NEXATECH_OWNER_URL) {
  throw new Error('Usa la consola interactiva con NEXATECH_OWNER_URL y el correo controlado por el primer administrador.');
}
const muted = new Writable({ write(_chunk, _encoding, next) { next(); } });
const input = createInterface({ input: process.stdin, output: muted, terminal: true, historySize: 0 });
const pool = createPool(process.env.NEXATECH_OWNER_URL);
try {
  process.stdout.write('Contraseña del primer administrador (mínimo 12 caracteres): ');
  const password = await input.question('');
  process.stdout.write('\nRepite la contraseña: ');
  const confirmation = await input.question('');
  process.stdout.write('\n');
  if (password !== confirmation) throw new Error('Las contraseñas deben coincidir.');
  await bootstrapFirstAdmin(pool, email, password, name);
  console.log('Primer administrador creado.');
} catch (error) {
  const messages = {
    ADMIN_EXISTS: 'Ya existe un administrador.',
    EMAIL_IN_USE: 'Usa una dirección nueva y controlada por el administrador.',
    WEAK_PASSWORD: 'Usa de 12 caracteres a 256 bytes.',
    INVALID_EMAIL: 'Correo inválido.',
    INVALID_NAME: 'Nombre inválido.',
  };
  console.error(messages[error.code] ?? (error.code ? 'Error PostgreSQL (' + error.code + ').' : error.message));
  process.exitCode = 1;
} finally {
  input.close();
  await pool.end();
}
