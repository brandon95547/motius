import { afterEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { SESSION_COOKIE } from '../src/plugins/auth.js'
import { createTestApp, PLAYER_EMAIL, signIn } from './helpers.js'

/** Every keyboard belongs to the player who announced it, and nobody else sees it. */

let app: FastifyInstance
afterEach(async () => {
  await app.close()
})

const as = (token: string) => ({ [SESSION_COOKIE]: token })

const announce = (cookies: Record<string, string>, name: string, manufacturer: string) =>
  app.inject({ method: 'POST', url: '/api/v1/devices', cookies, payload: { name, manufacturer } })

describe('device owners', () => {
  it('answers 401 on every device route to someone not signed in', async () => {
    app = await createTestApp({ as: 'nobody' })
    const routes = [
      { method: 'GET', url: '/api/v1/device-profiles' },
      { method: 'GET', url: '/api/v1/devices' },
      { method: 'POST', url: '/api/v1/devices', payload: { name: 'P-125', manufacturer: '' } },
      { method: 'GET', url: '/api/v1/devices/any' },
      { method: 'PATCH', url: '/api/v1/devices/any/config', payload: { transpose: 1 } },
      { method: 'POST', url: '/api/v1/devices/any/config/reset' },
      { method: 'DELETE', url: '/api/v1/devices/any' },
    ] as const
    for (const route of routes) {
      const res = await app.inject(route)
      expect(res.statusCode, `${route.method} ${route.url}`).toBe(401)
    }
  })

  it('lists only the signed-in player’s own keyboards', async () => {
    app = await createTestApp({ as: 'nobody' })
    const mine = as(await signIn(app, PLAYER_EMAIL))
    const theirs = as(await signIn(app, 'other@example.com'))
    await announce(mine, 'P-125', 'Yamaha')
    await announce(theirs, 'FP-30X', 'Roland')

    const listed = await app.inject({ method: 'GET', url: '/api/v1/devices', cookies: mine })
    expect(listed.json().items.map((each: { name: string }) => each.name)).toEqual(['P-125'])
    const others = await app.inject({ method: 'GET', url: '/api/v1/devices', cookies: theirs })
    expect(others.json().items.map((each: { name: string }) => each.name)).toEqual(['FP-30X'])
  })

  it('keeps the same keyboard on two accounts apart, each with its own settings', async () => {
    app = await createTestApp({ as: 'nobody' })
    const mine = as(await signIn(app, PLAYER_EMAIL))
    const theirs = as(await signIn(app, 'other@example.com'))
    const first = await announce(mine, 'P-125', 'Yamaha')
    const second = await announce(theirs, 'P-125', 'Yamaha')
    // The second player's first sight of it, not a re-announcement of the first's.
    expect(second.statusCode).toBe(201)
    const id = first.json().device.id
    expect(second.json().device.id).toBe(id)

    await app.inject({
      method: 'PATCH',
      url: `/api/v1/devices/${id}/config`,
      cookies: mine,
      payload: { transpose: 4 },
    })
    const theirsNow = await app.inject({
      method: 'GET',
      url: `/api/v1/devices/${id}`,
      cookies: theirs,
    })
    expect(theirsNow.json().config.transpose).toBe(0)
  })

  it('answers 404 to another player reading, changing, resetting or deleting one', async () => {
    app = await createTestApp({ as: 'nobody' })
    const mine = as(await signIn(app, PLAYER_EMAIL))
    const theirs = as(await signIn(app, 'other@example.com'))
    const id = (await announce(mine, 'MPK Mini Mk3', 'AKAI')).json().device.id
    await app.inject({
      method: 'PATCH',
      url: `/api/v1/devices/${id}/config`,
      cookies: mine,
      payload: { transpose: 5 },
    })

    const attempts = [
      { method: 'GET', url: `/api/v1/devices/${id}` },
      { method: 'PATCH', url: `/api/v1/devices/${id}/config`, payload: { transpose: -2 } },
      { method: 'POST', url: `/api/v1/devices/${id}/config/reset` },
      { method: 'DELETE', url: `/api/v1/devices/${id}` },
    ] as const
    for (const attempt of attempts) {
      const res = await app.inject({ ...attempt, cookies: theirs })
      expect(res.statusCode, `${attempt.method} ${attempt.url}`).toBe(404)
      expect(res.json().error.code).toBe('not_found')
    }

    // Untouched for its owner.
    const still = await app.inject({ method: 'GET', url: `/api/v1/devices/${id}`, cookies: mine })
    expect(still.statusCode).toBe(200)
    expect(still.json().config.transpose).toBe(5)
  })
})
