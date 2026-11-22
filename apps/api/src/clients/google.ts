import { createRemoteJWKSet, errors, jwtVerify } from 'jose'

/**
 * Google, as far as this server talks to it: checking that a sign-in button's
 * credential is a real ID token, issued by Google to this app, for an address
 * Google has verified.
 *
 * The token is checked here against Google's published keys rather than sent
 * back to Google to ask: the keys are fetched once and cached (`jose` keeps
 * them and refetches when Google rotates them), so a sign-in costs no request
 * of its own. The fetch has a timeout, and is not retried: a sign-in that
 * cannot reach Google fails, and the person tries again.
 */

const GOOGLE_KEYS = new URL('https://www.googleapis.com/oauth2/v3/certs')
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com']

/** Who a verified credential is for. */
export interface GoogleIdentity {
  /** Google's own id for the account: an address can change, this cannot. */
  readonly sub: string
  readonly email: string
  readonly name: string
  readonly picture: string | null
}

/** Why a credential was not accepted: a bad one, or Google out of reach. */
export class GoogleSignInError extends Error {
  constructor(
    readonly reason: 'invalid' | 'unverified-email' | 'unreachable',
    message: string,
  ) {
    super(message)
    this.name = 'GoogleSignInError'
  }
}

export type VerifyGoogleCredential = (credential: string) => Promise<GoogleIdentity>

/**
 * A verifier for the OAuth client the sign-in button is for. `timeoutMs` bounds
 * the fetch of Google's keys (GOOGLE_TIMEOUT_MS).
 */
export function googleVerifier(clientId: string, timeoutMs: number): VerifyGoogleCredential {
  const keys = createRemoteJWKSet(GOOGLE_KEYS, { timeoutDuration: timeoutMs })

  return async (credential) => {
    let payload
    try {
      ;({ payload } = await jwtVerify(credential, keys, { issuer: ISSUERS, audience: clientId }))
    } catch (error) {
      if (error instanceof errors.JWKSTimeout || (error as Error)?.name === 'TypeError') {
        throw new GoogleSignInError('unreachable', 'Google could not be reached.')
      }
      throw new GoogleSignInError('invalid', 'The Google credential was not valid.')
    }
    const { sub, email, email_verified: verified, name, picture } = payload
    if (typeof sub !== 'string' || typeof email !== 'string') {
      throw new GoogleSignInError('invalid', 'The Google credential named no account.')
    }
    if (verified !== true) {
      throw new GoogleSignInError('unverified-email', 'That Google address is not verified.')
    }
    return {
      sub,
      email: email.toLowerCase(),
      name: typeof name === 'string' && name ? name : email,
      picture: typeof picture === 'string' ? picture : null,
    }
  }
}
