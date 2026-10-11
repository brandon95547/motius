import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildSong, type SongNote, type SongSection } from '@sonara/shared'
import { useKeyboardStore } from '@/state/keyboard-store'
import { useSongStore } from '@/state/song-store'

/**
 * A song playing itself.
 *
 * What is pinned is when each note sounds and when it is let go, because both
 * were once wrong in ways nothing on screen showed. A note repeated the moment
 * the last one ended was released by the earlier note's timer and never
 * sounded, and every note was struck by a timer on the page's own thread, so
 * it waited for whatever the page was drawing.
 *
 * A note's sound is handed to the audio clock ahead of time, with how long
 * from now it is to begin. So the moment a note sounds is the moment it was
 * handed over plus that wait, and that is what `soundsAt` works out.
 */

/** The audio the song is played through: a clock that is running unless a case says it is not. */
const audio = {
  noteOn: vi.fn(),
  noteOff: vi.fn(),
  play: vi.fn((..._note: number[]) => true),
  stopPlayed: vi.fn(),
}
vi.mock('@/audio/AudioProvider', () => ({ useAudio: () => audio }))

const note = (pitch: number, startMs: number, durationMs: number): SongNote => ({
  note: pitch,
  velocity: 90,
  startMs,
  durationMs,
  hand: 'right',
  role: 'keyboard',
})

const play = async (notes: SongNote[], sections?: readonly SongSection[]) => {
  const song = buildSong({
    id: 'played',
    title: 'Played',
    bpm: 120,
    beatsPerMeasure: 4,
    notes,
    source: 'midi',
    handsInferred: false,
    ...(sections ? { sections } : {}),
  })
  const { useSongPlayback } = await import('@/features/songs/use-song-playback')
  useSongStore.setState({ library: [song], currentId: song.id, positionMs: 0, tempoScale: 1 })
  renderHook(() => useSongPlayback(song))
  act(() => useSongStore.getState().setPlaying(true))
  return performance.now()
}

/** When the note a `noteOn` call asks for begins: now, plus the wait it was given. */
const soundsAt = (start: number, afterMs?: number) =>
  Math.round(performance.now() - start + (afterMs ?? 0))

beforeEach(() => {
  vi.useFakeTimers()
  audio.noteOn.mockReset()
  audio.noteOff.mockReset()
  audio.stopPlayed.mockReset()
  audio.play.mockReset()
  audio.play.mockImplementation(() => true)
})

afterEach(() => {
  act(() => useSongStore.getState().setPlaying(false))
  cleanup()
  vi.useRealTimers()
})

describe('a song playing itself', () => {
  it('sounds each note when it is due, and lights its key then', async () => {
    const sounded: number[] = []
    const lit: number[] = []
    audio.play.mockImplementation((_pitch: number, _velocity: number, afterMs: number) => {
      sounded.push(soundsAt(start, afterMs))
      return true
    })
    const start = performance.now()
    await play([note(60, 110, 100), note(62, 260, 100), note(64, 410, 100)])
    const stop = useKeyboardStore.subscribe((state, before) => {
      if (state.lastNote !== before.lastNote) lit.push(Math.round(performance.now() - start))
    })

    act(() => vi.advanceTimersByTime(600))
    stop()

    // The clock looks every 25ms, so 110, 260 and 410 all fall between looks.
    expect(sounded).toEqual([110, 260, 410])
    expect(lit).toEqual([110, 260, 410])
    // And nothing was struck by hand: the audio clock had all three.
    expect(audio.noteOn).not.toHaveBeenCalled()
    expect(audio.noteOff).not.toHaveBeenCalled()
  })

  it('hands a note to the audio clock ahead of its moment, so a busy page cannot delay it', async () => {
    const handedOver: number[][] = []
    audio.play.mockImplementation((...given: number[]) => {
      handedOver.push([Math.round(performance.now() - start), ...given])
      return true
    })
    const start = performance.now()
    await play([note(60, 200, 100)])

    // Handed over whole as play begins, two hundred milliseconds early: the
    // key, how hard, how long from now, and how long it lasts. How hard is the
    // written 90 brought toward mezzo-forte — see the next test.
    expect(handedOver).toEqual([[0, 60, 85, 200, 100]])
  })

  it('sounds a score over half its written range, and lights the keys as written', async () => {
    // Pianissimo, mezzo-forte, fortissimo. An instrument's loudness goes by
    // the square of the velocity, so as written the first is twenty decibels
    // under the last: one cannot be heard, or the other is too loud.
    const written = [33, 80, 112]
    const lit: number[] = []
    const stop = useKeyboardStore.subscribe((state) => {
      for (const index of written.keys()) {
        const held = state.active[60 + index]
        if (held && lit[index] === undefined) lit[index] = held.velocity
      }
    })
    await play(
      written.map((velocity, index) => ({ ...note(60 + index, index * 100, 50), velocity })),
    )
    act(() => vi.advanceTimersByTime(400))
    stop()

    const sounded = audio.play.mock.calls.map(([, velocity]) => velocity as number)
    expect(sounded).toEqual([51, 80, 95])
    // The key shows the dynamic the score wrote, soft notes paler.
    expect(lit).toEqual(written)
  })

  it('calls off a note it has promised when the song is stopped before its moment', async () => {
    await play([note(60, 200, 100)])
    expect(audio.play).toHaveBeenCalledTimes(1)
    act(() => vi.advanceTimersByTime(100))
    audio.stopPlayed.mockClear()
    act(() => useSongStore.getState().setPlaying(false))
    expect(audio.stopPlayed).toHaveBeenCalled()
  })

  it('does not let a repeated note go with the timer of the note before it', async () => {
    // With no audio clock to hand the notes to — before the first key press —
    // the song strikes and releases each one itself, and has to get the order
    // right when the same key comes round again.
    audio.play.mockImplementation(() => false)
    const events: string[] = []
    const start = performance.now()
    audio.noteOn.mockImplementation(() => events.push(`on ${soundsAt(start)}`))
    audio.noteOff.mockImplementation(() => events.push(`off ${soundsAt(start)}`))
    // The same key twice, the second struck the moment the first is due to end.
    await play([note(60, 100, 200), note(60, 300, 200)])

    act(() => vi.advanceTimersByTime(700))

    // Struck, struck again — let go first so the instrument hears a new note —
    // and released once, by the second strike, when the second note ends.
    expect(events).toEqual(['on 100', 'off 300', 'on 300', 'off 500'])
  })

  it('plays a repeated passage again from the same notes, and the first note of each stretch', async () => {
    const struck: string[] = []
    // Two notes on the page, played C D, C again, and that is all: a first
    // ending on D, stepped over the second time.
    const start = performance.now()
    audio.play.mockImplementation((pitch: number, _velocity: number, afterMs: number) => {
      struck.push(`${pitch} at ${soundsAt(start, afterMs)}`)
      return true
    })
    await play(
      [note(60, 0, 100), note(62, 500, 100)],
      [
        { startMs: 0, fromMs: 0, toMs: 1000 },
        { startMs: 1000, fromMs: 0, toMs: 500 },
      ],
    )

    act(() => vi.advanceTimersByTime(2000))

    expect(struck).toEqual(['60 at 0', '62 at 500', '60 at 1000'])
  })

  it('holds a key struck again while it is still down until the later note ends', async () => {
    audio.play.mockImplementation(() => false)
    const released: number[] = []
    const start = performance.now()
    audio.noteOff.mockImplementation(() => released.push(soundsAt(start)))
    await play([note(60, 100, 400), note(60, 200, 400)])

    act(() => vi.advanceTimersByTime(800))

    // Let go at 200 to be struck again, and then not until 600. The first
    // note's own ending, at 500, is no longer anybody's to act on.
    expect(released).toEqual([200, 600])
  })
})

/**
 * A key its hand has left.
 *
 * The first Gymnopédie's left hand: a bass note written to last the bar, and
 * a beat in, a chord far above it for the same hand. The note sounds on, in
 * the pedal. The key stayed lit for the bar all the same, under a hand that
 * was an octave and a half away.
 */
describe('a note that outlasts the hand on its key', () => {
  const down = () =>
    Object.keys(useKeyboardStore.getState().active)
      .map(Number)
      .sort((a, b) => a - b)
  const leftHand = (pitch: number, startMs: number, durationMs: number, finger: number) => ({
    ...note(pitch, startMs, durationMs),
    hand: 'left' as const,
    finger,
  })

  it('lets the key go when the hand strikes a chord out of reach, and the note sound on', async () => {
    await play([
      leftHand(43, 100, 900, 2),
      leftHand(59, 400, 600, 5),
      leftHand(62, 400, 600, 3),
      leftHand(66, 400, 600, 1),
    ])

    act(() => vi.advanceTimersByTime(300))
    expect(down()).toEqual([43])
    // The chord, and the bass key up with it: five hundred milliseconds
    // before its note is over.
    act(() => vi.advanceTimersByTime(200))
    expect(down()).toEqual([59, 62, 66])
    // The note was handed to the audio clock whole, and nothing has cut it short.
    expect(audio.play.mock.calls[0]).toEqual([43, 85, 100, 900])
    expect(audio.noteOff).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(600))
    expect(down()).toEqual([])
  })

  it('keeps the key down under a line the same hand can reach', async () => {
    // Held by the little finger while the index plays a sixth above it.
    await play([leftHand(48, 100, 900, 5), leftHand(57, 400, 300, 2)])

    act(() => vi.advanceTimersByTime(500))
    expect(down()).toEqual([48, 57])
    act(() => vi.advanceTimersByTime(300))
    expect(down()).toEqual([48])
  })

  it('lifts a key that is about to be struck again, long enough to be seen', async () => {
    // The same key twice, the second the moment the first ends: lit for as
    // long as each is written, that is one light from 100 to 500.
    await play([note(60, 100, 200), note(60, 300, 200)])

    act(() => vi.advanceTimersByTime(200))
    expect(down()).toEqual([60])
    // Up for the eighty milliseconds before it is struck again…
    act(() => vi.advanceTimersByTime(50))
    expect(down()).toEqual([])
    // …and down again as it is. Each note was handed over whole all the same.
    act(() => vi.advanceTimersByTime(75))
    expect(down()).toEqual([60])
    expect(audio.play.mock.calls.map(([, , , lasts]) => lasts)).toEqual([200, 200])

    act(() => vi.advanceTimersByTime(200))
    expect(down()).toEqual([])
  })

  it('lifts it for no more than two fifths of a quick repeat', async () => {
    // A hundred milliseconds apart: lit for sixty of them, up for forty.
    await play([note(60, 100, 100), note(60, 200, 100)])

    act(() => vi.advanceTimersByTime(150))
    expect(down()).toEqual([60])
    act(() => vi.advanceTimersByTime(25))
    expect(down()).toEqual([])
    act(() => vi.advanceTimersByTime(50))
    expect(down()).toEqual([60])
  })

  it('leaves a key lit to its end where the note that repeats it is not being played', async () => {
    // The left hand holds a key the right strikes again, and only the left is on.
    const { useSongStore: store } = await import('@/state/song-store')
    store.setState({ part: 'left' })
    await play([leftHand(60, 100, 400, 1), { ...note(60, 300, 100), finger: 1 }])

    act(() => vi.advanceTimersByTime(350))
    expect(down()).toEqual([60])
    act(() => vi.advanceTimersByTime(200))
    expect(down()).toEqual([])
    store.setState({ part: 'both' })
  })

  it('does not take a key from the note that has struck it again', async () => {
    // The bass, left for a chord at 400 — and struck again at 400 by the
    // other hand, whose note it now is until that one ends.
    await play([
      leftHand(43, 100, 900, 2),
      leftHand(59, 400, 300, 5),
      { ...note(43, 400, 300), finger: 1 },
    ])

    act(() => vi.advanceTimersByTime(500))
    expect(down()).toEqual([43, 59])
    act(() => vi.advanceTimersByTime(300))
    expect(down()).toEqual([])
  })
})
