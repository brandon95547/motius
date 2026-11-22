import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { goalsSchema, seeBadgesSchema, setWeeklyGoalSchema } from '@motius/shared'

/**
 * The signed-in player's weekly goal and the badges they have been shown.
 * Each player reads and changes only their own: every call names the
 * signed-in account.
 */
export const goalRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/goals',
    {
      schema: {
        tags: ['goals'],
        summary: 'The signed-in player’s weekly goal and the badges they have seen',
        response: { 200: goalsSchema },
      },
    },
    async (request) => app.goals.get(request.account!.id),
  )

  app.put(
    '/goals/weekly',
    {
      schema: {
        tags: ['goals'],
        summary: 'Set the weekly goal, or clear it with null',
        body: setWeeklyGoalSchema,
        response: { 200: goalsSchema },
      },
    },
    async (request) => app.goals.setWeeklyGoal(request.account!.id, request.body.weeklyGoal),
  )

  app.post(
    '/goals/seen',
    {
      schema: {
        tags: ['goals'],
        summary: 'Mark badges as seen, so their unlock is not shown again',
        description: 'A badge already seen is not an error: it keeps when it was first seen.',
        body: seeBadgesSchema,
        response: { 200: goalsSchema },
      },
    },
    async (request) => app.goals.see(request.account!.id, request.body.badges),
  )
}
