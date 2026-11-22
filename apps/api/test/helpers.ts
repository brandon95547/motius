import type { FastifyInstance, InjectOptions } from 'fastify'
import { buildApp } from '../src/app.js'
import { GoogleSignInError, type GoogleIdentity } from '../src/clients/google.js'
import { loadConfig } from '../src/config.js'
import { SESSION_COOKIE } from '../src/plugins/auth.js'

/** The address the test config names as the admin. */
export const ADMIN_EMAIL = 'admin@example.com'
export const PLAYER_EMAIL = 'player@example.com'

/**
 * A stand-in for Google: a credential of `good:<email>` is that account,
 * `unverified:<email>` an address Google has not verified, anything else a
 * forgery. No key, no network.
 */
export async function fakeGoogle(credential: string): Promise<GoogleIdentity> {
  const [kind, email] = credential.split(':')
  if (kind === 'unverified') throw new GoogleSignInError('unverified-email', 'unverified')
  if (kind !== 'good' || !email) throw new GoogleSignInError('invalid', 'invalid')
  const address = email.toLowerCase()
  return { sub: `sub-${address}`, email: address, name: address.split('@')[0]!, picture: null }
}

/** Signs an address in through the real route, and returns its session token. */
export async function signIn(app: FastifyInstance, email: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/google',
    payload: { credential: `good:${email}` },
  })
  if (res.statusCode !== 200) throw new Error(`sign-in failed: ${res.body}`)
  const cookie = res.cookies.find((each) => each.name === SESSION_COOKIE)
  if (!cookie) throw new Error('sign-in set no cookie')
  return cookie.value
}

/**
 * A fully wired app against an in-memory database. Every test gets its own, so
 * they neither share state nor need cleanup — and none of them can leave a
 * stray `.sqlite` behind in the workspace.
 *
 * Signed in as the admin unless told otherwise (`as: 'player'`, or `'nobody'`):
 * every request the test injects carries that sign-in, as a browser's would.
 */
export async function createTestApp(
  options: { as?: 'admin' | 'player' | 'nobody' } = {},
): Promise<FastifyInstance> {
  const config = loadConfig({
    NODE_ENV: 'test',
    DATABASE_PATH: ':memory:',
    LOG_LEVEL: 'silent',
    CORS_ORIGINS: 'http://localhost:5174',
    GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com',
    ADMIN_EMAILS: ADMIN_EMAIL,
  })
  const app = await buildApp(config, { verifyGoogle: fakeGoogle })
  const as = options.as ?? 'admin'
  if (as === 'nobody') return app

  const token = await signIn(app, as === 'admin' ? ADMIN_EMAIL : PLAYER_EMAIL)
  const inject = app.inject.bind(app) as (options: InjectOptions) => ReturnType<typeof app.inject>
  app.inject = ((opts: InjectOptions) =>
    inject({ ...opts, cookies: { [SESSION_COOKIE]: token, ...opts.cookies } })) as never
  return app
}
