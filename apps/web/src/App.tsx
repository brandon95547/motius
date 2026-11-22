import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiClientError } from '@/lib/api'
import { lazyExport } from '@/ui/OnDemand'
import { useAccountStore } from '@/state/account-store'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A 4xx means this build asked for something wrong; retrying changes
      // nothing except the size of the log. One retry for the transient case,
      // not two: each attempt can burn the full request timeout, and three
      // attempts is half a minute of a spinner before anyone is told anything.
      retry: (failureCount, error) =>
        failureCount < 1 && (!(error instanceof ApiClientError) || error.isTransient),
      refetchOnWindowFocus: false,
    },
  },
})

/*
 * The entry is only this: who is signed in. The sign-in page and the app are
 * each their own chunk, so the sign-in page does not carry the app. The app
 * starts loading at once, beside the check, since most visits are signed in.
 */
const loadApp = () => import('@/components/SignedInApp')
const SignedInApp = lazyExport(loadApp, 'SignedInApp')
const SignInPage = lazyExport(() => import('@/features/account/SignInPage'), 'SignInPage')

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SignedIn />
    </QueryClientProvider>
  )
}

/**
 * Motius is for signed-in players: the sign-in page until someone is, and the
 * app once they are. Nothing behind it — the sound, the keyboard, the player's
 * history — starts before then.
 */
function SignedIn() {
  const status = useAccountStore((state) => state.status)
  const check = useAccountStore((state) => state.check)
  React.useEffect(() => {
    void check()
    void loadApp().catch(() => {
      // Fetched again, with its error shown, when it is rendered.
    })
  }, [check])
  return (
    <React.Suspense fallback={null}>
      {status === 'signed-in' ? <SignedInApp /> : <SignInPage />}
    </React.Suspense>
  )
}
