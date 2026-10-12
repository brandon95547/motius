import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HIDDEN_QUIET_MS, QUIET_MS, sleepWhenQuiet } from '@/audio/quiet'

/**
 * An audio context that sleeps when nothing is asked of it.
 *
 * A running context renders silence at full price. What is pinned is when it
 * is put down and what wakes it — and that one sounding, or one the browser
 * has not let start yet, is left alone.
 */

/** A context as far as sleeping goes: its state, and what was asked of it. */
const fakeContext = (state: AudioContextState = 'running') => {
  const context = {
    state,
    asked: [] as string[],
    suspend: vi.fn(async () => {
      context.asked.push('suspend')
      context.state = 'suspended'
    }),
    resume: vi.fn(async () => {
      context.asked.push('resume')
      context.state = 'running'
    }),
  }
  return context
}

const hide = (hidden: boolean) => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  hide(false)
  vi.useRealTimers()
})

describe('an audio context with nothing to play', () => {
  it('is put to sleep a minute after the last sound, and not before', () => {
    const context = fakeContext()
    const quiet = sleepWhenQuiet(context)
    quiet.wake()

    vi.advanceTimersByTime(QUIET_MS - 1000)
    expect(context.asked).toEqual([])
    vi.advanceTimersByTime(1000)
    expect(context.asked).toEqual(['suspend'])
    quiet.dispose()
  })

  it('is woken by the next sound, and stays up for as long as that lasts and the wait after', () => {
    const context = fakeContext()
    const quiet = sleepWhenQuiet(context)
    vi.advanceTimersByTime(QUIET_MS)
    expect(context.state).toBe('suspended')

    // A note four seconds long.
    quiet.wake(4000)
    expect(context.asked).toEqual(['suspend', 'resume'])
    vi.advanceTimersByTime(QUIET_MS + 3000)
    expect(context.state).toBe('running')
    vi.advanceTimersByTime(1000)
    expect(context.state).toBe('suspended')
    quiet.dispose()
  })

  it('is kept up by every sound in turn, so it never sleeps between the notes of someone playing', () => {
    const context = fakeContext()
    const quiet = sleepWhenQuiet(context)
    for (let note = 0; note < 20; note++) {
      quiet.wake()
      vi.advanceTimersByTime(QUIET_MS / 2)
    }
    expect(context.asked).toEqual([])
    quiet.dispose()
  })

  it('does not sleep while a key is held, however long, and does a minute after it is let go', () => {
    const context = fakeContext()
    let held = true
    const quiet = sleepWhenQuiet(context, () => held)
    vi.advanceTimersByTime(QUIET_MS * 5)
    expect(context.asked).toEqual([])

    held = false
    vi.advanceTimersByTime(QUIET_MS * 2)
    expect(context.asked).toEqual(['suspend'])
    quiet.dispose()
  })

  it('sleeps within seconds once the page is hidden and nothing is playing', () => {
    const context = fakeContext()
    const quiet = sleepWhenQuiet(context)
    quiet.wake()
    vi.advanceTimersByTime(10_000)
    hide(true)
    expect(context.asked).toEqual([])
    vi.advanceTimersByTime(HIDDEN_QUIET_MS)
    expect(context.asked).toEqual(['suspend'])
    quiet.dispose()
  })

  it('goes on playing in a hidden page for as long as there is something to play', () => {
    const context = fakeContext()
    const quiet = sleepWhenQuiet(context)
    hide(true)
    // A song: a note handed over every half second.
    for (let note = 0; note < 40; note++) {
      quiet.wake(600)
      vi.advanceTimersByTime(500)
    }
    expect(context.asked).toEqual([])
    quiet.dispose()
  })

  it('leaves alone a context the browser has not let start, and asks for it when sound is wanted', () => {
    const context = fakeContext('suspended')
    const quiet = sleepWhenQuiet(context)
    vi.advanceTimersByTime(QUIET_MS * 2)
    // Never running, so never put down.
    expect(context.suspend).not.toHaveBeenCalled()
    quiet.wake()
    expect(context.asked).toEqual(['resume'])
    quiet.dispose()
  })

  it('does nothing more once it is done with', () => {
    const context = fakeContext()
    const quiet = sleepWhenQuiet(context)
    quiet.dispose()
    vi.advanceTimersByTime(QUIET_MS * 2)
    quiet.wake()
    expect(context.asked).toEqual([])
  })
})
