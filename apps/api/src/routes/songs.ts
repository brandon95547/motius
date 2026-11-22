import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import {
  collectionSchema,
  setSongCategorySchema,
  songCategoryChoiceSchema,
  songIdSchema,
} from '@motius/shared'
import { requireAdmin } from '../plugins/auth.js'

/**
 * Which genre and moods each built-in song is listed under, where an admin has
 * changed them. What is kept, and how, is the song category repository's.
 */
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
    async () => ({ items: app.songCategories.list() }),
  )

  app.patch(
    '/songs/:songId/category',
    {
      // The shelves are the same for everybody, so only an admin moves a song.
      onRequest: requireAdmin,
      schema: {
        tags: ['songs'],
        summary: 'Change the genre or the moods of a built-in song (admins only)',
        description:
          'A partial update — send the genre, the moods, or both, and what is left out stays as it was. Idempotent. The server does not know the catalog, so any well-formed song id is accepted.',
        params: z.object({ songId: songIdSchema }),
        body: setSongCategorySchema,
        response: { 200: songCategoryChoiceSchema },
      },
    },
    async (request) => app.songCategories.set(request.params.songId, request.body),
  )
}
