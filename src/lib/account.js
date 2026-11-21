import { ensureProfile, getMyCommandResult, getMyProfile, updateMyProfile } from '../dataconnect-generated/account/esm/index.esm.js';
import { accountDb, auth, serverOnly } from './firebase.js';

export async function loadMyProfile(uid) {
  if (auth.currentUser?.uid !== uid) return null;
  const { data } = await getMyProfile(accountDb, serverOnly);
  return data.appUsers.find(profile => profile.uid === uid) ?? null;
}

export async function ensureCustomerProfile(uid, displayName) {
  if (auth.currentUser?.uid !== uid) throw new Error('La sesión cambió.');
  if (await loadMyProfile(uid)) return;
  if (auth.currentUser?.uid !== uid) throw new Error('La sesión cambió.');
  try {
    await ensureProfile(accountDb, { displayName });
  } catch (error) {
    // Another tab can create this profile between the read and the insert.
    if (!await loadMyProfile(uid)) throw error;
  }
}

export async function saveProfile(uid, name, phone) {
  if (auth.currentUser?.uid !== uid) throw new Error('La sesión cambió.');
  const key = crypto.randomUUID();
  await updateMyProfile(accountDb, { key, name, phone });
  const { data } = await getMyCommandResult(accountDb, { key }, serverOnly);
  const result = data.commerceCommands[0];
  if (result?.status !== 'SUCCEEDED' || result?.resultCode !== 'OK') {
    throw new Error('PostgreSQL no pudo guardar el perfil.');
  }
}

export function identityError(error) {
  const messages = {
    'auth/email-already-in-use': 'Este correo ya tiene una cuenta. Puedes iniciar sesión.',
    'auth/invalid-credential': 'Revisa tu correo y tu contraseña.',
    'auth/wrong-password': 'Revisa tu correo y tu contraseña.',
    'auth/user-not-found': 'Revisa tu correo y tu contraseña.',
    'auth/invalid-email': 'Escribe un correo válido.',
    'auth/weak-password': 'Elige una contraseña de al menos ocho caracteres.',
    'auth/too-many-requests': 'Espera un momento antes de intentarlo de nuevo.',
    'auth/network-request-failed': 'No se pudo conectar con Firebase Authentication. Revisa tu conexión y vuelve a intentarlo.',
  };
  return messages[error.code] ?? 'No se pudo completar la operación. Vuelve a intentarlo.';
}
