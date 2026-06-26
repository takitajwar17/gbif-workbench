// LRU+TTL cache factory used by the OpenAI assessment cache and the GBIF
// occurrence/cube caches. Each instance is a self-contained LRU with TTL:
//   - `get(key)` returns the cached value if it is still fresh, otherwise
//     `undefined`. A hit also re-inserts the entry at the back of the Map so
//     it becomes the most-recently-used.
//   - `set(key, value)` stores `value` with a fresh TTL. If the entry exists
//     it is deleted first so the new write moves to the back. If the Map
//     grows past `maxEntries`, the oldest entries are evicted until it fits.
//
// The factory preserves the existing semantics of `openai.js` and `gbif.js`
// (delete-then-set on hit/write, evict-oldest over the limit) so neither
// caller needs to know about the underlying Map.

export function createLruTtlCache({ ttlMs, maxEntries }) {
  const store = new Map()

  function evictIfNeeded() {
    while (store.size > maxEntries) {
      const oldest = store.keys().next().value
      if (oldest === undefined) break
      store.delete(oldest)
    }
  }

  return {
    get(key) {
      const entry = store.get(key)
      if (!entry) return undefined
      if (Date.now() - entry.fetchedAt >= ttlMs) {
        store.delete(key)
        return undefined
      }
      // Refresh LRU position: delete-then-set moves the entry to the back of
      // the Map's iteration order, so future evictions drop it last.
      store.delete(key)
      store.set(key, entry)
      return entry.value
    },
    set(key, value) {
      if (store.has(key)) store.delete(key)
      store.set(key, { fetchedAt: Date.now(), value })
      evictIfNeeded()
    },
    clear() {
      store.clear()
    },
    get size() {
      return store.size
    },
  }
}
