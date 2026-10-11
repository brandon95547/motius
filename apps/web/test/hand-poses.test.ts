import { describe, expect, it } from 'vitest'
import { buildSong, type SongNote } from '@sonara/shared'
import { frameAt, handPose, handTimeline, shapeAt } from '@/features/hands/hand-poses'
import { buildLayout, keyCenterPercent } from '@/features/keyboard/keyboard-layout'

/**
 * Where a hand is over the keys, from a song's fingering.
 *
 * The first half is the reading of the song: which key each finger is on, and
 * until when. The second is the geometry: where that puts a fingertip.
 */

const note = (
  pitch: number,
  startMs: number,
  durationMs: number,
  finger: number | undefined,
  hand: 'left' | 'right' = 'right',
): SongNote => ({
  note: pitch,
  velocity: 80,
  startMs,
  durationMs,
  hand,
  role: 'keyboard',
  ...(finger === undefined ? {} : { finger }),
})

const song = (notes: SongNote[]) =>
  buildSong({
    id: 'x',
    title: 'x',
    bpm: 60,
    beatsPerMeasure: 4,
    notes,
    source: 'musicxml',
    handsInferred: false,
  })

/** A timeline as its moments and the keys under the five fingers, thumb first. */
const read = (notes: SongNote[], hand: 'left' | 'right' = 'right') =>
  handTimeline(song(notes), hand).map((frame) => [frame.atMs, ...frame.keys])

describe('which key each finger is on', () => {
  it('puts a finger down for its note and lifts it when the note is over', () => {
    expect(read([note(60, 0, 500, 1), note(62, 500, 500, 2)])).toEqual([
      [0, 60, null, null, null, null],
      // The thumb comes up as the index goes down: one moment, one keyframe.
      [500, null, 62, null, null, null],
      [1000, null, null, null, null, null],
    ])
  })

  it('holds a chord as one shape, and a note under a moving line for as long as it is written', () => {
    expect(
      read([
        note(60, 0, 2000, 1),
        note(64, 0, 1000, 3),
        note(67, 0, 1000, 5),
        note(65, 1000, 1000, 4),
      ]),
    ).toEqual([
      [0, 60, null, 64, null, 67],
      [1000, 60, null, null, 65, null],
      [2000, null, null, null, null, null],
    ])
  })

  it('moves a finger straight to its next key where it has to leave one still sounding', () => {
    // The Gymnopédie's left hand: the bass rings on, and the hand has gone.
    expect(
      read(
        [
          note(43, 0, 3000, 2, 'left'),
          note(59, 1000, 2000, 5, 'left'),
          note(66, 1000, 2000, 1, 'left'),
        ],
        'left',
      ),
    ).toEqual([
      [0, null, 43, null, null, null],
      [1000, 66, null, null, null, 59],
      [3000, null, null, null, null, null],
    ])
  })

  it('keeps to its own hand, and to the notes somebody fingered', () => {
    const notes = [note(60, 0, 500, 1), note(48, 0, 500, 5, 'left'), note(62, 500, 500, undefined)]
    expect(read(notes)).toEqual([
      [0, 60, null, null, null, null],
      [500, null, null, null, null, null],
    ])
    expect(read(notes, 'left')).toEqual([
      [0, null, null, null, null, 48],
      [500, null, null, null, null, null],
    ])
  })

  it('finds the keyframe in force at a moment, and the shape a resting hand keeps', () => {
    const timeline = handTimeline(song([note(60, 1000, 500, 1), note(67, 3000, 500, 5)]), 'right')
    expect(frameAt(timeline, 0)).toBe(-1)
    expect(frameAt(timeline, 1000)).toBe(0)
    expect(frameAt(timeline, 1499)).toBe(0)
    expect(frameAt(timeline, 2000)).toBe(1)
    // Before its first note a hand waits over it; between notes it stays
    // where it last played.
    expect(shapeAt(timeline, -1)?.keys[0]).toBe(60)
    expect(shapeAt(timeline, 1)?.keys[0]).toBe(60)
    expect(shapeAt(timeline, 2)?.keys[4]).toBe(67)
    expect(shapeAt([], 0)).toBeNull()
  })
})

describe('where that puts the hand', () => {
  // Two octaves from C3: fourteen white keys and the C above, fifteen in all.
  const layout = buildLayout({ low: 48, high: 72 })
  const white = 100 / layout.whiteCount
  const keyX = (key: number) => keyCenterPercent(layout, key)
  const pose = (keys: (number | null)[], hand: 'left' | 'right' = 'right') =>
    handPose(keys, hand, keyX, white)

  it('knows where every key is, the ones off the ends as well', () => {
    for (const key of [...layout.whiteKeys, ...layout.blackKeys])
      expect(keyCenterPercent(layout, key.note), String(key.note)).toBeCloseTo(
        key.leftPercent + key.widthPercent / 2,
        6,
      )
    // The B below the window is half a white key off its left edge, the D
    // above it half a key off its right, and the E after that a key further.
    expect(keyX(47)).toBeCloseTo(-white / 2, 6)
    expect(keyX(74)).toBeCloseTo(100 + white / 2, 6)
    expect(keyX(76)).toBeCloseTo(100 + white * 1.5, 6)
  })

  it('puts each fingertip on its key, further in for a black one', () => {
    // C, E, G with one, three and five.
    const { fingers } = pose([60, null, 64, null, 67])
    expect(fingers.map((finger) => finger.key)).toEqual([60, null, 64, null, 67])
    expect(fingers[0]!.tipX).toBeCloseTo(keyX(60), 6)
    expect(fingers[2]!.tipX).toBeCloseTo(keyX(64), 6)
    expect(fingers[4]!.tipX).toBeCloseTo(keyX(67), 6)
    // The fingers between sit between: over D and F.
    expect(fingers[1]!.tipX).toBeCloseTo(keyX(62), 6)
    expect(fingers[3]!.tipX).toBeCloseTo(keyX(65), 6)

    const sharp = pose([null, null, 66, null, null]).fingers[2]!
    expect(sharp.tipX).toBeCloseTo(keyX(66), 6)
    expect(sharp.tipY).toBeLessThan(fingers[2]!.tipY - 0.15)
  })

  it('lays the other fingers a white key apart beyond the ones that have a key', () => {
    // The thumb alone on middle C: a five-finger position from there.
    const { fingers } = pose([60, null, null, null, null])
    expect(fingers.map((finger) => finger.tipX / white)).toEqual(
      [0, 1, 2, 3, 4].map((step) => expect.closeTo(keyX(60) / white + step, 6)),
    )
  })

  it('mirrors the left hand: its little finger is the lowest', () => {
    // C, E, G below middle C with five, three and one.
    const { fingers, palmX } = pose([55, null, 52, null, 48], 'left')
    expect(fingers[4]!.tipX).toBeLessThan(fingers[2]!.tipX)
    expect(fingers[2]!.tipX).toBeLessThan(fingers[0]!.tipX)
    // The thumb joins the hand on its inner side, toward the other hand.
    expect(fingers[0]!.baseX).toBeGreaterThan(palmX)
    expect(pose([60, null, 64, null, 67]).fingers[0]!.baseX).toBeLessThan(
      pose([60, null, 64, null, 67]).palmX,
    )
  })

  it('brings the hand in over the keys to reach a black one', () => {
    expect(pose([null, 61, null, null, null]).palmY).toBeLessThan(
      pose([60, null, null, null, null]).palmY,
    )
  })
})
