import type { Song } from '@sonara/shared'
import { SONG_CATALOG, catalogSongId, type CatalogSong } from './catalog'

/**
 * Finding a song by typing some of its name.
 *
 * What the bar's search field asks: every song there is to open — the ones
 * that come with the app and the player's own — that has what was typed in
 * its title, in who wrote it, or in which score of it this is. No drawing in
 * it, so that what is found and in what order can be said in a test.
 */

/** Lower case and without accents, so "fur elise" finds "Für Elise". */
export const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** A song found, as a row of the list says it. */
export interface SongMatch {
  /** The id it has once it is open: `catalog:` and its name for a built-in song, its own for the player's. */
  readonly id: string
  readonly title: string
  /** Who wrote it and which score of it, or that it is one the player brought. */
  readonly detail: string
  /** The catalog's entry for a built-in song, which is what fetches it. */
  readonly entry?: CatalogSong
}

/** As many as a glance takes in. Past that the list is not shorter than the chooser, and the chooser is better at it. */
export const MATCH_LIMIT = 8

/**
 * The songs that match, best first, and how many more there were.
 *
 * A title that begins with what was typed, then a title that has it
 * anywhere, then a song found by its composer or its edition: "bach" should
 * not put Bach's pieces behind a piece called "G Minor Bach", but someone who
 * types "moon" wants the Moonlight before anything else. Within each, the
 * player's own first, and then the catalog's order.
 */
export function findSongs(
  query: string,
  library: readonly Song[],
  limit = MATCH_LIMIT,
): { matches: SongMatch[]; more: number } {
  const sought = fold(query.trim())
  if (!sought) return { matches: [], more: 0 }

  const begins: SongMatch[] = []
  const within: SongMatch[] = []
  const elsewhere: SongMatch[] = []
  const file = (match: SongMatch, title: string, rest: string) => {
    if (title.startsWith(sought)) begins.push(match)
    else if (title.includes(sought)) within.push(match)
    else if (rest.includes(sought)) elsewhere.push(match)
  }

  for (const song of library)
    file({ id: song.id, title: song.title, detail: 'Your song' }, fold(song.title), '')
  for (const entry of SONG_CATALOG)
    file(
      {
        id: catalogSongId(entry),
        title: entry.title,
        detail: entry.edition ? `${entry.composer} · ${entry.edition}` : entry.composer,
        entry,
      },
      fold(entry.title),
      fold(`${entry.composer} ${entry.edition ?? ''}`),
    )

  const found = [...begins, ...within, ...elsewhere]
  return { matches: found.slice(0, limit), more: Math.max(0, found.length - limit) }
}
