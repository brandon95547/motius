import { describe, expect, it } from 'vitest'
import { keyReleases, keysLeftFor } from './key-holds.js'
import { buildSong, type SongNote } from './song.js'

const note = (
  pitch: number,
  startMs: number,
  durationMs: number,
  extra: Partial<SongNote> = {},
): SongNote => ({
  note: pitch,
  velocity: 80,
  startMs,
  durationMs,
  hand: 'left',
  role: 'keyboard',
  ...extra,
})

const song = (notes: SongNote[]) =>
  buildSong({
    id: 'x',
    title: 'x',
    bpm: 60,
    beatsPerMeasure: 3,
    notes,
    source: 'musicxml',
    handsInferred: false,
  })

/** The moment each key comes up early, by pitch: `{ 43: 1000 }`. */
const left = (notes: SongNote[]) =>
  Object.fromEntries([...keyReleases(song(notes))].map(([each, at]) => [each.note, at]))

/**
 * When a hand has gone from a key that is still sounding.
 *
 * The first Gymnopédie, as its score has it and as Sonara fingers it: a bass
 * note written to last the bar, and a beat in, a chord for the same hand far
 * above it.
 */
describe('a key its hand has left', () => {
  const bar = (at: number): SongNote[] => [
    note(43, at, 3000, { finger: 2 }),
    note(59, at + 1000, 2000, { finger: 5 }),
    note(62, at + 1000, 2000, { finger: 3 }),
    note(66, at + 1000, 2000, { finger: 1 }),
  ]

  it('comes up when the same hand strikes a chord it cannot reach from there', () => {
    // The bass goes at the chord, two beats before its note ends. The chord is
    // one grip, and stays until it is over.
    expect(left(bar(0))).toEqual({ 43: 1000 })
  })

  it('says which note takes the hand away, for whoever is playing it', () => {
    // The lowest note of the chord is the first of it the hand comes to.
    const left = keysLeftFor(song(bar(0)))
    expect([...left].map(([by, keys]) => [by.note, keys.map((key) => key.note)])).toEqual([
      [59, [43]],
    ])
  })

  it('does so in every bar, each for its own chord', () => {
    const releases = keyReleases(song([...bar(0), ...bar(3000)]))
    expect([...releases.values()]).toEqual([1000, 4000])
  })

  it('stays down under the other hand, whatever that plays', () => {
    const melody = [0, 1000, 2000].map((at, index) =>
      note(79 + index, at, 1000, { hand: 'right', finger: 1 + index }),
    )
    expect(left([note(43, 0, 3000, { finger: 5 }), ...melody])).toEqual({})
  })

  it('stays down under a line the same hand can reach over it', () => {
    // A voice held by the little finger while the thumb and index move a
    // sixth and a seventh above: what a fugue asks of one hand.
    expect(
      left([
        note(48, 0, 3000, { finger: 5 }),
        note(57, 1000, 1000, { finger: 2 }),
        note(59, 2000, 1000, { finger: 1 }),
      ]),
    ).toEqual({})
  })

  it('comes up when its own finger is wanted elsewhere', () => {
    // Within a hand's width, but one finger is not on two keys.
    expect(left([note(48, 0, 3000, { finger: 3 }), note(52, 1000, 1000, { finger: 3 })])).toEqual({
      48: 1000,
    })
  })

  it('is not let go by the notes it was struck with, nor by a chord recorded a moment apart', () => {
    // A tenth and more, rolled from the bottom: wider than the fingers reach,
    // and one grip all the same.
    expect(
      left([
        note(36, 0, 2000, { finger: 5 }),
        note(55, 0, 2000, { finger: 2 }),
        note(60, 30, 2000, { finger: 1 }),
      ]),
    ).toEqual({})
  })

  it('is taken, not left, by the same key struck again', () => {
    expect(left([note(48, 0, 2000, { finger: 3 }), note(48, 1000, 1000, { finger: 3 })])).toEqual(
      {},
    )
  })

  it('goes by the width of a hand where nobody has said which finger', () => {
    // A tenth is in a hand. Two octaves are not.
    expect(left([note(43, 0, 3000), note(59, 1000, 1000)])).toEqual({ 43: 1000 })
    expect(left([note(43, 0, 3000), note(55, 1000, 1000)])).toEqual({})
  })

  it('leaves alone what is not the keyboard’s to hold', () => {
    expect(
      left([
        note(36, 0, 3000, { role: 'accompaniment' }),
        note(72, 1000, 1000, { role: 'accompaniment' }),
      ]),
    ).toEqual({})
  })
})
