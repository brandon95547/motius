import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRemoteJWKSet, errors, jwtVerify } from 'jose'
import { GoogleSignInError, googleVerifier } from '../src/clients/google.js'

// The boundary: jose fetches Google's keys and checks the token. Stubbed here,
// so the client's own decisions are tested with no network and no key.
vi.mock('jose', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jose')>()
  return { ...actual, createRemoteJWKSet: vi.fn(() => 'keys'), jwtVerify: vi.fn() }
})

const CLIENT = 'test-client.apps.googleusercontent.com'
const verified = vi.mocked(jwtVerify)

const payload = (claims: Record<string, unknown>) =>
  verified.mockResolvedValue({ payload: claims, protectedHeader: { alg: 'RS256' } } as never)

const reasonOf = async (promise: Promise<unknown>) => {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  )
  expect(error).toBeInstanceOf(GoogleSignInError)
  return (error as GoogleSignInError).reason
}

beforeEach(() => {
  verified.mockReset()
})

describe('googleVerifier', () => {
  it('fetches the keys with the configured timeout, and checks issuer and audience', async () => {
    payload({ sub: '1', email: 'Player@Example.com', email_verified: true, name: 'Player' })
    const identity = await googleVerifier(CLIENT, 1234)('credential')
    expect(vi.mocked(createRemoteJWKSet)).toHaveBeenCalledWith(expect.any(URL), {
      timeoutDuration: 1234,
    })
    expect(verified).toHaveBeenCalledWith('credential', 'keys', {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: CLIENT,
    })
    expect(identity).toEqual({
      sub: '1',
      email: 'player@example.com',
      name: 'Player',
      picture: null,
    })
  })

  it('says Google could not be reached when fetching the keys times out', async () => {
    verified.mockRejectedValue(new errors.JWKSTimeout())
    expect(await reasonOf(googleVerifier(CLIENT, 5000)('credential'))).toBe('unreachable')
  })

  it('says Google could not be reached when the fetch fails outright', async () => {
    verified.mockRejectedValue(new TypeError('fetch failed'))
    expect(await reasonOf(googleVerifier(CLIENT, 5000)('credential'))).toBe('unreachable')
  })

  it('refuses a token that does not verify', async () => {
    verified.mockRejectedValue(new errors.JWTExpired('expired', {}))
    expect(await reasonOf(googleVerifier(CLIENT, 5000)('credential'))).toBe('invalid')
  })

  it('refuses an address Google has not verified', async () => {
    payload({ sub: '1', email: 'player@example.com', email_verified: false })
    expect(await reasonOf(googleVerifier(CLIENT, 5000)('credential'))).toBe('unverified-email')
  })

  it('refuses a token that names no account', async () => {
    payload({ email: 'player@example.com', email_verified: true })
    expect(await reasonOf(googleVerifier(CLIENT, 5000)('credential'))).toBe('invalid')
  })
})
