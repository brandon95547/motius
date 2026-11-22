/**
 * Content and code fetched the first time it is wanted (a section's lessons, a
 * practice area's builder): each key is loaded once, and every caller waits on
 * that one load. One that failed is tried again next time it is asked for.
 */
export function loadOnce<Key>(load: (key: Key) => Promise<void>): (key: Key) => Promise<void> {
  const loading = new Map<Key, Promise<void>>()
  return (key) => {
    let pending = loading.get(key)
    if (!pending) {
      pending = load(key).catch((error: unknown) => {
        loading.delete(key)
        throw error
      })
      loading.set(key, pending)
    }
    return pending
  }
}
