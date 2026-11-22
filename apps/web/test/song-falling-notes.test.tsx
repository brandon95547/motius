import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildSong, type SongNote } from '@motius/shared'
import { SongFallingNotes } from '@/features/keyboard/SongFallingNotes'
import { fallingClock } from '@/state/falling-store'
import { useKeyboardStore } from '@/state/keyboard-store'
import { useLearningStore } from '@/state/learning-store'
import { useSongStore } from '@/state/song-store'
import { useViewStore } from '@/state/view-store'
import { sizeEverything } from './layout-size'

/**
 * A song's falling notes: the part played, drawn as an exercise's are, moved
 * by the song's own clock — the playhead while it plays, wait mode in Learn.
 */

// Four beats shown in a field 400 high: a hundred pixels a beat.
sizeEverything({ width: 1200, height: 400 })

const note = (
  pitch: number,
  startMs: number,
  hand: 'left' | 'right',
  finger: number,
): SongNote => ({
  note: pitch,
  velocity: 80,
  startMs,
  durationMs: 1000,
  hand,
  role: 'keyboard',
  finger,
})

// At 60 bpm a beat is a second: C and E in the right hand, then a C below in the left.
const song = buildSong({
  id: 'falling',
  title: 'Falling',
  bpm: 60,
  beatsPerMeasure: 4,
  notes: [note(60, 0, 'right', 1), note(64, 1000, 'right', 3), note(48, 2000, 'left', 5)],
  source: 'musicxml',
  handsInferred: false,
})

const open = (settings: Partial<ReturnType<typeof useSongStore.getState>> = {}) => {
  useSongStore.setState({
    library: [song],
    currentId: song.id,
    mode: 'listen',
    part: 'both',
    positionMs: 0,
    stepIndex: 0,
    learning: false,
    playing: false,
    tempoScale: 1,
    ...settings,
  })
  return render(<SongFallingNotes />)
}

const bars = () => [...document.querySelectorAll<HTMLElement>('.falling__note')]
const track = () => document.querySelector<HTMLElement>('.falling__track')!
const frame = () => act(() => new Promise<void>((done) => requestAnimationFrame(() => done())))

beforeEach(() => {
  useKeyboardStore.getState().panic()
  useViewStore.setState({ window: { low: 48, high: 72 } })
  useLearningStore.getState().setTopic('songs')
  useLearningStore.getState().setKeyLabels('fingers')
})
afterEach(cleanup)

describe('SongFallingNotes', () => {
  it('draws every note of the part played, on its beat, with its hand and finger', () => {
    open()
    expect(bars().map((bar) => bar.style.getPropertyValue('--start'))).toEqual(['0', '1', '2'])
    expect(bars().map((bar) => bar.dataset.hand)).toEqual(['right', 'right', 'left'])
    expect(bars().map((bar) => bar.textContent)).toEqual(['1', '3', '5'])
  })

  it('draws only the hand being learned', () => {
    open({ part: 'left' })
    expect(bars().map((bar) => bar.dataset.hand)).toEqual(['left'])
  })

  it('stands where the playhead stands', async () => {
    open({ positionMs: 2000 })
    await frame()
    expect(fallingClock.now).toBe(2)
    expect(track().style.transform).toBe('translateY(200px)')
  })

  it('in Learn, marks the step asked for and the steps played', () => {
    open({ mode: 'learn', learning: true, stepIndex: 1 })
    expect(bars().map((bar) => bar.dataset.done)).toEqual(['true', 'false', 'false'])
    expect(bars().map((bar) => bar.dataset.now)).toEqual(['false', 'true', 'false'])
  })

  it('in Learn, falls no further than the step asked for', async () => {
    open({ mode: 'learn', learning: true, stepIndex: 1, positionMs: 3000 })
    await frame()
    expect(fallingClock.now).toBeLessThanOrEqual(1)
  })

  it('lights the bar of a held key at the line, and glows above it', () => {
    open({ mode: 'learn', learning: true, stepIndex: 0 })
    act(() => useKeyboardStore.getState().noteOn(60, 80, 'pointer'))
    expect(bars()[0]!.dataset.lit).toBe('true')
    expect(document.querySelectorAll('.falling__glow')).toHaveLength(1)
  })

  it('in Practice, rings each step as it was judged, and marks the one missed', () => {
    open({ mode: 'practice', practice: { step: 2, reached: [], results: ['late', 'missed'] } })
    expect(bars().map((bar) => bar.dataset.timing)).toEqual(['late', undefined, undefined])
    expect(bars().map((bar) => bar.dataset.missed)).toEqual(['false', 'true', 'false'])
    expect(bars().map((bar) => bar.dataset.done)).toEqual(['true', 'false', 'false'])
  })

  it('waits for Practice to begin with its lead-in above the keys', async () => {
    open({ mode: 'practice' })
    await frame()
    expect(fallingClock.now).toBe(-4)
  })
})
