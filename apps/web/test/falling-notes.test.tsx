import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FallingNotes } from '@/features/keyboard/FallingNotes'
import { buildLayout } from '@/features/keyboard/keyboard-layout'
import { fallingClock, useFallingStore } from '@/state/falling-store'
import { useKeyboardStore } from '@/state/keyboard-store'
import { useLearningStore } from '@/state/learning-store'
import { useViewStore } from '@/state/view-store'
import { sizeEverything } from './layout-size'

/**
 * Falling notes.
 *
 * What is pinned is what makes them readable and what makes them answer: each
 * note in its key's column and as wide as the key, in its hand's color with
 * its finger; Learn holding the next notes at the keys until they are played;
 * Practice judging each step against its beat, and moving on from one missed;
 * a note played right lit while it is held; and the field paused by a tap or
 * Space, moved through by a drag, and looped.
 */

// Four beats shown in a field 400 high: a hundred pixels a beat.
sizeEverything({ width: 1200, height: 400 })

// Asked for no motion, the notes step to where they are due on the next frame
// instead of falling there over a beat: where they end up is what is pinned.
const motion = globalThis.matchMedia
beforeEach(() => {
  globalThis.matchMedia = ((query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof globalThis.matchMedia
})
afterEach(() => {
  globalThis.matchMedia = motion
})

const learning = () => useLearningStore.getState()
const notes = () => [...document.querySelectorAll<HTMLElement>('.falling__note')]
const track = () => document.querySelector<HTMLElement>('.falling__track')!
const press = (note: number) => act(() => learning().noteOn(note))
/** A key held down and played, as the keyboard does it. */
const hold = (note: number) =>
  act(() => {
    useKeyboardStore.getState().noteOn(note, 80, 'pointer')
    learning().noteOn(note)
  })
const frame = () => act(() => new Promise<void>((done) => requestAnimationFrame(() => done())))
const field = () => document.querySelector<HTMLElement>('.falling')!
/** How the step at this beat was played, by its bars' ring. */
const timing = (beat: number) =>
  notes().find((bar) => bar.style.getPropertyValue('--start') === String(beat))!.dataset.timing

beforeEach(() => {
  act(() => {
    learning().setLesson('two-black-key-groups')
    learning().setTopic('lesson')
    learning().setMode('learn')
  })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  act(() => {
    learning().reset()
    useKeyboardStore.getState().panic()
    useFallingStore.setState({ paused: false, loop: null, playedAt: {} })
  })
})

describe('falling notes', () => {
  it('draws every note in its key’s column, as wide as the key, with its hand and label', () => {
    render(<FallingNotes />)
    const keys = buildLayout(useViewStore.getState().window).blackKeys
    const exercise = learning().exercise!
    expect(notes()).toHaveLength(exercise.notes.length)
    const first = notes()[0]!
    const csharp = keys.find((key) => key.note === 37)!
    expect(first.style.left).toBe(`${csharp.leftPercent}%`)
    expect(first.style.width).toBe(`${csharp.widthPercent}%`)
    expect(first.dataset.hand).toBe('left')
    expect(first.dataset.black).toBe('true')
    // Labeled as the keys are: the note's name by default, its finger if asked.
    expect(first.textContent).toBe('C♯')
    act(() => learning().setKeyLabels('fingers'))
    expect(notes()[0]!.textContent).toBe('3')
    act(() => learning().setKeyLabels('notes'))
    // A beat apart, each a beat long.
    expect(notes().map((note) => note.style.getPropertyValue('--start'))).toEqual([
      '0',
      '0',
      '1',
      '1',
      '2',
      '2',
      '3',
      '3',
      '4',
      '4',
    ])
  })

  it('falls to the keys in Learn and waits there until the step is played, then falls on', async () => {
    render(<FallingNotes />)
    act(() => learning().start())
    await frame()
    expect(track().style.transform).toBe('translateY(0px)')
    expect(notes().filter((note) => note.dataset.now === 'true')).toHaveLength(2)

    press(37)
    await frame()
    // Half a group is not the group: still waiting.
    expect(track().style.transform).toBe('translateY(0px)')
    press(39)
    await waitFor(() => expect(track().style.transform).toBe('translateY(100px)'))
    const now = notes().filter((note) => note.dataset.now === 'true')
    expect(now.map((note) => note.textContent)).toEqual(['C♯', 'D♯'])
    // The keys they fall to are asked for in the hand's color.
    expect(learning().annotations[49]).toMatchObject({ role: 'target', hand: 'left' })
    expect(notes().filter((note) => note.dataset.done === 'true')).toHaveLength(2)
  })

  it('lights a note played right, and the line above its key, for as long as it is held', () => {
    render(<FallingNotes />)
    act(() => learning().start())
    hold(37)
    // Lit at once, before the other key of the group is down.
    const lit = notes().filter((note) => note.dataset.lit === 'true')
    expect(lit.map((note) => note.style.getPropertyValue('--start'))).toEqual(['0'])
    expect(document.querySelectorAll('.falling__glow[data-hand="left"]')).toHaveLength(1)
    // A wrong key is no hit.
    hold(42)
    expect(document.querySelectorAll('.falling__glow')).toHaveLength(1)
    act(() => useKeyboardStore.getState().noteOff(37))
    expect(notes().filter((note) => note.dataset.lit === 'true')).toHaveLength(0)
    expect(document.querySelectorAll('.falling__glow')).toHaveLength(0)
  })

  it('judges each step in Practice against its beat, and moves on from one that went by', async () => {
    act(() => learning().setMode('practice'))
    const beatMs = 60_000 / learning().targetBpm
    const clock = vi.spyOn(Date, 'now').mockReturnValue(0)
    render(<FallingNotes />)
    act(() => learning().start())
    await frame()

    // The first group lands after the four-beat lead-in: played on it.
    clock.mockReturnValue(4 * beatMs + 40)
    await frame()
    press(37)
    press(39)
    await frame()
    expect(timing(0)).toBe('on-time')

    // The second goes by unplayed, the third is played late.
    clock.mockReturnValue(6 * beatMs + 300)
    await waitFor(() => expect(learning().session.missedSteps).toEqual([1]))
    press(61)
    press(63)
    await frame()
    expect(timing(2)).toBe('late')
    const second = notes().filter((note) => note.style.getPropertyValue('--start') === '1')
    expect(second.every((note) => note.dataset.missed === 'true')).toBe(true)
  })

  it('pauses on a tap or Space, and goes on from where it stopped', () => {
    render(<FallingNotes />)
    act(() => learning().start())
    fireEvent.pointerDown(field(), { clientY: 200, pointerId: 1 })
    fireEvent.pointerUp(field(), { clientY: 201, pointerId: 1 })
    expect(useFallingStore.getState().paused).toBe(true)
    expect(document.querySelector('.falling-controls__paused')).not.toBeNull()
    fireEvent.keyDown(document.body, { code: 'Space' })
    expect(useFallingStore.getState().paused).toBe(false)
  })

  it('moves through the music when dragged, and asks for the step it is left at', () => {
    render(<FallingNotes />)
    act(() => learning().start())
    // Two beats down: the music two groups on.
    fireEvent.pointerDown(field(), { clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(field(), { clientY: 300, pointerId: 1 })
    fireEvent.pointerUp(field(), { clientY: 300, pointerId: 1 })
    expect(fallingClock.now).toBe(2)
    expect(useFallingStore.getState().paused).toBe(true)
    expect(learning().session.stepIndex).toBe(2)
  })

  it('loops a stretch: past its end, the music goes back to its start', async () => {
    render(<FallingNotes />)
    act(() => {
      useFallingStore.getState().setLoop({ from: 1, to: 3 })
      learning().start()
      learning().seekStep(1)
    })
    for (const [low, high] of [
      [49, 51],
      [61, 63],
    ]) {
      press(low!)
      press(high!)
    }
    await waitFor(() => expect(learning().session.stepIndex).toBe(1))
    expect(document.querySelector('.falling__loop')).not.toBeNull()
  })
})
