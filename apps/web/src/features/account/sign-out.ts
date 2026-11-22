import { useAccountStore } from '@/state/account-store'
import { forgetGoogleChoice } from './google-identity'

/**
 * Signs out, here and with Google's button: the next visit asks which account
 * rather than signing the same one straight back in.
 */
export async function signOut() {
  forgetGoogleChoice()
  await useAccountStore.getState().signOut()
}
