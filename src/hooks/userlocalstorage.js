import { useEffect, useState } from 'react';

export function useLocalStorage(key, normalize) {
  const [value, setValue] = useState(() => {
    try {
      return normalize(JSON.parse(localStorage.getItem(key)));
    } catch {
      return normalize(null);
    }
  });

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage can be disabled. */ }
  }, [key, value]);

  return [value, setValue];
}
