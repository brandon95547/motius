import { createHash, randomBytes } from 'node:crypto'
import type { Db } from '../db/index.js'
import type { GoogleIdentity } from '../clients/google.js'

/**
 * Accounts and their sign-ins.
 *
 * A sign-in is a random token in an HttpOnly cookie; the database keeps only
 * its SHA-256, so neither a copy of the database nor a log of it signs anyone
 * in. Expired sign-ins are cleared as new ones are made.
 */

export interface Account {
  readonly id: number
  readonly email: string
  readonly name: string
  readonly picture: string | null
}

const hash = (token: string) => createHash('sha256').update(token).digest('hex')

export class AccountRepository {
  constructor(private readonly db: Db) {}

  /** The account for a Google identity, made on its first sign-in and kept up to date after. */
  upsert(identity: GoogleIdentity): Account {
    const now = new Date().toISOString()
    return this.db
      .prepare(
        `INSERT INTO users (google_sub, email, name, picture, created_at, last_seen_at)
         VALUES (@sub, @email, @name, @picture, @now, @now)
         ON CONFLICT (google_sub) DO UPDATE SET
           email = excluded.email,
           name = excluded.name,
           picture = excluded.picture,
           last_seen_at = excluded.last_seen_at
         RETURNING id, email, name, picture`,
      )
      .get({ ...identity, now }) as Account
  }

  /** A new sign-in for an account: the token for its cookie. */
  startSession(userId: number, days: number): { token: string; expires: Date } {
    const token = randomBytes(32).toString('base64url')
    const now = new Date()
    const expires = new Date(now.getTime() + days * 86_400_000)
    this.db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now.toISOString())
    this.db
      .prepare(
        'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
      )
      .run(hash(token), userId, now.toISOString(), expires.toISOString())
    return { token, expires }
  }

  /** Whose a cookie's token is, if it is a sign-in that has not run out. */
  accountOf(token: string): Account | null {
    return (
      (this.db
        .prepare(
          `SELECT u.id, u.email, u.name, u.picture
             FROM sessions s JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = ? AND s.expires_at > ?`,
        )
        .get(hash(token), new Date().toISOString()) as Account | undefined) ?? null
    )
  }

  endSession(token: string): void {
    this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash(token))
  }
}
