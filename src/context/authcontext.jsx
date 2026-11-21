import { useEffect, useState } from 'react';
import { AuthSession } from './auth-session.js';
import { subscribe } from '../lib/session.js';

export function AuthProvider({ children }) {
  const [session, setSession] = useState({ user: null, pending: true, error: null });
  useEffect(() => subscribe(setSession), []);
  return <AuthSession.Provider value={session}>{children}</AuthSession.Provider>;
}
