/**
 * Holds results for a short time and shares in-flight loads, so many requests for the same thing
 * make one upstream call. Failed loads are dropped so an error is never served from the cache.
 */
export function createTtlCache<T>(options: {
  ttlMs: number;
  maxEntries: number;
  now?: () => number;
}) {
  const now = options.now ?? Date.now;
  const entries = new Map<string, { expiresAt: number; value: Promise<T> }>();

  return {
    get(key: string, load: () => Promise<T>): Promise<T> {
      const hit = entries.get(key);
      if (hit && hit.expiresAt > now()) return hit.value;
      const value = load();
      entries.delete(key);
      entries.set(key, { expiresAt: now() + options.ttlMs, value });
      value.catch(() => {
        if (entries.get(key)?.value === value) entries.delete(key);
      });
      while (entries.size > options.maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
      return value;
    },

    clear(): void {
      entries.clear();
    },
  };
}
