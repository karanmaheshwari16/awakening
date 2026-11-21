import { useEffect, useState } from 'preact/hooks';

/** A tiny shared-state container for UI things (toasts, overlays). */
export function atom<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next: T) {
      value = next;
      listeners.forEach((l) => l());
    },
    use(): T {
      const [, force] = useState(0);
      useEffect(() => {
        const l = () => force((x) => x + 1);
        listeners.add(l);
        return () => void listeners.delete(l);
      }, []);
      return value;
    },
  };
}
