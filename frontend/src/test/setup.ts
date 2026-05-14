import '@testing-library/jest-dom';

if (typeof window.localStorage === 'undefined' || typeof window.localStorage.clear !== 'function') {
  const store: Record<string, string> = {};
  window.localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((key) => delete store[key]); },
    length: 0,
    key: () => null,
  };
}
