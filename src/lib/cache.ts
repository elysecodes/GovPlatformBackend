/**
 * Minimal in-memory TTL cache.
 * Used for static geography lookups and short-lived aggregates so the app
 * stops re-querying MySQL for data that barely changes.
 */
interface Entry {
  value: unknown;
  expires: number;
  created: number;
}

const store = new Map<string, Entry>();
const maxEntries = 500;

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expires < Date.now()) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function cacheSet(key: string, value: unknown, ttlMs: number): void {
  if (store.size >= maxEntries) {
    // Evict the oldest entry monotonically to bound memory.
    let oldestKey: string | null = null;
    let oldestCreated = Infinity;
    for (const [k, entry] of store) {
      if (!oldestKey || entry.created < oldestCreated) {
        oldestKey = k;
        oldestCreated = entry.created;
      }
    }
    if (oldestKey) store.delete(oldestKey);
  }
  store.set(key, { value, expires: Date.now() + ttlMs, created: Date.now() });
}

export function cacheHas(key: string): boolean {
  return cacheGet(key) !== undefined;
}

export function cacheFlushPrefix(prefix: string): void {
  for (const key of Array.from(store.keys())) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function cacheClear(): void {
  store.clear();
}