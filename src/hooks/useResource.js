import { useEffect, useState } from 'react';

export function useResource(load, enabled = true) {
  const [result, setResult] = useState(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    Promise.resolve().then(load).then(
      data => { if (current) setResult({ load, revision, data }); },
      error => { if (current) setResult({ load, revision, error }); },
    );
    return () => { current = false; };
  }, [load, revision, enabled]);
  const settled = enabled && result?.load === load && result.revision === revision;
  return {
    data: settled ? result.data : undefined,
    error: settled ? result.error : undefined,
    pending: enabled && !settled,
    retry: () => setRevision(value => value + 1),
  };
}
