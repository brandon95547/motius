import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildSong, fingerSong, type Song, type SongNote } from '@motius/shared'
import { AudioProvider } from '@/audio/AudioProvider'
import { SongEngine } from '@/features/songs/SongControls'
import { useLearningStore } from '@/state/learning-store'
import { useCurrentSong, useSongStore } from '@/state/song-store'

/**
 * The open song is fingered by the fingering system that is chosen.
 *
 * A song is fingered when it is read. Change the system afterwards and the
 * scales in it are the other school's, and a song kept from before every note
 * was fingered has gaps in it. Both are put right for the song that is open,
 * and what the score itself printed is never among the things that change.
 */

const note = (pitch: number, index: number, extra: Partial<SongNote> = {}): SongNote => ({
  note: pitch,
  velocity: 90,
  startMs: index * 250,
  durationMs: 200,
  hand: 'left',
  role: 'keyboard',
  ...extra,
})

/** G major up two octaves in the left hand: the run the two systems finger differently. */
const G_MAJOR = [43, 45, 47, 48, 50, 52, 54, 55, 57, 59, 60, 62, 64, 66, 67]

const piece = (notes: SongNote[]): Song =>
  buildSong({
    id: 'run',
    title: 'A run',
    bpm: 120,
    beatsPerMeasure: 4,
    notes,
    source: 'musescore',
    handsInferred: false,
    key: { pitchClass: 7, mode: 'major', fifths: 1, declared: true },
  })

let seen: Song | null = null
function Watch() {
  seen = useCurrentSong()
  return null
}

const mount = () =>
  render(
    <AudioProvider>
      <SongEngine />
      <Watch />
    </AudioProvider>,
  )

const fingers = (song: Song | null) => song!.notes.map((n) => n.finger).join('')

beforeEach(() => {
  useLearningStore.getState().setFingeringSystem('traditional')
  useSongStore.setState({ library: [], builtIn: [], currentId: null })
  seen = null
})
afterEach(() => useLearningStore.getState().setFingeringSystem('traditional'))

describe('the open song and the fingering system', () => {
  it('is fingered again when the system is changed, and back when it is changed back', () => {
    const song = fingerSong(piece(G_MAJOR.map((pitch, i) => note(pitch, i))))
    act(() => useSongStore.getState().openBuiltIn(song))
    mount()
    expect(fingers(seen)).toBe('543213214321321')

    act(() => useLearningStore.getState().setFingeringSystem('natural'))
    expect(seen!.fingeredBy).toBe('natural')
    // The left hand's 4th finger on F♯.
    expect(fingers(seen).slice(0, 13)).toBe('3213214321321')

    act(() => useLearningStore.getState().setFingeringSystem('traditional'))
    expect(fingers(seen)).toBe('543213214321321')
  })

  it('keeps the score’s own fingers through the change', () => {
    // The editor's 2 on the first note, which neither system would put there.
    const marked = G_MAJOR.map((pitch, i) => note(pitch, i, i === 0 ? { finger: 2 } : {}))
    act(() => useSongStore.getState().openBuiltIn(fingerSong(piece(marked))))
    mount()
    expect(seen!.notes[0]).toMatchObject({ finger: 2, fingerGiven: true })

    act(() => useLearningStore.getState().setFingeringSystem('natural'))
    expect(seen!.fingeredBy).toBe('natural')
    expect(seen!.notes[0]).toMatchObject({ finger: 2, fingerGiven: true })
    expect(seen!.notes.filter((n) => n.fingerGiven)).toHaveLength(1)
    expect(seen!.fingeringSource).toBe('mixed')
  })

  it('fills the gaps in a song kept from before every note was fingered', () => {
    // As an older Motius left it: some notes fingered, some not, and nothing
    // to say which system did it.
    const old: Song = {
      ...piece(G_MAJOR.map((pitch, i) => note(pitch, i, i < 5 ? { finger: 5 - i } : {}))),
      hasFingering: true,
      fingeringSource: 'derived',
    }
    act(() => useSongStore.getState().add(old))
    mount()
    expect(seen!.notes.every((n) => n.finger !== undefined)).toBe(true)
    expect(seen!.fingeredBy).toBe('traditional')
    // Motius's own earlier guesses are not mistaken for the score's.
    expect(seen!.notes.some((n) => n.fingerGiven)).toBe(false)
    // And it is kept that way, not worked out again on every visit.
    expect(useSongStore.getState().library[0]!.fingeredBy).toBe('traditional')
  })
})
