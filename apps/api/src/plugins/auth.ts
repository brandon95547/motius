import fp from 'fastify-plugin'
import cookie from '@fastify/cookie'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { AppError } from '../errors.js'
import { AccountRepository, type Account } from '../repositories/account-repository.js'

declare module 'fastify' {
  interface FastifyInstance {
    accounts: AccountRepository
    /** Whether an account is an admin: its address is in the server's ADMIN_EMAILS. */
    isAdmin: (account: Account) => boolean
  }
  interface FastifyRequest {
    /** Who is signed in, from the session cookie; null for nobody. */
    account: Account | null
  }
}

export const SESSION_COOKIE = 'motius_session'

export interface AuthPluginOptions {
  adminEmails: ReadonlySet<string>
  secureCookies: boolean
}

/**
 * Who a request is from: the account its session cookie names, on every
 * request, before any route runs. The routes that need someone signed in, or
 * an admin, say so with the hooks below; this only finds out who it is.
 */
export const authPlugin = fp<AuthPluginOptions>(
  async function authPlugin(app: FastifyInstance, options: AuthPluginOptions) {
    await app.register(cookie)
    app.decorate('accounts', new AccountRepository(app.db))
    app.decorate('isAdmin', (account: Account) =>
      options.adminEmails.has(account.email.toLowerCase()),
    )
    app.decorateRequest('account', null)
    app.addHook('onRequest', async (request) => {
      const token = request.cookies[SESSION_COOKIE]
      request.account = token ? app.accounts.accountOf(token) : null
    })
  },
  { name: 'motius-auth', dependencies: ['motius-db'] },
)

/** The cookie's settings: HttpOnly, sent only to this site, Secure in production. */
export const sessionCookie = (secure: boolean, expires?: Date) =>
  ({
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure,
    ...(expires && { expires }),
  }) as const

/** For a route, or a whole scope of them, that needs someone signed in. */
export async function requireAccount(request: FastifyRequest, _reply: FastifyReply) {
  if (!request.account) throw new AppError(401, 'signed_out', 'Sign in to continue.')
}

/** For a route that changes things for everybody: only an admin may. */
export async function requireAdmin(request: FastifyRequest, _reply: FastifyReply) {
  if (!request.account) throw new AppError(401, 'signed_out', 'Sign in to continue.')
  if (!request.server.isAdmin(request.account)) {
    throw new AppError(403, 'not_admin', 'Only an admin can change this.')
  }
}
