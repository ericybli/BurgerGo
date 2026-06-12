/**
 * Where the data on screen came from. `getJson` reports 'live' on every
 * network success and 'cache' whenever it serves the offline fallback; the
 * dot renders red for 'cache' (and whenever the device is offline).
 */
type Source = 'live' | 'cache';
type Listener = (s: Source) => void;

let current: Source = 'live';
const listeners = new Set<Listener>();

export function reportDataSource(s: Source): void {
  if (s === current) return;
  current = s;
  for (const l of listeners) l(s);
}

export function getDataSource(): Source {
  return current;
}

export function subscribeDataSource(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
