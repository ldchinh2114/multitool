/**
 * Tiny localStorage cache with a TTL.
 *
 * Used for data that rarely changes (exchange rates, dictionary entries) so a
 * repeat visit is instant and costs no network round trip.
 *
 * Everything is best-effort: a full storage quota, a disabled localStorage or
 * a corrupted entry must never break a tool, so every access is guarded.
 */

const PREFIX = 'kitbag-cache:';

interface Envelope<T> {
  v: T;
  ts: number;
}

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/** Returns the cached value, or null when missing, expired or unreadable. */
export function readCache<T>(key: string, ttlMs: number): T | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const envelope = JSON.parse(raw) as Envelope<T>;
    if (!envelope || typeof envelope.ts !== 'number' || envelope.v === undefined) return null;
    if (Date.now() - envelope.ts >= ttlMs) return null;
    return envelope.v;
  } catch {
    return null;
  }
}

/** Stores a value with the current timestamp. Failures are ignored on purpose. */
export function writeCache<T>(key: string, value: T): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify({ v: value, ts: Date.now() }));
  } catch {
    /* quota exceeded or storage disabled - the app still works without the cache */
  }
}

/** Drops a cached value. */
export function removeCache(key: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}
