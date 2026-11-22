/**
 * Loading a chunk of the app on demand — a panel's code, a section's lessons —
 * so that a deploy that has removed the chunk an open page asks for reloads the
 * page once, onto the new build, instead of breaking it.
 */
const RELOADED = 'motius.reloaded-for-chunk'

export async function loadChunk<T>(load: () => Promise<T>): Promise<T> {
  try {
    const loaded = await load()
    globalThis.sessionStorage?.removeItem(RELOADED)
    return loaded
  } catch (error) {
    if (!globalThis.sessionStorage?.getItem(RELOADED)) {
      globalThis.sessionStorage?.setItem(RELOADED, '1')
      globalThis.location.reload()
    }
    throw error
  }
}
