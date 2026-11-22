import {
  API_PREFIX,
  type AddedRuns,
  type ApiError,
  type AuthConfig,
  type Device,
  type DeviceIdentity,
  type Goals,
  type Instrument,
  type Instruments,
  type LessonSettings,
  type NewRun,
  type RegisteredDevice,
  type ResetResult,
  type ResetScope,
  type Runs,
  type SetSongCategoryInput,
  type SongCategoryChoice,
  type UpdateDeviceConfigInput,
  type User,
} from '@motius/shared'

/**
 * The API client.
 *
 * The server checks what it is sent, and what it sends back, against the
 * shared schemas (each route's `body` and `response`), so a reply is typed
 * from those schemas here and not checked again: the browser does not carry
 * zod (`docs/adr/0009-responses-checked-on-the-server.md`). The API and the
 * app are built and deployed from this one repository, together.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? API_PREFIX

/**
 * How long a request may hang before it is treated as a failure.
 *
 * `fetch` has no timeout of its own. A server that accepts the connection and
 * then never answers — a wedged process, a listening socket nobody is reading,
 * a proxy pointing at nothing — leaves the promise pending for ever. What the
 * player sees is not an error but a spinner that never stops: the app says
 * "Loading pianos…" and keeps saying it, with nothing in the UI to explain why
 * and no retry ever attempted.
 *
 * Six seconds is far longer than any request here should take — these are
 * local reads of a handful of rows — and far shorter than "never".
 */
const REQUEST_TIMEOUT_MS = 6_000

/**
 * Combines the caller's cancellation with the timeout.
 *
 * `AbortSignal.any` is the modern spelling; the manual fallback keeps the
 * timeout working on anything that predates it, because a browser without
 * `any` is exactly the sort that would otherwise hang for ever.
 */
function withTimeout(signal: AbortSignal | undefined): {
  signal: AbortSignal
  release: () => void
} {
  const timeout = AbortSignal.timeout?.(REQUEST_TIMEOUT_MS)
  if (!timeout) return { signal: signal ?? new AbortController().signal, release: () => {} }
  if (!signal) return { signal: timeout, release: () => {} }

  if (typeof AbortSignal.any === 'function') {
    return { signal: AbortSignal.any([signal, timeout]), release: () => {} }
  }

  const controller = new AbortController()
  const abort = () => controller.abort()
  signal.addEventListener('abort', abort, { once: true })
  timeout.addEventListener('abort', abort, { once: true })
  return {
    signal: controller.signal,
    release: () => signal.removeEventListener('abort', abort),
  }
}

export class ApiClientError extends Error {
  readonly status: number
  readonly code: string
  readonly details: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.code = code
    this.details = details
  }

  /** True when retrying might work: a network blip or a 5xx. */
  get isTransient(): boolean {
    return this.status === 0 || this.status >= 500
  }
}

/**
 * What to do when the server says nobody is signed in: the sign-in ran out, or
 * was ended elsewhere. The account store sets it, so a 401 from anywhere puts
 * the sign-in page back up rather than leaving a screen of failed requests.
 */
let onSignedOut: (() => void) | null = null
export function whenSignedOut(handler: () => void) {
  onSignedOut = handler
}

async function request<T>(path: string, init?: RequestInit & { signal?: AbortSignal }): Promise<T> {
  const { signal, release } = withTimeout(init?.signal)

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal,
      headers: {
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
        accept: 'application/json',
        ...init?.headers,
      },
    })
  } catch (error) {
    // A caller that cancelled deliberately is not a failure to report.
    if (init?.signal?.aborted) throw error

    // fetch rejects only for network-level failures. Status 0 marks "we never
    // reached the server", which the UI treats differently from a 4xx.
    const timedOut = (error as Error)?.name === 'TimeoutError'
    throw new ApiClientError(
      0,
      timedOut ? 'timeout' : 'network_error',
      timedOut
        ? 'The Motius server accepted the connection but did not answer. Is the API still running?'
        : 'Could not reach the Motius server.',
      error,
    )
  } finally {
    release()
  }

  if (response.status === 204) return null as T

  const payload: unknown = await response.json().catch(() => undefined)

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/')) onSignedOut?.()
    const error = errorOf(payload)
    throw error
      ? new ApiClientError(response.status, error.code, error.message, error.details)
      : new ApiClientError(
          response.status,
          'unexpected_error',
          `Request failed (${response.status}).`,
        )
  }

  // Not JSON at all: a proxy's error page, or something that is not the API.
  if (payload === undefined) {
    throw new ApiClientError(
      response.status,
      'unreadable_response',
      `The server sent a response this build cannot read (${path}).`,
    )
  }
  return payload as T
}

/** The server's error (`ApiError`), where a failed reply carries one. */
function errorOf(payload: unknown): ApiError['error'] | null {
  const error = (payload as Partial<ApiError> | null | undefined)?.error
  return typeof error?.code === 'string' && typeof error.message === 'string' ? error : null
}

export type { RegisteredDevice as RegisterDeviceResponse }

export const api = {
  /** What the sign-in page needs: the Google client id, if the server has one. */
  authConfig: (signal?: AbortSignal) => request<AuthConfig>('/auth/config', { signal }),

  /** Who is signed in; a 401 for nobody. */
  me: (signal?: AbortSignal) => request<User>('/auth/me', { signal }),

  /** Signs in, or up, with the credential Google's button hands the page. */
  signInWithGoogle: (credential: string) =>
    request<User>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    }),

  signOut: () => request<null>('/auth/sign-out', { method: 'POST' }),

  /** The player's weekly goal, and the badges they have seen unlock. */
  goals: (signal?: AbortSignal) => request<Goals>('/goals', { signal }),

  /** Sets the weekly goal: so many runs at 90% or better a week; null clears it. */
  setWeeklyGoal: (weeklyGoal: number | null) =>
    request<Goals>('/goals/weekly', {
      method: 'PUT',
      body: JSON.stringify({ weeklyGoal }),
    }),

  /** Notes badges whose unlock the player has been shown. */
  seeBadges: (badges: readonly string[]) =>
    request<Goals>('/goals/seen', {
      method: 'POST',
      body: JSON.stringify({ badges }),
    }),

  /** How each lesson opens, where an admin has set it. */
  listLessonSettings: (signal?: AbortSignal) =>
    request<{ items: LessonSettings[] }>('/lessons/settings', { signal }),

  /** Sets how a lesson opens, for everybody (admins only). */
  setLessonSettings: (settings: LessonSettings) =>
    request<LessonSettings>('/lessons/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),

  /** The signed-in player's finished runs, oldest first, and when the lessons were last started over. */
  listRuns: (signal?: AbortSignal) => request<Runs>('/runs', { signal }),

  /** Starts over: the lessons only, keeping the history, or everything. */
  resetProgress: (scope: ResetScope) =>
    request<ResetResult>('/runs/reset', {
      method: 'POST',
      body: JSON.stringify({ scope }),
    }),

  /** Keeps finished runs with the player's account. */
  addRuns: (runs: readonly NewRun[]) =>
    request<AddedRuns>('/runs', { method: 'POST', body: JSON.stringify({ runs }) }),

  listInstruments: (signal?: AbortSignal) => request<Instruments>('/instruments', { signal }),

  listDevices: (signal?: AbortSignal) => request<{ items: Device[] }>('/devices', { signal }),

  registerDevice: (identity: DeviceIdentity) =>
    request<RegisteredDevice>('/devices', {
      method: 'POST',
      body: JSON.stringify(identity),
    }),

  updateDeviceConfig: (id: string, patch: UpdateDeviceConfigInput) =>
    request<Device>(`/devices/${encodeURIComponent(id)}/config`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  resetDeviceConfig: (id: string) =>
    request<Device>(`/devices/${encodeURIComponent(id)}/config/reset`, { method: 'POST' }),

  forgetDevice: (id: string) =>
    request<null>(`/devices/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  /** The built-in songs whose genre or moods have been changed, and what to. */
  listSongCategories: (signal?: AbortSignal) =>
    request<{ items: SongCategoryChoice[] }>('/songs/categories', { signal }),

  /** Changes a song's genre, its moods, or both; what is left out stays as it was. */
  setSongCategory: (songId: string, change: SetSongCategoryInput) =>
    request<SongCategoryChoice>(`/songs/${encodeURIComponent(songId)}/category`, {
      method: 'PATCH',
      body: JSON.stringify(change),
    }),
}

export type { Device, Instrument }
