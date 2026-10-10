import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import {
  collectionSchema,
  setSongCategorySchema,
  songCategoryChoiceSchema,
  songGenreSchema,
  songIdSchema,
  songMoodSchema,
  type SongCategoryChoice,
  type SongMood,
} from '@sonara/shared'

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

/**
 * What a row says, less anything this build has no name for.
 *
 * The lists of genres and moods are edited over time, and a row written under
 * an older list can name one that has since gone. Dropped here, that song is
 * simply as the catalog has it; sent on, it would fail the response's own
 * validation and take every other song's change down with it.
 */
function choice(row: Row): SongCategoryChoice {
  const genre = songGenreSchema.safeParse(row.genre)
  const stored: unknown = row.moods === null ? [] : JSON.parse(row.moods)
  const moods = (Array.isArray(stored) ? stored : []).filter(
    (mood): mood is SongMood => songMoodSchema.safeParse(mood).success,
  )
  return {
    songId: row.songId,
    genre: genre.success ? genre.data : null,
    moods: moods.length > 0 ? [...new Set(moods)] : null,
  }
}

export const songRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/songs/categories',
    {
      schema: {
        tags: ['songs'],
        summary: 'The built-in songs whose genre or moods have been changed',
        response: { 200: collectionSchema(songCategoryChoiceSchema) },
      },
    },
    async () => ({
      items: (app.db.prepare(`${SELECT} ORDER BY song_id`).all() as Row[])
        .map(choice)
        .filter((item) => item.genre !== null || item.moods !== null),
    }),
  )

  app.patch(
    '/songs/:songId/category',
    {
      schema: {
        tags: ['songs'],
        summary: 'Change the genre or the moods of a built-in song',
        description:
          'A partial update — send the genre, the moods, or both, and what is left out stays as it was. Idempotent. The server does not know the catalog, so any well-formed song id is accepted.',
        params: z.object({ songId: songIdSchema }),
        body: setSongCategorySchema,
        response: { 200: songCategoryChoiceSchema },
      },
    },
    async (request) => {
      const { songId } = request.params
      const { genre, moods } = request.body
      app.db
        .prepare(
          `INSERT INTO song_categories (song_id, genre, moods, updated_at)
           VALUES (@songId, @genre, @moods, @at)
           ON CONFLICT (song_id) DO UPDATE SET
             genre = COALESCE(excluded.genre, genre),
             moods = COALESCE(excluded.moods, moods),
             updated_at = excluded.updated_at`,
        )
        .run({
          songId,
          genre: genre ?? null,
          moods: moods ? JSON.stringify(moods) : null,
          at: new Date().toISOString(),
        })
      return choice(app.db.prepare(`${SELECT} WHERE song_id = ?`).get(songId) as Row)
    },
  )
}
