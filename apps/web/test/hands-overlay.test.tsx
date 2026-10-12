import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildSong, type SongNote } from '@motius/shared'
import { HandsOverlay } from '@/features/hands/HandsOverlay'
import { buildLayout, keyCenterPercent } from '@/features/keyboard/keyboard-layout'
import { useKeyboardStore } from '@/state/keyboard-store'
import { useLearningStore } from '@/state/learning-store'
import { useSongStore } from '@/state/song-store'

/**
 * The hands over the keys.
 *
 * What is pinned is what they are for: with the switch on, and a song that has
 * a fingering, each finger of the step is drawn on its key, and it shows as
 * down when the key is. And what they are not: there with the switch off, or
 * for a song nobody fingered, or for the hand that is not being played.
 */

// jsdom lays nothing out, and the hands are drawn in the keybed's own pixels:
// on a keybed of no size there is nothing to draw them on.
const BED = { width: 1500, height: 150 }
class SizedObserver {
  constructor(private readonly notify: ResizeObserverCallback) {}
  observe(target: Element) {
    this.notify(
      [{ target, contentRect: BED } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    )
  }
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = SizedObserver as unknown as typeof ResizeObserver
Element.prototype.getBoundingClientRect = function () {
  return { ...BED, top: 0, left: 0, right: BED.width, bottom: BED.height, x: 0, y: 0 } as DOMRect
}

// Asked for no motion, a hand is simply where it is to be, which is also what
// a test wants: where it ends up, not the tenth of a second on the way.
globalThis.matchMedia = ((query: string) => ({
  matches: query.includes('prefers-reduced-motion'),
  media: query,
  addEventListener: () => {},
  removeEventListener: () => {},
})) as unknown as typeof globalThis.matchMedia

// Two octaves from C3: fifteen white keys, a hundred pixels each.
const layout = buildLayout({ low: 48, high: 72 })
const keyX = (key: number) => (keyCenterPercent(layout, key) / 100) * BED.width

const note = (
  pitch: number,
  startMs: number,
  durationMs: number,
  hand: 'left' | 'right',
  finger?: number,
): SongNote => ({
  note: pitch,
  velocity: 80,
  startMs,
  durationMs,
  hand,
  role: 'keyboard',
  ...(finger === undefined ? {} : { finger }),
})

/** A C major chord in the right hand over a C in the left, then both move. */
const fingered = [
  note(48, 0, 1000, 'left', 5),
  note(60, 0, 1000, 'right', 1),
  note(64, 0, 1000, 'right', 3),
  note(67, 0, 1000, 'right', 5),
  note(50, 1000, 1000, 'left', 4),
  note(66, 1000, 1000, 'right', 3),
]

const open = (
  notes: SongNote[],
  settings: Partial<ReturnType<typeof useSongStore.getState>> = {},
) => {
  const song = buildSong({
    id: 'hands',
    title: 'Hands',
    bpm: 60,
    beatsPerMeasure: 4,
    notes,
    source: 'musicxml',
    handsInferred: false,
  })
  useSongStore.setState({
    library: [song],
    currentId: song.id,
    mode: 'learn',
    part: 'both',
    positionMs: 0,
    stepIndex: 0,
    playing: false,
    hands: true,
    ...settings,
  })
  return render(<HandsOverlay layout={layout} />)
}

const hand = (container: HTMLElement, which: 'left' | 'right') =>
  container.querySelector<SVGGElement>(`.hand[data-hand="${which}"]`)!
/** A finger's tip across the keys, in pixels, and what the finger is doing. */
const finger = (container: HTMLElement, which: 'left' | 'right', number: number) => {
  const group = hand(container, which).querySelector<SVGGElement>(`[data-finger="${number}"]`)!
  return {
    x: Number(group.querySelector('.hand__tip')!.getAttribute('cx')),
    y: Number(group.querySelector('.hand__tip')!.getAttribute('cy')),
    doing: group.dataset.state,
  }
}

beforeEach(() => {
  useKeyboardStore.getState().panic()
  useLearningStore.getState().setTopic('songs')
})
afterEach(cleanup)

describe('the hands over the keys', () => {
  it('puts each finger of the step on its key, and the rest where the hand would have them', () => {
    const { container } = open(fingered)

    // The right hand's one, three and five on C, E and G…
    expect(finger(container, 'right', 1).x).toBeCloseTo(keyX(60), 3)
    expect(finger(container, 'right', 3).x).toBeCloseTo(keyX(64), 3)
    expect(finger(container, 'right', 5).x).toBeCloseTo(keyX(67), 3)
    // …and its two and four over the keys between, on neither.
    expect(finger(container, 'right', 2).x).toBeCloseTo(keyX(62), 3)
    expect(finger(container, 'right', 4).x).toBeCloseTo(keyX(65), 3)
    expect([1, 2, 3, 4, 5].map((each) => finger(container, 'right', each).doing)).toEqual([
      'ready',
      'idle',
      'ready',
      'idle',
      'ready',
    ])
    // The left hand's little finger is on its C, an octave down.
    expect(finger(container, 'left', 5).x).toBeCloseTo(keyX(48), 3)
    expect(finger(container, 'left', 5).doing).toBe('ready')
  })

  it('shows a finger down when its key is, and up again when it is let go', () => {
    const { container } = open(fingered)
    act(() => useKeyboardStore.getState().noteOn(64, 80, 'midi'))
    expect(finger(container, 'right', 3).doing).toBe('down')
    expect(finger(container, 'right', 1).doing).toBe('ready')

    act(() => useKeyboardStore.getState().noteOff(64))
    expect(finger(container, 'right', 3).doing).toBe('ready')
  })

  it('moves to the next step with the player, further in for a black key', () => {
    const { container } = open(fingered)
    const before = finger(container, 'right', 3)
    act(() => useSongStore.getState().advance(1))

    // The same finger, now on the F sharp: across to it and up onto it.
    const after = finger(container, 'right', 3)
    expect(after.x).toBeCloseTo(keyX(66), 3)
    expect(after.y).toBeLessThan(before.y)
    expect(finger(container, 'left', 4).x).toBeCloseTo(keyX(50), 3)
  })

  it('follows the playhead when the song is being played to you', () => {
    const { container } = open(fingered, { mode: 'explore' })
    expect(finger(container, 'left', 5).x).toBeCloseTo(keyX(48), 3)

    act(() => useSongStore.getState().seek(1500))
    expect(finger(container, 'left', 4).x).toBeCloseTo(keyX(50), 3)
    expect(finger(container, 'right', 3).x).toBeCloseTo(keyX(66), 3)
  })

  it('draws only the hand being played', () => {
    const { container } = open(fingered, { part: 'right' })
    expect(hand(container, 'right').style.display).toBe('')
    expect(hand(container, 'left').style.display).toBe('none')
  })

  it('is not there with the switch off, or for a song nobody fingered', () => {
    expect(open(fingered, { hands: false }).container.querySelector('.hands')).toBeNull()
    cleanup()
    const bare = fingered.map(({ finger: _finger, ...rest }) => rest)
    expect(open(bare).container.querySelector('.hands')).toBeNull()
  })

  it('takes no pointer and says nothing to a screen reader: the keys under it are still the keys', () => {
    const { container } = open(fingered)
    expect(container.querySelector('.hands')!.getAttribute('aria-hidden')).toBe('true')
  })
})
