import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { songSteps, type Song, type SongNote } from '@sonara/shared'
import { readSongBytes } from '@/features/songs/read-song'
import { alignLayers, layersOf, measureScore, regionsOf } from '@/features/staff/score'

/**
 * Whose notes they are, in the pieces where it is hardest to say.
 *
 * Sonara teaches the piano, and a hand taught wrong is learned wrong. A score
 * says which hand in few ways and none of them is the staff: a right hand runs
 * onto the lower staff and is still the right hand, and one voice can be shared
 * between two hands. So a note keeps the hand of the line of music it belongs
 * to, nothing is handed to the other hand on a guess, and wherever the score
 * has not settled it the note says so (`handSuggested`).
 *
 * These are the built-in pieces that test it, each read the way the chooser
 * reads it and held to what was checked against the page.
 */

const read = (id: string): Song => {
  const file = path.join(import.meta.dirname, '..', 'public', 'songs', `${id}.mxl`)
  const result = readSongBytes(new Uint8Array(readFileSync(file)), id)
  if (!('song' in result)) throw new Error(`${id} could not be read: ${result.failure}`)
  return result.song
}
const played = (song: Song) => song.notes.filter((note) => note.role === 'keyboard')
const count = (song: Song, test: (note: SongNote) => boolean) => played(song).filter(test).length
/** The voices whose notes are in more than one hand. */
const sharedVoices = (song: Song) => {
  const hands = new Map<number, Set<string>>()
  for (const note of played(song))
    hands.set(note.voice!, (hands.get(note.voice!) ?? new Set<string>()).add(note.hand))
  return [...hands].filter(([, of]) => of.size > 1).map(([voice]) => voice)
}

/** What holds of every one of them, whatever its notes. */
const PIECES = [
  'beethoven-moonlight-sonata-1',
  'beethoven-moonlight-sonata-3',
  'debussy-clair-de-lune',
  'debussy-clair-de-lune-2',
  'rachmaninoff-prelude-op-3-no-2',
  'beethoven-pathetique-sonata-1',
  'beethoven-pathetique-sonata-2',
] as const

describe.each(PIECES)('%s', (id) => {
  const song = read(id)

  it('keeps every line of music in one hand', () => {
    expect(sharedVoices(song)).toEqual([])
  })

  it('never calls a note on its own hand’s staff a suggestion, and always one on the other’s', () => {
    // On a piano's usual two staves a note says where it is written only when
    // that is not its hand's own staff, which is exactly when the hand is a reading.
    if (song.staves) return
    for (const note of played(song))
      expect(note.handSuggested === true, `${note.note} at ${Math.round(note.startMs)}`).toBe(
        note.staff !== undefined,
      )
  })

  it('counts what it has marked as suggested', () => {
    expect(song.handsSuggested ?? 0).toBe(count(song, (note) => note.handSuggested === true))
  })

  it('draws, with every chord in its place', () => {
    const steps = songSteps(song, 'both')
    const pairs = layersOf(song.staves)
    const measured = pairs
      ? alignLayers(
          pairs.map((pair) => measureScore({ ...song, beams: true }, steps, undefined, pair)),
        ).outline
      : measureScore({ ...song, beams: true }, steps)
    // Every chord of the song is on the page, in order, and nothing is on it twice.
    expect(
      measured.filter((entry) => entry.step.notes.length > 0).map((entry) => entry.step),
    ).toEqual(steps)
    expect(measured.every((entry, at) => at === 0 || entry.index > measured[at - 1]!.index)).toBe(
      true,
    )
    expect(measured.every((entry) => Number.isFinite(entry.gap) && entry.gap >= 0)).toBe(true)
  })
})

describe('the Moonlight Sonata, first movement', () => {
  const song = read('beethoven-moonlight-sonata-1')

  it('gives the triplets to the right hand where they are written on the lower staff', () => {
    expect(played(song)).toHaveLength(1144)
    expect(count(song, (note) => note.hand === 'right')).toBe(899)
    expect(count(song, (note) => note.hand === 'left')).toBe(245)
    // 274 notes of the right hand's two voices are on the lower staff: a reading, and said to be.
    expect(count(song, (note) => note.hand === 'right' && note.staff === 2)).toBe(274)
    expect(count(song, (note) => note.hand === 'left' && note.staff !== undefined)).toBe(0)
    expect(song.handsSuggested).toBe(274)
  })

  it('leaves the left hand its octaves and nothing of the triplets', () => {
    // The left hand's part is the bass line: never more than two notes at once, an octave apart.
    for (const step of songSteps(song, 'left')) {
      expect(step.notes.length).toBeLessThanOrEqual(3)
      const pitches = step.notes.map((note) => note.note)
      expect(Math.max(...pitches) - Math.min(...pitches)).toBeLessThanOrEqual(12)
    }
  })

  it('beams each crossing triplet as one', () => {
    const measured = measureScore({ ...song, beams: true }, songSteps(song, 'both'))
    expect(measured.filter((entry) => entry.cross).length).toBe(177)
  })
})

describe('the Moonlight Sonata, third movement', () => {
  const song = read('beethoven-moonlight-sonata-3')

  it('keeps each hand’s runs its own on the other staff', () => {
    expect(played(song)).toHaveLength(4900)
    expect(count(song, (note) => note.hand === 'right')).toBe(2614)
    expect(count(song, (note) => note.hand === 'left')).toBe(2286)
    expect(count(song, (note) => note.hand === 'right' && note.staff === 2)).toBe(284)
    expect(count(song, (note) => note.hand === 'left' && note.staff === 1)).toBe(48)
    expect(song.handsSuggested).toBe(332)
  })
})

describe('Clair de Lune', () => {
  it('keeps the left hand’s arpeggios the left hand’s when they climb onto the upper staff', () => {
    const song = read('debussy-clair-de-lune')
    expect(played(song)).toHaveLength(1518)
    expect(count(song, (note) => note.hand === 'right')).toBe(645)
    expect(count(song, (note) => note.hand === 'left')).toBe(873)
    expect(count(song, (note) => note.hand === 'left' && note.staff === 1)).toBe(120)
    expect(count(song, (note) => note.hand === 'right' && note.staff === 2)).toBe(4)
    expect(song.handsSuggested).toBe(124)
  })

  it('reads the other engraving of it the same way', () => {
    const song = read('debussy-clair-de-lune-2')
    expect(played(song)).toHaveLength(1511)
    expect(count(song, (note) => note.hand === 'left' && note.staff === 1)).toBe(141)
    expect(count(song, (note) => note.hand === 'right' && note.staff === 2)).toBe(1)
    expect(song.handsSuggested).toBe(142)
  })
})

describe('Rachmaninoff’s Prelude in C-sharp Minor', () => {
  const song = read('rachmaninoff-prelude-op-3-no-2')

  it('has its hands from the page, which names them: nothing about them is a reading', () => {
    expect(song.parts).toEqual(['Piano, Right Hand', 'Piano, Left Hand'])
    expect(song.handsSuggested).toBeUndefined()
    expect(played(song)).toHaveLength(1717)
    expect(count(song, (note) => note.hand === 'right')).toBe(943)
    expect(count(song, (note) => note.hand === 'left')).toBe(774)
  })

  it('is on four staves, the right hand’s pair above the left’s', () => {
    expect(song.staves).toBe(4)
    for (const note of played(song))
      expect(note.hand, `staff ${note.staff}`).toBe(note.staff! <= 2 ? 'right' : 'left')
  })

  it('goes from two staves to four at bar 45, and ends on its last bar', () => {
    const steps = songSteps(song, 'both')
    const pairs = layersOf(song.staves)!
    const { outline } = alignLayers(
      pairs.map((pair) => measureScore({ ...song, beams: true }, steps, undefined, pair)),
    )
    const regions = regionsOf(song, outline, pairs)
    expect(
      regions.map((region) => [outline[region.from]!.bar, outline[region.to - 1]!.bar]),
    ).toEqual([
      [0, 44],
      [45, 61],
    ])
    expect(regions.map((region) => region.rows)).toEqual([
      [
        { treble: true, bass: false },
        { treble: false, bass: true },
      ],
      [
        { treble: true, bass: true },
        { treble: true, bass: true },
      ],
    ])
  })
})

describe('the Pathétique', () => {
  it('has three notes of the right hand on the lower staff in the first movement, and says so', () => {
    const song = read('beethoven-pathetique-sonata-1')
    expect(played(song)).toHaveLength(4300)
    expect(count(song, (note) => note.hand === 'right')).toBe(2050)
    expect(count(song, (note) => note.hand === 'left')).toBe(2250)
    expect(count(song, (note) => note.hand === 'right' && note.staff === 2)).toBe(3)
    expect(song.handsSuggested).toBe(3)
  })

  it('keeps each hand to its own staff in the second movement', () => {
    const song = read('beethoven-pathetique-sonata-2')
    expect(played(song)).toHaveLength(1640)
    expect(count(song, (note) => note.hand === 'right')).toBe(1052)
    expect(count(song, (note) => note.hand === 'left')).toBe(588)
    expect(song.handsSuggested).toBeUndefined()
    expect(played(song).every((note) => note.staff === undefined)).toBe(true)
  })
})
