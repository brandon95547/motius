import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { collectionSchema, lessonSettingsSchema, setLessonSettingsSchema } from '@motius/shared'
import { requireAdmin } from '../plugins/auth.js'

/**
 * How each lesson opens, set by an admin for everybody. What is kept, and how,
 * is the lesson settings repository's.
 */
export const lessonRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/lessons/settings',
    {
      schema: {
        tags: ['lessons'],
        summary: 'How each lesson opens, where an admin has set it',
        response: { 200: collectionSchema(lessonSettingsSchema) },
      },
    },
    async () => ({ items: app.lessonSettings.list() }),
  )

  app.put(
    '/lessons/settings',
    {
      onRequest: requireAdmin,
      schema: {
        tags: ['lessons'],
        summary: 'Set how a lesson opens (admins only)',
        description:
          'The whole of a lesson’s settings: each is null for “as the player left it”. All null clears the lesson.',
        body: setLessonSettingsSchema,
        response: { 200: lessonSettingsSchema },
      },
    },
    async (request) => app.lessonSettings.set(request.body, request.account!.email),
  )
}
