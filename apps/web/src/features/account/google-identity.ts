/**
 * Google's sign-in button ("Sign in with Google", Google Identity Services).
 *
 * Google's script is loaded only by the sign-in page, the first time it is
 * shown, and never by the app behind it. The button hands back an ID token,
 * which the server checks; nothing about the account passes through here.
 */

const SCRIPT_URL = 'https://accounts.google.com/gsi/client'

interface GoogleIdentityServices {
  initialize: (options: {
    client_id: string
    callback: (response: { credential?: string }) => void
    ux_mode?: 'popup' | 'redirect'
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
  }) => void
  renderButton: (parent: HTMLElement, options: Record<string, string | number>) => void
  disableAutoSelect: () => void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentityServices } }
  }
}

let loading: Promise<GoogleIdentityServices> | null = null

/** Google's script, loaded once; rejects if it cannot be fetched. */
export function loadGoogleIdentity(): Promise<GoogleIdentityServices> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id)
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () =>
      window.google?.accounts?.id
        ? resolve(window.google.accounts.id)
        : reject(new Error('Google sign-in loaded without its API.'))
    script.onerror = () => {
      loading = null
      script.remove()
      reject(new Error('Google sign-in could not be loaded.'))
    }
    document.head.append(script)
  })
  return loading
}

/** Draws Google's button into an element; its credential goes to `onCredential`. */
export async function renderGoogleButton(
  parent: HTMLElement,
  clientId: string,
  onCredential: (credential: string) => void,
): Promise<void> {
  const google = await loadGoogleIdentity()
  google.initialize({
    client_id: clientId,
    ux_mode: 'popup',
    callback: ({ credential }) => {
      if (credential) onCredential(credential)
    },
  })
  google.renderButton(parent, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'pill',
    logo_alignment: 'left',
    width: Math.min(320, parent.clientWidth || 320),
  })
}

/** After signing out: Google's button does not sign the same account straight back in. */
export function forgetGoogleChoice() {
  window.google?.accounts?.id?.disableAutoSelect()
}
