/**
 * Lets an audio context sleep when nothing has been asked of it for a while.
 *
 * A running context renders audio whether there is any or not. Measured in
 * Chromium with the piano loaded and nobody playing, the two contexts the app
 * has cost five percent of a processor between them, for as long as the page
 * is open: silence, computed a few hundred times a second. Suspended, the
 * page costs a tenth of a percent. On a phone that is also the audio hardware
 * kept awake, and the battery with it.
 *
 * So a context is suspended once nothing has been heard from it for a minute,
 * and woken by whatever next wants a sound. Waking takes a few milliseconds
 * to a few tens, which is why the wait is a minute and not a second: it is
 * paid once, by the first note after a long pause, and never between the
 * notes of someone practising. With the page hidden and nothing playing there
 * is nobody to keep it ready for, and it sleeps after a few seconds.
 *
 * A context that has never run — one the browser is holding until the first
 * touch — is left as it is. `wake` asks for it to start, which is what was
 * asked before this existed, and the browser starts it when it will.
 */

/** How long after the last sound a context is still kept running. */
export const QUIET_MS = 60_000
/** The same, with the page hidden: nobody is about to press a key. */
export const HIDDEN_QUIET_MS = 5_000

export interface Quiet {
  /**
   * A sound is wanted, now or lasting `forMs` from now: the context is woken,
   * and its sleep put off until that long has passed and then the wait.
   */
  wake(forMs?: number): void
  dispose(): void
}

export function sleepWhenQuiet(
  context: Pick<AudioContext, 'state' | 'resume' | 'suspend'>,
  /** Something is sounding with no end known — a key held down — so this is no time to sleep. */
  stillSounding: () => boolean = () => false,
): Quiet {
  /** When the last thing asked for is over, on the page's clock. */
  let busyUntil = performance.now()
  let timer: ReturnType<typeof setTimeout> | undefined
  let disposed = false

  const hidden = () => typeof document !== 'undefined' && document.hidden
  const wait = () => (hidden() ? HIDDEN_QUIET_MS : QUIET_MS)

  const look = () => {
    timer = undefined
    if (disposed) return
    if (stillSounding()) busyUntil = performance.now()
    const left = busyUntil + wait() - performance.now()
    if (left > 0) {
      timer = setTimeout(look, left)
      return
    }
    // Only one that is running. A context the browser has not let start is
    // not ours to put down, and one already asleep needs nothing.
    if (context.state === 'running') void context.suspend?.().catch(() => {})
  }
  const arm = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(look, Math.max(0, busyUntil + wait() - performance.now()))
  }

  // Hidden, the wait is shorter: look again by the new one.
  const onVisibility = () => {
    if (!disposed && hidden()) arm()
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)

  arm()
  return {
    wake(forMs = 0) {
      if (disposed) return
      busyUntil = Math.max(busyUntil, performance.now() + Math.max(0, forMs))
      if (context.state === 'suspended') void context.resume?.().catch(() => {})
      arm()
    },
    dispose() {
      disposed = true
      if (timer !== undefined) clearTimeout(timer)
      if (typeof document !== 'undefined')
        document.removeEventListener('visibilitychange', onVisibility)
    },
  }
}
