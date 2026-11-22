import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { loadConfig } from '../src/config.js'
import { createTestApp } from './helpers.js'

describe('health', () => {
  let app: FastifyInstance
  beforeEach(async () => {
    app = await createTestApp()
  })
  afterEach(async () => {
    await app.close()
  })

  it('reports ok with a reachable database', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ status: 'ok' })
    expect(res.json().uptimeSeconds).toBeGreaterThanOrEqual(0)
  })

  it('answers liveness without touching the database', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health/live' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'ok' })
  })

  it('returns the shared error envelope for an unknown route', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/nope?<script>' })
    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe('not_found')
    // A fixed sentence: nothing the client sent comes back.
    expect(res.body).not.toContain('nope')
    expect(res.body).not.toContain('script')
  })

  it('serves an OpenAPI document covering every route', async () => {
    await app.ready()
    const spec = app.swagger() as { paths: Record<string, unknown> }
    expect(Object.keys(spec.paths)).toEqual(
      expect.arrayContaining(['/health', '/instruments', '/devices', '/devices/{id}/config']),
    )
  })

  it('serves the API reference outside production', async () => {
    expect((await app.inject({ method: 'GET', url: '/docs/' })).statusCode).toBe(200)
  })
})

describe('in production', () => {
  it('serves no API reference', async () => {
    const app = await buildApp(
      loadConfig({ NODE_ENV: 'production', DATABASE_PATH: ':memory:', LOG_LEVEL: 'silent' }),
    )
    try {
      expect((await app.inject({ method: 'GET', url: '/docs/' })).statusCode).toBe(404)
      expect((await app.inject({ method: 'GET', url: '/api/v1/health' })).statusCode).toBe(200)
    } finally {
      await app.close()
    }
  })
})
