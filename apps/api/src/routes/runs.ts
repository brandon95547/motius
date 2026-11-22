import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import {
  addedRunsSchema,
  addRunsSchema,
  newRunSchema,
  resetProgressSchema,
  resetResultSchema,
  runsSchema,
  type NewRun,
} from '@motius/shared'

export interface RunRouteOptions {
  /** The largest body POST /runs takes: a device's runs from before sign-in, at once. */
  bodyLimit: number
}

/**
 * The runs a player has finished, kept with their account. Each player sees,
 * adds and resets only their own: every call names the signed-in account.
 */
export const runRoutes: FastifyPluginAsyncZod<RunRouteOptions> = async (app, options) => {
  app.get(
    '/runs',
    {
      schema: {
        tags: ['runs'],
        summary:
          'The signed-in player’s finished runs, oldest first, and when the lessons were last started over',
        response: { 200: runsSchema },
      },
    },
    async (request) => ({
      items: app.runs.latest(request.account!.id),
      lessonsResetAt: app.runs.lessonsResetAt(request.account!.id),
    }),
  )

  app.post(
    '/runs/reset',
    {
      schema: {
        tags: ['runs'],
        summary: 'Start over: the lessons only, keeping the history, or everything',
        description:
          '`lessons` starts the lessons over: lesson scores count only the runs after now, and every run stays in the history. It also forgets the course badges seen. `everything` deletes every run, the weekly goal and every badge seen, as for a new account. Neither can be undone.',
        body: resetProgressSchema,
        response: { 200: resetResultSchema },
      },
    },
    async (request) => {
      const lessonsResetAt = app.runs.reset(request.account!.id, request.body.scope)
      request.log.info({ scope: request.body.scope }, 'progress reset')
      return { lessonsResetAt }
    },
  )

  app.post(
    '/runs',
    {
      bodyLimit: options.bodyLimit,
      schema: {
        tags: ['runs'],
        summary: 'Keep finished runs: one as it ends, or a device’s from before sign-in',
        body: addRunsSchema,
        response: { 201: addedRunsSchema },
      },
    },
    async (request, reply) => {
      // Each run on its own: one that cannot be read is skipped and logged, not
      // allowed to refuse the rest.
      const runs: NewRun[] = []
      for (const sent of request.body.runs) {
        const parsed = newRunSchema.safeParse(sent)
        if (parsed.success) runs.push(parsed.data)
      }
      const skipped = request.body.runs.length - runs.length
      if (skipped > 0) request.log.warn({ skipped }, 'runs skipped as unreadable')
      const items = runs.length > 0 ? app.runs.add(request.account!.id, runs) : []
      return reply.code(201).send({ items, skipped })
    },
  )
}
