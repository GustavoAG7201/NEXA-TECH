(() => {
  const storageKey = 'nexa-theme';
  const root = document.documentElement;
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const listeners = new Set();

  function readPreference() {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved === 'light' || saved === 'dark' ? saved : null;
    } catch {
      return null;
    }
  }

  let preferred = readPreference();

  function apply() {
    const theme = preferred ?? (system.matches ? 'dark' : 'light');
    if (root.dataset.theme === theme) return;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    for (const listener of listeners) listener();
  }

  apply();
  system.addEventListener('change', apply);
  window.addEventListener('storage', event => {
    if (event.key !== null && event.key !== storageKey) return;
    preferred = readPreference();
    apply();
  });

  window.nexaTheme = {
    getSnapshot: () => root.dataset.theme,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    toggle() {
      preferred = root.dataset.theme === 'dark' ? 'light' : 'dark';
      apply();
      try { localStorage.setItem(storageKey, preferred); } catch { /* Keep the choice for this page. */ }
    },
  };
})();
