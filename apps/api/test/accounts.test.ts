import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { lessonSettingsSchema, runSchema, userSchema, type NewRun } from '@motius/shared'
import { SESSION_COOKIE } from '../src/plugins/auth.js'
import { ADMIN_EMAIL, createTestApp, PLAYER_EMAIL, signIn } from './helpers.js'

const LESSON = 'piano-foundations/keyboard-layout/white-and-black-keys/two-black-key-groups'

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

describe('signing in', () => {
  it('tells the sign-in page which Google client to use', async () => {
    const app = await make('nobody')
    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/config' })
    expect(res.json()).toEqual({ googleClientId: 'test-client.apps.googleusercontent.com' })
  })

  it('signs in (and up) with a Google credential, in an HttpOnly cookie', async () => {
    const app = await make('nobody')
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/google',
      payload: { credential: `good:${PLAYER_EMAIL}` },
    })
    expect(res.statusCode).toBe(200)
    expect(userSchema.parse(res.json())).toMatchObject({ email: PLAYER_EMAIL, isAdmin: false })
    const cookie = res.cookies.find((each) => each.name === SESSION_COOKIE)!
    expect(cookie.httpOnly).toBe(true)
    expect(cookie.sameSite).toBe('Lax')

    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      cookies: { [SESSION_COOKIE]: cookie.value },
    })
    expect(me.json()).toMatchObject({ email: PLAYER_EMAIL, isAdmin: false })
  })

  it('makes an admin of the address the .env names, whatever its case', async () => {
    const app = await make('nobody')
    const token = await signIn(app, ADMIN_EMAIL.toUpperCase())
    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      cookies: { [SESSION_COOKIE]: token },
    })
    expect(me.json()).toMatchObject({ email: ADMIN_EMAIL, isAdmin: true })
  })

  it('refuses a forged credential and an unverified address', async () => {
    const app = await make('nobody')
    for (const credential of ['forged-credential-1234567', `unverified:${PLAYER_EMAIL}`]) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/google',
        payload: { credential },
      })
      expect(res.statusCode).toBe(401)
      expect(res.json().error.code).toBe('sign_in_refused')
      expect(res.cookies).toHaveLength(0)
    }
  })

  it('keeps every route but health and sign-in from someone not signed in', async () => {
    const app = await make('nobody')
    expect((await app.inject({ method: 'GET', url: '/api/v1/health' })).statusCode).toBe(200)

    // Every route the API has, from its own OpenAPI document, so a route added
    // later is swept too. Path parameters get a well-formed stand-in.
    const open = new Set([
      'GET /api/v1/health',
      'GET /api/v1/health/live',
      'GET /api/v1/auth/config',
      'POST /api/v1/auth/google',
      'POST /api/v1/auth/sign-out',
    ])
    const paths = (app.swagger() as { paths: Record<string, Record<string, unknown>> }).paths
    const routes = Object.entries(paths).flatMap(([path, methods]) =>
      Object.keys(methods).map((method) => ({
        method: method.toUpperCase(),
        url: `/api/v1${path}`.replace(/\{[^}]+\}/g, 'some-id'),
        name: `${method.toUpperCase()} /api/v1${path}`,
      })),
    )
    const guarded = routes.filter((route) => !open.has(route.name))
    // Instruments (2), device profiles, devices (6), songs (2), lessons (2), runs (3), goals (3), me.
    expect(guarded.length).toBeGreaterThanOrEqual(20)
    for (const route of guarded) {
      const res = await app.inject({
        method: route.method as 'GET',
        url: route.url,
        payload: route.method === 'GET' || route.method === 'DELETE' ? undefined : {},
      })
      expect(res.statusCode, route.name).toBe(401)
      expect(res.json().error.code, route.name).toBe('signed_out')
    }

    const forged = await app.inject({
      method: 'GET',
      url: '/api/v1/instruments',
      cookies: { [SESSION_COOKIE]: 'not-a-real-session' },
    })
    expect(forged.statusCode).toBe(401)
  })

  it('ends the sign-in on sign-out', async () => {
    const app = await make('nobody')
    const token = await signIn(app, PLAYER_EMAIL)
    const cookies = { [SESSION_COOKIE]: token }
    const out = await app.inject({ method: 'POST', url: '/api/v1/auth/sign-out', cookies })
    expect(out.statusCode).toBe(204)
    expect((await app.inject({ method: 'GET', url: '/api/v1/auth/me', cookies })).statusCode).toBe(
      401,
    )
  })
})

describe('lesson settings', () => {
  const settings = (app: FastifyInstance) =>
    app.inject({ method: 'GET', url: '/api/v1/lessons/settings' })
  const set = (app: FastifyInstance, payload: object) =>
    app.inject({ method: 'PUT', url: '/api/v1/lessons/settings', payload })

  it('starts with none: every lesson opens as the player left things', async () => {
    expect((await settings(await make('player'))).json()).toEqual({ items: [] })
  })

  it('lets an admin set how a lesson opens, for everybody', async () => {
    const admin = await make('admin')
    const lesson = {
      lessonKey: LESSON,
      keyLabels: 'fingers',
      stageView: null,
      hands: true,
      bpm: 60,
    }
    const res = await set(admin, lesson)
    expect(res.statusCode).toBe(200)
    expect(lessonSettingsSchema.parse(res.json())).toEqual(lesson)
    expect((await settings(admin)).json().items).toEqual([lesson])
  })

  it('clears a lesson set back to all null', async () => {
    const admin = await make('admin')
    await set(admin, {
      lessonKey: LESSON,
      keyLabels: 'fingers',
      stageView: null,
      hands: null,
      bpm: null,
    })
    await set(admin, {
      lessonKey: LESSON,
      keyLabels: null,
      stageView: null,
      hands: null,
      bpm: null,
    })
    expect((await settings(admin)).json().items).toEqual([])
  })

  it('refuses a player, a tempo out of range and an address that is not one', async () => {
    const player = await make('player')
    const ok = { lessonKey: LESSON, keyLabels: 'fingers', stageView: null, hands: null, bpm: null }
    const refused = await set(player, ok)
    expect(refused.statusCode).toBe(403)
    expect(refused.json().error.code).toBe('not_admin')

    const admin = await make('admin')
    expect((await set(admin, { ...ok, bpm: 500 })).statusCode).toBe(400)
    expect((await set(admin, { ...ok, lessonKey: '../etc/passwd' })).statusCode).toBe(400)
  })

  it('lets only an admin move a song to another shelf', async () => {
    const player = await make('player')
    const res = await player.inject({
      method: 'PATCH',
      url: '/api/v1/songs/bach-air-on-the-g-string/category',
      payload: { genre: 'jazz' },
    })
    expect(res.statusCode).toBe(403)
  })
})

describe('finished runs', () => {
  const run = (key: string, accuracy: number, at: number): NewRun => ({
    at,
    kind: 'lesson',
    key,
    title: 'Two black keys',
    place: 'Piano Foundations',
    opens: `#/${key}`,
    mode: 'learn',
    bpm: 72,
    steps: 5,
    accuracy,
    mistakes: 0,
    missed: 0,
  })

  it('keeps a player’s runs with their account, oldest first, and shows nobody else', async () => {
    const app = await make('nobody')
    const mine = { [SESSION_COOKIE]: await signIn(app, PLAYER_EMAIL) }
    const theirs = { [SESSION_COOKIE]: await signIn(app, 'other@example.com') }

    const added = await app.inject({
      method: 'POST',
      url: '/api/v1/runs',
      cookies: mine,
      payload: { runs: [run(LESSON, 1, 2000), run(LESSON, 0.5, 1000)] },
    })
    expect(added.statusCode).toBe(201)
    for (const item of added.json().items) expect(() => runSchema.parse(item)).not.toThrow()

    const listed = await app.inject({ method: 'GET', url: '/api/v1/runs', cookies: mine })
    expect(listed.json().items.map((each: NewRun) => each.at)).toEqual([1000, 2000])
    const others = await app.inject({ method: 'GET', url: '/api/v1/runs', cookies: theirs })
    expect(others.json().items).toEqual([])
  })

  it('skips a stored run that is corrupt, says so once, and still sends the rest', async () => {
    const app = await make('player')
    await app.inject({
      method: 'POST',
      url: '/api/v1/runs',
      payload: { runs: [run(LESSON, 1, 2)] },
    })
    const { id: userId } = app.db.prepare('SELECT id FROM users').get() as { id: number }
    const { id } = app.db
      .prepare(
        `INSERT INTO runs (user_id, at, run_key, record) VALUES (?, 1, ?, '{"at":1,') RETURNING id`,
      )
      .get(userId, LESSON) as { id: number }
    const warn = vi.spyOn(app.log, 'warn')
    for (let i = 0; i < 2; i++) {
      const listed = await app.inject({ method: 'GET', url: '/api/v1/runs' })
      expect(listed.statusCode).toBe(200)
      expect(listed.json().items.map((each: NewRun) => each.at)).toEqual([2])
    }
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toMatchObject({ table: 'runs', id: String(id) })
  })

  it('skips a sent run that is not one, keeps the rest, and says how many it skipped', async () => {
    // A device can hold runs an older release wrote: checked here, one by one,
    // so one the server cannot read never holds back the rest.
    const app = await make('player')
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/runs',
      payload: {
        runs: [{ ...run(LESSON, 1.5, 1), opens: 'https://example.com' }, 'junk', run(LESSON, 1, 3)],
      },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({ skipped: 2, items: [{ at: 3 }] })
    const listed = await app.inject({ method: 'GET', url: '/api/v1/runs' })
    expect(listed.json().items.map((each: NewRun) => each.at)).toEqual([3])
  })

  it('refuses a body that holds no runs', async () => {
    const app = await make('player')
    const res = await app.inject({ method: 'POST', url: '/api/v1/runs', payload: { runs: [] } })
    expect(res.statusCode).toBe(400)
  })
})

describe('starting over', () => {
  const run = (at: number): NewRun => ({
    at,
    kind: 'lesson',
    key: LESSON,
    title: 'Two black keys',
    place: 'Piano Foundations',
    opens: `#/${LESSON}`,
    mode: 'learn',
    bpm: 72,
    steps: 5,
    accuracy: 1,
    mistakes: 0,
    missed: 0,
  })

  it('starts the lessons over and keeps the history', async () => {
    const app = await make('player')
    await app.inject({ method: 'POST', url: '/api/v1/runs', payload: { runs: [run(1000)] } })
    const before = Date.now()
    const reset = await app.inject({
      method: 'POST',
      url: '/api/v1/runs/reset',
      payload: { scope: 'lessons' },
    })
    expect(reset.statusCode).toBe(200)
    const listed = (await app.inject({ method: 'GET', url: '/api/v1/runs' })).json()
    expect(listed.items).toHaveLength(1)
    expect(listed.lessonsResetAt).toBeGreaterThanOrEqual(before)
  })

  it('deletes every run, as for a new account, and only the player’s own', async () => {
    const app = await make('nobody')
    const mine = { [SESSION_COOKIE]: await signIn(app, PLAYER_EMAIL) }
    const theirs = { [SESSION_COOKIE]: await signIn(app, 'other@example.com') }
    for (const cookies of [mine, theirs]) {
      await app.inject({
        method: 'POST',
        url: '/api/v1/runs',
        cookies,
        payload: { runs: [run(1)] },
      })
    }
    await app.inject({
      method: 'POST',
      url: '/api/v1/runs/reset',
      cookies: mine,
      payload: { scope: 'lessons' },
    })
    await app.inject({
      method: 'POST',
      url: '/api/v1/runs/reset',
      cookies: mine,
      payload: { scope: 'everything' },
    })
    const listed = (await app.inject({ method: 'GET', url: '/api/v1/runs', cookies: mine })).json()
    expect(listed).toEqual({ items: [], lessonsResetAt: null })
    const others = (
      await app.inject({ method: 'GET', url: '/api/v1/runs', cookies: theirs })
    ).json()
    expect(others.items).toHaveLength(1)
  })

  it('refuses a scope that is not one, and anyone not signed in', async () => {
    const player = await make('player')
    const bad = await player.inject({
      method: 'POST',
      url: '/api/v1/runs/reset',
      payload: { scope: 'all' },
    })
    expect(bad.statusCode).toBe(400)
    const nobody = await make('nobody')
    const out = await nobody.inject({
      method: 'POST',
      url: '/api/v1/runs/reset',
      payload: { scope: 'everything' },
    })
    expect(out.statusCode).toBe(401)
  })
})
