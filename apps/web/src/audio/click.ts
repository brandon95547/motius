import { sleepWhenQuiet, type Quiet } from './quiet'

/**
 * A metronome click, made rather than sampled: no asset, no load, no failure
 * mode.
 *
 * Its own AudioContext, deliberately apart from the piano's. The click is a
 * timing aid, not part of the performance, so it must not be caught by the
 * piano's volume, recorded into a take, or silenced when the instrument
 * reloads. The sound effects share it, for the same reasons.
 */
let context: AudioContext | null = null
let quiet: Quiet | null = null

export function clickContext(): AudioContext | null {
  try {
    if (!context) {
      context = new AudioContext()
      // A click every few seconds at most, and a cue now and then: asleep the
      // rest of the time, like the piano's (see `sleepWhenQuiet`).
      quiet = sleepWhenQuiet(context)
    }
    return context
  } catch {
    return null
  }
}

/** A click or a cue is about to sound, and lasts `forMs`: the context is woken for it. */
export function wakeClickContext(forMs = 0) {
  clickContext()
  quiet?.wake(forMs)
}

/** One click, now or at `when` on the click context's clock. Accented on the bar. */
export function click(accented: boolean, when?: number) {
  try {
    const audio = clickContext()
    if (!audio) return
    const at = when ?? audio.currentTime
    wakeClickContext(Math.max(0, at - audio.currentTime) * 1000 + 100)
    const oscillator = audio.createOscillator()
    const gain = audio.createGain()
    oscillator.frequency.value = accented ? 1600 : 1100
    gain.gain.setValueAtTime(accented ? 0.16 : 0.09, at)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.05)
    oscillator.connect(gain).connect(audio.destination)
    oscillator.start(at)
    oscillator.stop(at + 0.06)
  } catch {
    // A metronome that will not start is not a reason to stop the music.
  }
}
