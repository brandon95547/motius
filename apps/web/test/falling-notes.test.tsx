import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FallingNotes } from '@/features/keyboard/FallingNotes'
import { buildLayout } from '@/features/keyboard/keyboard-layout'
import { useLearningStore } from '@/state/learning-store'
import { useViewStore } from '@/state/view-store'
import { sizeEverything } from './layout-size'

/**
 * Falling notes.
 *
 * What is pinned is what makes them readable: each note in its key's column
 * and as wide as the key, in its hand's color with its finger; Learn bringing
 * the next notes down to the keys and holding them there; and Practice judging
 * each step against when it reached the keys.
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
  act(() => learning().reset())
})

describe('falling notes', () => {
  it('draws every note in its key’s column, as wide as the key, with its hand and finger', () => {
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
    expect(first.textContent).toBe('3')
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
    await waitFor(() => expect(track().style.transform).toBe('translateY(0px)'))
    expect(notes().filter((note) => note.dataset.now === 'true')).toHaveLength(2)

    press(37)
    // Half a group is not the group: still waiting.
    await new Promise((done) => requestAnimationFrame(done))
    expect(track().style.transform).toBe('translateY(0px)')
    press(39)
    await waitFor(() => expect(track().style.transform).toBe('translateY(100px)'))
    const now = notes().filter((note) => note.dataset.now === 'true')
    expect(now.map((note) => note.textContent)).toEqual(['3', '2'])
    // The group just played flashes and fades at the keys.
    expect(notes().filter((note) => note.dataset.done === 'true')).toHaveLength(2)
  })

  it('marks a step in Practice on time, early or late against when it reached the keys', () => {
    act(() => learning().setMode('practice'))
    const beatMs = 60_000 / learning().targetBpm
    const clock = vi.spyOn(Date, 'now').mockReturnValue(0)
    act(() => learning().start())
    render(<FallingNotes />)

    // The first group is due after the four-beat lead-in; the second a beat later.
    clock.mockReturnValue(4 * beatMs + 40)
    press(37)
    press(39)
    clock.mockReturnValue(5 * beatMs + 140)
    press(49)
    press(51)
    expect(timing(0)).toBe('on-time')
    expect(timing(1)).toBe('on-time')
  })

  it('lets a step go by unplayed in Practice: missed, and the run moves on to the next', async () => {
    act(() => learning().setMode('practice'))
    const beatMs = 60_000 / learning().targetBpm
    const clock = vi.spyOn(Date, 'now').mockReturnValue(0)
    act(() => learning().start())
    render(<FallingNotes />)

    // Past the second group's beat, and the first never played.
    clock.mockReturnValue(5 * beatMs + 300)
    await waitFor(() => expect(learning().session.missedSteps).toEqual([0]))
    expect(learning().session.stepIndex).toBe(1)
    const first = notes().filter((note) => note.style.getPropertyValue('--start') === '0')
    expect(first.every((note) => note.dataset.missed === 'true')).toBe(true)

    // The next group, played late but before it too goes by.
    press(49)
    press(51)
    expect(timing(1)).toBe('late')
  })
})
