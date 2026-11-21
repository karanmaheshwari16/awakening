import { useEffect, useState } from 'preact/hooks';

export interface Route {
  name: string;
  params: string[];
  key: string;
}

export function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  return { name: parts[0] ?? 'home', params: parts.slice(1), key: hash || '#/' };
}

export function useRoute(): Route {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const f = () => setHash(location.hash);
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return parse(hash);
}

// How many in-app steps deep we are, so "Back" never leaves the app.
let depth = 0;

export function go(path: string) {
  if (location.hash === path) return;
  depth++;
  location.hash = path;
}

/** Go somewhere without adding a history entry (e.g. lesson → check). */
export function swap(path: string) {
  location.replace(path);
}

export function back(fallback = '#/') {
  if (depth > 0) {
    depth--;
    history.back();
  } else {
    location.replace(fallback);
  }
}

export const href = {
  home: () => '#/',
  region: (id: string) => `#/region/${id}`,
  lesson: (id: string) => `#/lesson/${id}`,
  check: (id: string) => `#/check/${id}`,
  review: (key: string) => `#/review/${key}`,
  penalty: () => '#/penalty',
  shadows: () => '#/shadows',
  gates: () => '#/gates',
  gate: (id: string) => `#/gate/${id}`,
  hunter: () => '#/hunter',
  settings: () => '#/settings',
};
