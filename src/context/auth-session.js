import { createContext, useContext } from 'react';

export const AuthSession = createContext(null);
export const useAuthSession = () => useContext(AuthSession);
