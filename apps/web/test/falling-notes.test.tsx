import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type * as React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FallingNotes } from '@/features/keyboard/FallingNotes'
import { PlayControls } from '@/components/PlayControls'
import { AudioProvider } from '@/audio/AudioProvider'
import { MidiProvider } from '@/midi/MidiProvider'
import { buildLayout } from '@/lib/keyboard-layout'
import { fallingClock, useFallingStore } from '@/state/falling-store'
import { useKeyboardStore } from '@/state/keyboard-store'
import { useHandsReminder } from '@/state/hands-reminder'
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
 * Space, and moved through by a drag.
 */

// Four beats shown in a field 400 high: a hundred pixels a beat.
sizeEverything({ width: 1200, height: 400 })

// With the system asking for less motion — as the player's does — the notes
// still fall: falling notes were chosen, and falling is what they are.
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
/** The field under the bar whose Play Space presses, and anything else wanted beside them. */
const withBar = (extra?: React.ReactNode) => {
  act(() => useViewStore.getState().setStageView('falling'))
  return render(
    <AudioProvider>
      <QueryClientProvider client={new QueryClient()}>
        <MidiProvider>
          <PlayControls />
        </MidiProvider>
      </QueryClientProvider>
      <FallingNotes />
      {extra}
    </AudioProvider>,
  )
}
/** How the step at this beat was played, by its bars' ring. */
const timing = (beat: number) =>
  notes().find((bar) => bar.style.getPropertyValue('--start') === String(beat))!.dataset.timing

beforeEach(() => {
  // Which hand is which is its own test's (`hands-reminder.test.tsx`): here Start starts.
  useHandsReminder.setState({ show: false })
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
    useFallingStore.setState({ paused: false, playedAt: {} })
    useViewStore.getState().setStageView('staff')
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
    // A lane line up from every white key's edge, stronger where an octave begins.
    const whites = buildLayout(useViewStore.getState().window).whiteKeys
    const lanes = [...document.querySelectorAll<HTMLElement>('.falling__lane')]
    expect(lanes).toHaveLength(whites.length - 1)
    expect(lanes.filter((lane) => lane.dataset.octave === 'true')).toHaveLength(
      whites.slice(1).filter((key) => key.note % 12 === 0).length,
    )
    // Each bar says its finger, whatever the keys are labeled with: the
    // keyboard names the key, the bar says how to play it.
    const label = (note: HTMLElement) => note.querySelector('.falling__label')!.textContent
    expect(label(first)).toBe('4')
    for (const keyLabels of ['notes', 'degrees', 'off'] as const) {
      act(() => learning().setKeyLabels(keyLabels))
      expect(label(notes()[0]!)).toBe('4')
    }
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
    // Quick, so the fall from one group to the next takes a quarter of a second.
    act(() => learning().setTargetBpm(240))
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
    // Falling, not stepping, even with Reduce Motion on: partway after a frame.
    await frame()
    await frame()
    const partway = Number(/translateY\(([-\d.]+)px\)/.exec(track().style.transform)![1])
    expect(partway).toBeGreaterThan(0)
    expect(partway).toBeLessThan(100)
    await waitFor(() => expect(track().style.transform).toBe('translateY(100px)'))
    const now = notes().filter((note) => note.dataset.now === 'true')
    // The two keys of the next group, each with its finger.
    expect(now.map((note) => note.querySelector('.falling__label')!.textContent)).toEqual([
      '4',
      '3',
    ])
    // The keys they fall to are asked for in the hand's color.
    expect(learning().annotations[49]).toMatchObject({ role: 'target', hand: 'left' })
    expect(notes().filter((note) => note.dataset.done === 'true')).toHaveLength(2)
  })

  it('stays up with nothing written to fall: the lanes, and a glow over every key held', () => {
    act(() => learning().setLesson(null))
    render(<FallingNotes />)
    expect(document.querySelector('.falling')).not.toBeNull()
    expect(document.querySelectorAll('.falling__lane').length).toBeGreaterThan(0)
    expect(notes()).toHaveLength(0)
    act(() => useKeyboardStore.getState().noteOn(42, 80, 'pointer'))
    expect(document.querySelectorAll('.falling__glow[data-free="true"]')).toHaveLength(1)
    act(() => learning().setLesson('two-black-key-groups'))
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

  it('lights the note the demonstration is playing in Listen, without counting it as played', () => {
    act(() => learning().setMode('listen'))
    render(<FallingNotes />)
    // As the demonstration does it: the step it is on, and its keys held.
    act(() => {
      learning().setDemoStep(0)
      useKeyboardStore.getState().noteOn(37, 80, 'pointer')
    })
    const lit = notes().filter((note) => note.dataset.lit === 'true')
    expect(lit.map((note) => note.style.getPropertyValue('--start'))).toEqual(['0'])
    expect(document.querySelectorAll('.falling__glow[data-hand="left"]')).toHaveLength(1)
    expect(learning().session.completedSteps).toBe(0)
    act(() => {
      useKeyboardStore.getState().noteOff(37)
      learning().setDemoStep(null)
      learning().setMode('learn')
    })
    expect(notes().filter((note) => note.dataset.lit === 'true')).toHaveLength(0)
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

    // The second goes by unplayed, the third — the right hand's first, at the
    // top of the keyboard — is played late.
    clock.mockReturnValue(6 * beatMs + 300)
    await waitFor(() => expect(learning().session.missedSteps).toEqual([1]))
    press(85)
    press(87)
    await frame()
    expect(timing(2)).toBe('late')
    const second = notes().filter((note) => note.style.getPropertyValue('--start') === '1')
    expect(second.every((note) => note.dataset.missed === 'true')).toBe(true)
  })

  it('pauses on a tap or Space (the bar’s Play), and goes on from where it stopped', () => {
    withBar()
    act(() => learning().start())
    fireEvent.pointerDown(field(), { clientY: 200, pointerId: 1 })
    fireEvent.pointerUp(field(), { clientY: 201, pointerId: 1 })
    expect(useFallingStore.getState().paused).toBe(true)
    expect(document.querySelector('.falling-controls__paused')).not.toBeNull()
    fireEvent.keyDown(document.body, { code: 'Space' })
    expect(useFallingStore.getState().paused).toBe(false)
  })

  it('pauses on Space even with focus left on a button the mouse pressed, without pressing it', () => {
    const stop = vi.fn()
    withBar(
      <button type="button" onClick={stop}>
        Stop
      </button>,
    )
    act(() => learning().start())
    const button = screen.getByRole('button', { name: 'Stop' })
    fireEvent.pointerDown(button)
    button.focus()
    fireEvent.keyDown(button, { code: 'Space', key: ' ' })
    fireEvent.keyUp(button, { code: 'Space', key: ' ' })
    expect(useFallingStore.getState().paused).toBe(true)
    expect(stop).not.toHaveBeenCalled()
    expect(learning().session.status).toBe('running')

    // Reached by Tab, the button is the keyboard's: Space is left to press it.
    fireEvent.keyDown(button, { code: 'Tab', key: 'Tab' })
    fireEvent.keyDown(button, { code: 'Space', key: ' ' })
    expect(useFallingStore.getState().paused).toBe(true)
  })

  it('goes on from exactly where it was paused, not from the top', async () => {
    act(() => learning().setMode('practice'))
    const beatMs = 60_000 / learning().targetBpm
    const clock = vi.spyOn(Date, 'now').mockReturnValue(0)
    const stop = vi.fn()
    withBar(
      <button type="button" onClick={stop}>
        Stop
      </button>,
    )
    act(() => learning().start())
    await frame()
    // Into the run, three beats: the first two groups gone by, the third coming.
    clock.mockReturnValue(7 * beatMs)
    await frame()
    const at = learning().session.stepIndex
    const paused = fallingClock.now
    expect(at).toBeGreaterThan(0)

    const button = screen.getByRole('button', { name: 'Stop' })
    fireEvent.pointerDown(button)
    button.focus()
    fireEvent.keyDown(button, { code: 'Space', key: ' ' })
    fireEvent.keyUp(button, { code: 'Space', key: ' ' })
    clock.mockReturnValue(30 * beatMs)
    await frame()
    expect(fallingClock.now).toBe(paused)

    fireEvent.keyDown(button, { code: 'Space', key: ' ' })
    fireEvent.keyUp(button, { code: 'Space', key: ' ' })
    await frame()
    expect(stop).not.toHaveBeenCalled()
    expect(learning().session.stepIndex).toBe(at)
    expect(fallingClock.now).toBeCloseTo(paused, 5)
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

  it('starts again from the top on Again after a run, and after Stop and Start', async () => {
    act(() => learning().setMode('practice'))
    const beatMs = 60_000 / learning().targetBpm
    const clock = vi.spyOn(Date, 'now').mockReturnValue(0)
    render(<FallingNotes />)
    act(() => learning().start())
    await frame()
    // Let every group go by: the run ends, all missed.
    clock.mockReturnValue(40 * beatMs)
    await waitFor(() => expect(learning().session.status).toBe('complete'))

    // Again: a fresh run from the first group, with its lead-in, nothing missed.
    clock.mockReturnValue(50 * beatMs)
    act(() => learning().start())
    await frame()
    await frame()
    expect(learning().session).toMatchObject({ status: 'running', stepIndex: 0 })
    expect(learning().session.missedSteps).toEqual([])
    expect(track().style.transform).toBe('translateY(-400px)')

    // Paused, stopped, started: running, not paused.
    act(() => useFallingStore.getState().setPaused(true))
    act(() => learning().reset())
    act(() => learning().start())
    await frame()
    expect(useFallingStore.getState().paused).toBe(false)
    expect(learning().session.missedSteps).toEqual([])
  })

  it('makes the bar’s button Pause and Go on during a run, with the way back to the start beside it', () => {
    act(() => useViewStore.getState().setStageView('falling'))
    render(
      <AudioProvider>
        <QueryClientProvider client={new QueryClient()}>
          <MidiProvider>
            <PlayControls />
          </MidiProvider>
        </QueryClientProvider>
      </AudioProvider>,
    )
    const start = screen.getByRole('button', { name: 'Start' })
    fireEvent.click(start)
    expect(learning().session.status).toBe('running')

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    expect(useFallingStore.getState().paused).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Go on' }))
    expect(useFallingStore.getState().paused).toBe(false)
    expect(learning().session.status).toBe('running')

    fireEvent.click(screen.getByRole('button', { name: 'Back to the start' }))
    expect(learning().session.status).toBe('idle')
    expect(screen.getByRole('button', { name: 'Start' })).toBeDefined()
    act(() => useViewStore.getState().setStageView('staff'))
  })
})
