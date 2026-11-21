import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { AuthSession } from './auth-session.js';
import { auth } from '../lib/firebase.js';

export function AuthProvider({ children }) {
  const [session, setSession] = useState({ user: null, pending: true, error: null });
  useEffect(() => onAuthStateChanged(auth,
    user => setSession({ user, pending: false, error: null }),
    error => setSession({ user: null, pending: false, error }),
  ), []);
  return <AuthSession.Provider value={session}>{children}</AuthSession.Provider>;
}
