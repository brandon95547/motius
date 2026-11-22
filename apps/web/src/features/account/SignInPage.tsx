import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAccountStore } from '@/state/account-store'
import { Button } from '@/ui/Button'
import logoUrl from '@/assets/motius-logo.svg'
import { forgetGoogleChoice, renderGoogleButton } from './google-identity'

/**
 * The way in. Motius is for signed-in players: before anything else, this
 * page, with Google's button. Signing up is signing in for the first time, so
 * there is one button for both.
 */
export function SignInPage() {
  const status = useAccountStore((state) => state.status)
  const error = useAccountStore((state) => state.error)
  const check = useAccountStore((state) => state.check)

  return (
    <main className="sign-in">
      <div className="sign-in__card">
        <img className="sign-in__logo" src={logoUrl} alt="" width={56} height={56} />
        <h1 className="sign-in__title">Welcome to Motius</h1>
        <p className="sign-in__line">Next level piano mastery. Sign in to start playing.</p>
        {status === 'checking' ? (
          <p className="sign-in__note" role="status">
            One moment…
          </p>
        ) : status === 'unreachable' ? (
          <>
            <p className="sign-in__error" role="alert">
              The Motius server could not be reached.
            </p>
            <Button variant="outlined" onClick={() => void check()}>
              Try again
            </Button>
          </>
        ) : (
          <GoogleButton />
        )}
        {error && (
          <p className="sign-in__error" role="alert">
            {error}
          </p>
        )}
        <p className="sign-in__note">New here? Continuing with Google makes your account.</p>
      </div>
    </main>
  )
}

function GoogleButton() {
  const signIn = useAccountStore((state) => state.signIn)
  const holder = React.useRef<HTMLDivElement>(null)
  const [failed, setFailed] = React.useState(false)
  const config = useQuery({
    queryKey: ['auth-config'],
    queryFn: ({ signal }) => api.authConfig(signal),
    staleTime: Infinity,
  })
  const clientId = config.data?.googleClientId

  React.useEffect(() => {
    if (!clientId || !holder.current) return
    forgetGoogleChoice()
    renderGoogleButton(holder.current, clientId, (credential) => void signIn(credential)).catch(
      (error: unknown) => {
        console.error(error)
        setFailed(true)
      },
    )
  }, [clientId, signIn])

  if (config.isError) {
    return (
      <p className="sign-in__error" role="alert">
        The sign-in could not be loaded. Reload the page to try again.
      </p>
    )
  }
  if (config.data && !clientId) {
    return (
      <p className="sign-in__error" role="alert">
        Sign-in with Google is not set up on this server yet.
      </p>
    )
  }
  if (failed) {
    return (
      <p className="sign-in__error" role="alert">
        Google’s sign-in could not be loaded. Check your connection, then reload the page.
      </p>
    )
  }
  // Google draws its button here; the box is its height, so nothing moves when it arrives.
  return <div ref={holder} className="sign-in__google" />
}
