import { getMyProfile, updateMyProfile } from './account-api.js';
import { CommerceError, commerceMessage, readOwned, resultId, runCommand } from './commerce.js';

export async function loadMyProfile(uid) {
  const { appUsers } = await readOwned(uid, getMyProfile);
  return appUsers[0] ?? null;
}

export async function saveProfile(uid, name, phone) {
  resultId(await runCommand(uid, updateMyProfile, { key: crypto.randomUUID(), name, phone }));
}

const messages = {
  EMAIL_IN_USE: 'Este correo ya tiene una cuenta. Puedes iniciar sesión.',
  INVALID_CREDENTIALS: 'Revisa tu correo y tu contraseña.',
  INVALID_EMAIL: 'Escribe un correo válido.',
  INVALID_NAME: 'Escribe tu nombre.',
  WEAK_PASSWORD: 'Elige una contraseña de al menos doce caracteres y hasta 256 bytes.',
  RATE_LIMIT: 'Espera un momento antes de intentarlo de nuevo.',
  EMAIL_UNAVAILABLE: 'El servicio de correo requiere configuración. Contacta con la administración.',
  EMAIL_DELIVERY_ERROR: 'El servidor de correo no aceptó el envío. Inténtalo más tarde.',
  EMAIL_VERIFIED: 'El correo de esta cuenta ya está verificado.',
  INVALID_TOKEN: 'El enlace caducó o ya se utilizó. Solicita uno nuevo.',
};

export function identityError(error) {
  if (Object.hasOwn(messages, error?.code)) return messages[error.code];
  if (error instanceof CommerceError || error?.code === 'SESSION_CHANGED') return commerceMessage(error);
  return 'No se pudo completar la operación. Vuelve a intentarlo.';
}
