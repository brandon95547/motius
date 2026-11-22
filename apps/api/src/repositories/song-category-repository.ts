import type { Db } from '../db/index.js'
import {
  songGenreSchema,
  songMoodSchema,
  type SetSongCategoryInput,
  type SongCategoryChoice,
  type SongMood,
} from '@motius/shared'
import { storedJson, type Warn } from './stored-json.js'

/**
 * Which genre of the song chooser each built-in song is in, and which moods it
 * is listed under, where either has been changed from what it came with.
 *
 * The songs and what they start as are the app's. What is kept here is the
 * changing: it is the one thing about them that someone using the app decides,
 * and it is decided once for everybody rather than browser by browser.
 */

/** A row as the columns hold it: the moods are a JSON list. */
interface Row {
  songId: string
  genre: string | null
  moods: string | null
}

const SELECT = 'SELECT song_id AS songId, genre, moods FROM song_categories'

export class SongCategoryRepository {
  readonly #read: ReturnType<typeof storedJson>

  constructor(
    private readonly db: Db,
    warn: Warn,
  ) {
    this.#read = storedJson('song_categories', warn)
  }

  /**
   * What a row says, less anything this build has no name for.
   *
   * The lists of genres and moods are edited over time, and a row written under
   * an older list can name one that has since gone. Dropped here, that song is
   * simply as the catalog has it; sent on, it would fail the response's own
   * validation and take every other song's change down with it. A row whose
   * moods are not JSON at all is left out whole.
   */
  #choiceOf(row: Row): SongCategoryChoice | null {
    const stored = row.moods === null ? { value: [] } : this.#read(row.songId, row.moods)
    if (!stored) return null
    const genre = songGenreSchema.safeParse(row.genre)
    const moods = (Array.isArray(stored.value) ? stored.value : []).filter(
      (mood): mood is SongMood => songMoodSchema.safeParse(mood).success,
    )
    return {
      songId: row.songId,
      genre: genre.success ? genre.data : null,
      moods: moods.length > 0 ? [...new Set(moods)] : null,
    }
  }

  /** Every song whose genre or moods have been changed. */
  list(): SongCategoryChoice[] {
    return (this.db.prepare(`${SELECT} ORDER BY song_id`).all() as Row[])
      .map((row) => this.#choiceOf(row))
      .filter(
        (item): item is SongCategoryChoice =>
          item !== null && (item.genre !== null || item.moods !== null),
      )
  }

  /**
   * Changes a song's genre, its moods, or both; what is left out stays as it
   * was. Moods that were stored corrupt are not kept: they read as unchanged.
   */
  set(songId: string, change: SetSongCategoryInput): SongCategoryChoice {
    this.db
      .prepare(
        `INSERT INTO song_categories (song_id, genre, moods, updated_at)
         VALUES (@songId, @genre, @moods, @at)
         ON CONFLICT (song_id) DO UPDATE SET
           genre = COALESCE(excluded.genre, genre),
           moods = COALESCE(excluded.moods, CASE WHEN json_valid(moods) THEN moods END),
           updated_at = excluded.updated_at`,
      )
      .run({
        songId,
        genre: change.genre ?? null,
        moods: change.moods ? JSON.stringify(change.moods) : null,
        at: new Date().toISOString(),
      })
    const row = this.db.prepare(`${SELECT} WHERE song_id = ?`).get(songId) as Row
    return this.#choiceOf(row) ?? { songId, genre: null, moods: null }
  }
}
