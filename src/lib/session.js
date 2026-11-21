import { request } from './api.js';

let session = { user: null, pending: true, error: null };
let version = 0;
const observers = new Set();
const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('nexatech-session');

function update(user, error = null) {
  session = { user, pending: false, error };
  for (const observer of observers) observer(session);
}

export const activeUid = () => session.user?.uid;

export async function refreshSession() {
  const requestVersion = ++version;
  try {
    const { user } = await request('auth/session');
    if (requestVersion === version) update(user);
    return user;
  } catch (error) {
    if (requestVersion === version) update(null, error);
    return null;
  }
}

channel?.addEventListener('message', refreshSession);

export function subscribe(observer) {
  observers.add(observer);
  observer(session);
  if (session.pending) void refreshSession();
  return () => observers.delete(observer);
}

async function changeSession(path, payload) {
  const { user } = await request(path, payload);
  version++;
  update(user);
  channel?.postMessage('changed');
}

export const register = (email, password, name) => changeSession('auth/register', { email, password, name });
export const login = (email, password) => changeSession('auth/login', { email, password });
export const logout = () => changeSession('auth/logout', {});
export const requestReset = email => request('auth/request-reset', { email });
export const requestVerification = uid => request('auth/request-verification', {}, uid);

export async function confirmEmailAction(action, token, password) {
  await request('auth/' + action, { token, password });
  await refreshSession();
  channel?.postMessage('changed');
}
