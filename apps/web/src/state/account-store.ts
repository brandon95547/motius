import { create } from 'zustand'
import type { User } from '@motius/shared'
import { api, ApiClientError, whenSignedOut } from '@/lib/api'

/**
 * Who is signed in. Motius is for signed-in players only: until this says
 * `signed-in`, the app shows the sign-in page and nothing else.
 *
 * - `checking`: asking the server, on load.
 * - `signed-out`: nobody, or the sign-in ran out (any 401 lands here).
 * - `unreachable`: the server could not be asked; the page says so and offers
 *   to try again, rather than a sign-in button that cannot work.
 */
export type AccountStatus = 'checking' | 'signed-out' | 'signed-in' | 'unreachable'

interface AccountState {
  status: AccountStatus
  user: User | null
  /** Why the last sign-in did not work, in a sentence for the page. */
  error: string | null
  check: () => Promise<void>
  signIn: (credential: string) => Promise<void>
  signOut: () => Promise<void>
}

const messageOf = (error: unknown, fallback: string) =>
  error instanceof ApiClientError ? error.message : fallback

export const useAccountStore = create<AccountState>((set) => ({
  status: 'checking',
  user: null,
  error: null,

  check: async () => {
    set({ status: 'checking', error: null })
    try {
      set({ status: 'signed-in', user: await api.me() })
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        set({ status: 'signed-out', user: null })
      } else {
        console.error('Motius could not ask the server who is signed in.', error)
        set({ status: 'unreachable', user: null })
      }
    }
  },

  signIn: async (credential) => {
    set({ error: null })
    try {
      set({ status: 'signed-in', user: await api.signInWithGoogle(credential) })
    } catch (error) {
      console.error('Sign-in with Google did not work.', error)
      set({ error: messageOf(error, 'That sign-in did not work. Try again.') })
    }
  },

  signOut: async () => {
    try {
      await api.signOut()
    } catch (error) {
      // Signed out here all the same: the cookie runs out on its own.
      console.error('Motius could not end the sign-in on the server.', error)
    }
    set({ status: 'signed-out', user: null })
  },
}))

whenSignedOut(() => useAccountStore.setState({ status: 'signed-out', user: null }))

/** Whether the one signed in is an admin. */
export const useIsAdmin = () => useAccountStore((state) => state.user?.isAdmin === true)
