import { useCallback, useSyncExternalStore } from 'react';

type Theme = 'light' | 'dark';

function getCurrentTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function subscribeToTheme(callback: () => void): () => void {
  const observer = new MutationObserver(() => callback());
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}

function toggleTheme() {
  const next: Theme = getCurrentTheme() === 'light' ? 'dark' : 'light';
  document.documentElement.classList.remove('light', 'dark');
  document.documentElement.classList.add(next);
  try {
    localStorage.setItem('cre_theme', next);
  } catch {
    // localStorage no disponible
  }
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribeToTheme, getCurrentTheme);

  const toggle = useCallback(() => {
    toggleTheme();
  }, []);

  return { theme, toggle } as const;
}
