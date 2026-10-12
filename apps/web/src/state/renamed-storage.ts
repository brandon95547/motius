/**
 * What this browser saved while the app was called Sonara, moved to the names
 * it is read from now.
 *
 * The app became Motius in October 2026 and its storage keys were renamed with
 * it. Left alone, the first load afterwards would open on an empty song
 * library and the default theme, with the songs the player imported still in
 * storage under names nothing reads.
 *
 * Every store reads its key as its module loads, so this has to have run
 * before any of them is imported: `main.tsx` imports it first. A key already
 * written under the new name wins, and the old one is removed either way, so
 * a second run finds nothing to do.
 */
const OLD_KEY = /^sonara(?=[.:])/

/** The built-in synth was renamed with the app, and it is remembered by its id. */
const RENAMED_VALUES: Record<string, Record<string, string>> = {
  'motius:instrument': { 'sonara-studio': 'motius-studio' },
}

export function moveRenamedStorage(storage: Storage | undefined = globalThis.localStorage): void {
  try {
    if (!storage) return
    const old: string[] = []
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (key && OLD_KEY.test(key)) old.push(key)
    }
    for (const key of old) {
      const renamed = key.replace(OLD_KEY, 'motius')
      const value = storage.getItem(key)
      // Removed before it is written again: a song library near the quota
      // would not fit twice, and the two names are the same length.
      storage.removeItem(key)
      if (value === null || storage.getItem(renamed) !== null) continue
      storage.setItem(renamed, RENAMED_VALUES[renamed]?.[value] ?? value)
    }
  } catch {
    // Private browsing, or storage disabled. There is nothing saved to move.
  }
}

moveRenamedStorage()
