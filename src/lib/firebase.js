/* global __NEXATECH_USE_EMULATORS__ */
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig as account } from '../dataconnect-generated/account/esm/index.esm.js';
import { connectorConfig as storefront } from '../dataconnect-generated/storefront/esm/index.esm.js';

export const useFirebaseEmulators = __NEXATECH_USE_EMULATORS__;
export const firebaseProjectId = useFirebaseEmulators
  ? import.meta.env.VITE_NEXATECH_PROJECT ?? 'demo-nexatech'
  : 'nexatech-58ce3';

function emulatorPort(value, fallback) {
  const port = Number(value ?? fallback);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('NexaTech requiere puertos locales válidos.');
  }
  return port;
}

if (useFirebaseEmulators && !/^demo-[a-z0-9-]+$/.test(firebaseProjectId)) {
  throw new Error('NexaTech requiere un proyecto demo en desarrollo.');
}

const app = initializeApp(useFirebaseEmulators ? {
  projectId: firebaseProjectId,
  apiKey: 'demo-key',
} : {
  projectId: firebaseProjectId,
  authDomain: 'nexatech-58ce3.firebaseapp.com',
  apiKey: import.meta.env.VITE_NEXATECH_API_KEY,
  appId: import.meta.env.VITE_NEXATECH_APP_ID,
});
export const auth = getAuth(app);
if (useFirebaseEmulators) {
  const port = emulatorPort(import.meta.env.VITE_NEXATECH_AUTH_PORT, 9099);
  connectAuthEmulator(auth, 'http://127.0.0.1:' + port, { disableWarnings: true });
}

export function connectStore(config) {
  const connector = getDataConnect(app, config);
  if (useFirebaseEmulators) {
    const port = emulatorPort(import.meta.env.VITE_NEXATECH_CONNECT_PORT, 9399);
    connectDataConnectEmulator(connector, '127.0.0.1', port);
  }
  return connector;
}

export const accountDb = connectStore(account);
export const storefrontDb = connectStore(storefront);
export const serverOnly = { fetchPolicy: 'SERVER_ONLY' };
