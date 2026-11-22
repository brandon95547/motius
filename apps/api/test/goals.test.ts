import { afterEach, describe, expect, it } from 'vitest'
import type { FastifyInstance, InjectOptions } from 'fastify'
import { goalsSchema } from '@motius/shared'
import { SESSION_COOKIE } from '../src/plugins/auth.js'
import { createTestApp, PLAYER_EMAIL, signIn } from './helpers.js'

let apps: FastifyInstance[] = []
const make = async (as: 'admin' | 'player' | 'nobody') => {
  const app = await createTestApp({ as })
  apps.push(app)
  return app
}
afterEach(async () => {
  await Promise.all(apps.map((app) => app.close()))
  apps = []
})

type Cookies = InjectOptions['cookies']
const goals = (app: FastifyInstance, cookies?: Cookies) =>
  app.inject({ method: 'GET', url: '/api/v1/goals', cookies })
const setGoal = (app: FastifyInstance, weeklyGoal: unknown, cookies?: Cookies) =>
  app.inject({ method: 'PUT', url: '/api/v1/goals/weekly', payload: { weeklyGoal }, cookies })
const see = (app: FastifyInstance, badges: unknown, cookies?: Cookies) =>
  app.inject({ method: 'POST', url: '/api/v1/goals/seen', payload: { badges }, cookies })
const reset = (app: FastifyInstance, scope: string) =>
  app.inject({ method: 'POST', url: '/api/v1/runs/reset', payload: { scope } })
const seenAt = (app: FastifyInstance, badge: string) =>
  (
    app.db.prepare('SELECT seen_at AS at FROM seen_badges WHERE badge_id = ?').get(badge) as {
      at: number
    }
  ).at

describe('goals', () => {
  it('refuses anyone not signed in', async () => {
    const app = await make('nobody')
    for (const res of [await goals(app), await setGoal(app, 5), await see(app, ['habit-streak'])]) {
      expect(res.statusCode).toBe(401)
      expect(res.json().error.code).toBe('signed_out')
    }
  })

  it('starts with no goal and nothing seen', async () => {
    const app = await make('player')
    const res = await goals(app)
    expect(res.statusCode).toBe(200)
    expect(goalsSchema.parse(res.json())).toEqual({ weeklyGoal: null, seenBadges: [] })
  })

  it('sets the weekly goal and clears it with null', async () => {
    const app = await make('player')
    expect((await setGoal(app, 12)).json()).toEqual({ weeklyGoal: 12, seenBadges: [] })
    expect((await goals(app)).json().weeklyGoal).toBe(12)
    expect((await setGoal(app, null)).json()).toEqual({ weeklyGoal: null, seenBadges: [] })
  })

  it('marks badges seen, sorted, and keeps the first time one was seen', async () => {
    const app = await make('player')
    const first = await see(app, ['habit-streak-7', 'course-scales'])
    expect(first.statusCode).toBe(200)
    expect(first.json().seenBadges).toEqual(['course-scales', 'habit-streak-7'])
    const at = seenAt(app, 'course-scales')
    await new Promise((resolve) => setTimeout(resolve, 5))
    const again = await see(app, ['course-scales', 'course-chords'])
    expect(again.statusCode).toBe(200)
    expect(again.json().seenBadges).toEqual(['course-chords', 'course-scales', 'habit-streak-7'])
    expect(seenAt(app, 'course-scales')).toBe(at)
  })

  it('refuses a bad badge id, an empty list and a goal out of range', async () => {
    const app = await make('player')
    for (const res of [
      await see(app, ['trophy-gold']),
      await see(app, ['Course-Scales']),
      await see(app, []),
      await setGoal(app, 0),
      await setGoal(app, 101),
      await setGoal(app, 2.5),
    ]) {
      expect(res.statusCode).toBe(400)
      expect(res.json().error.code).toBe('validation_failed')
    }
    expect((await goals(app)).json()).toEqual({ weeklyGoal: null, seenBadges: [] })
  })

  it('reads and changes only the signed-in player’s own', async () => {
    const app = await make('nobody')
    const mine = { [SESSION_COOKIE]: await signIn(app, PLAYER_EMAIL) }
    const theirs = { [SESSION_COOKIE]: await signIn(app, 'other@example.com') }
    await setGoal(app, 20, mine)
    await see(app, ['habit-streak'], mine)
    expect((await goals(app, mine)).json()).toEqual({
      weeklyGoal: 20,
      seenBadges: ['habit-streak'],
    })
    expect((await goals(app, theirs)).json()).toEqual({ weeklyGoal: null, seenBadges: [] })
    await setGoal(app, 3, theirs)
    expect((await goals(app, mine)).json().weeklyGoal).toBe(20)
  })
})

describe('starting over', () => {
  it('lessons: forgets only the course badges seen, and keeps the goal', async () => {
    const app = await make('player')
    await setGoal(app, 10)
    await see(app, ['course-scales', 'habit-streak'])
    expect((await reset(app, 'lessons')).statusCode).toBe(200)
    expect((await goals(app)).json()).toEqual({ weeklyGoal: 10, seenBadges: ['habit-streak'] })
  })

  it('everything: clears the goal and every badge seen, as for a new account', async () => {
    const app = await make('player')
    await setGoal(app, 10)
    await see(app, ['course-scales', 'habit-streak'])
    expect((await reset(app, 'everything')).statusCode).toBe(200)
    expect((await goals(app)).json()).toEqual({ weeklyGoal: null, seenBadges: [] })
  })

  it('leaves another player’s goals alone', async () => {
    const app = await make('nobody')
    const mine = { [SESSION_COOKIE]: await signIn(app, PLAYER_EMAIL) }
    const theirs = { [SESSION_COOKIE]: await signIn(app, 'other@example.com') }
    await setGoal(app, 7, theirs)
    await see(app, ['course-scales', 'habit-streak'], theirs)
    for (const scope of ['lessons', 'everything']) {
      await app.inject({
        method: 'POST',
        url: '/api/v1/runs/reset',
        payload: { scope },
        cookies: mine,
      })
    }
    expect((await goals(app, theirs)).json()).toEqual({
      weeklyGoal: 7,
      seenBadges: ['course-scales', 'habit-streak'],
    })
  })
})
