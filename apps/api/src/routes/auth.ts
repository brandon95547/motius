import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { authConfigSchema, googleSignInSchema, userSchema, type User } from '@motius/shared'
import { GoogleSignInError, type VerifyGoogleCredential } from '../clients/google.js'
import { AppError } from '../errors.js'
import type { Account } from '../repositories/account-repository.js'
import { requireAccount, SESSION_COOKIE, sessionCookie } from '../plugins/auth.js'

export interface AuthRouteOptions {
  googleClientId: string
  sessionDays: number
  secureCookies: boolean
  /** Checks a Google credential. Tests pass their own, so they need neither Google nor a key. */
  verifyGoogle: VerifyGoogleCredential | null
}

/**
 * Signing in with Google, and out.
 *
 * The page shows Google's own button, which hands it an ID token; the server
 * checks that token, makes or updates the account, and starts a sign-in in an
 * HttpOnly cookie. Signing up is the same as signing in: the first sign-in
 * makes the account.
 */
export const authRoutes: FastifyPluginAsyncZod<AuthRouteOptions> = async (app, options) => {
  const userOf = (account: Account): User => ({
    email: account.email,
    name: account.name,
    picture: account.picture,
    isAdmin: app.isAdmin(account),
  })

  app.get(
    '/auth/config',
    {
      schema: {
        tags: ['auth'],
        summary: 'What the sign-in page needs: the Google client id, if one is set',
        response: { 200: authConfigSchema },
      },
    },
    async () => ({ googleClientId: options.googleClientId || null }),
  )

  app.post(
    '/auth/google',
    {
      schema: {
        tags: ['auth'],
        summary: 'Sign in, or up, with the credential from Google’s sign-in button',
        body: googleSignInSchema,
        response: { 200: userSchema },
      },
    },
    async (request, reply) => {
      if (!options.verifyGoogle) {
        throw new AppError(503, 'sign_in_not_set_up', 'Sign-in with Google is not set up yet.')
      }
      let identity
      try {
        identity = await options.verifyGoogle(request.body.credential)
      } catch (error) {
        if (!(error instanceof GoogleSignInError)) throw error
        request.log.info({ reason: error.reason }, 'google sign-in refused')
        if (error.reason === 'unreachable') {
          throw new AppError(503, 'google_unreachable', 'Google could not be reached. Try again.')
        }
        throw new AppError(
          401,
          'sign_in_refused',
          error.reason === 'unverified-email'
            ? 'That Google account’s address is not verified.'
            : 'That sign-in did not work. Try again.',
        )
      }
      const account = app.accounts.upsert(identity)
      const { token, expires } = app.accounts.startSession(account.id, options.sessionDays)
      reply.setCookie(SESSION_COOKIE, token, sessionCookie(options.secureCookies, expires))
      return userOf(account)
    },
  )

  app.get(
    '/auth/me',
    {
      onRequest: requireAccount,
      schema: {
        tags: ['auth'],
        summary: 'Who is signed in (401 for nobody)',
        response: { 200: userSchema },
      },
    },
    async (request) => userOf(request.account!),
  )

  app.post(
    '/auth/sign-out',
    {
      schema: {
        tags: ['auth'],
        summary: 'End this sign-in',
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      const token = request.cookies[SESSION_COOKIE]
      if (token) app.accounts.endSession(token)
      reply.clearCookie(SESSION_COOKIE, sessionCookie(options.secureCookies))
      return reply.code(204).send(null)
    },
  )
}
