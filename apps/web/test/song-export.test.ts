import { describe, expect, it } from 'vitest'
import {
  buildSong,
  gridMeasures,
  writeSongMidi,
  writeSongMusicXml,
  type Song,
  type SongNote,
} from '@motius/shared'
import { importMidi } from '@/features/songs/import-midi'
import { importMusicXml } from '@/features/songs/import-musicxml'

/**
 * A song exported and read back by Motius's own importers is the same song:
 * the same notes, in the same hands, at the same places. And every bar of the
 * MusicXML adds up, which is what decides whether another program opens it.
 */

const QUARTER_MS = 500 // 120 crotchets a minute

const note = (
  pitch: number,
  hand: 'left' | 'right',
  startQ: number,
  durationQ: number,
  extra: Partial<SongNote> = {},
): SongNote => ({
  note: pitch,
  velocity: 80,
  hand,
  role: 'keyboard',
  startMs: startQ * QUARTER_MS,
  durationMs: durationQ * QUARTER_MS,
  startQ,
  durationQ,
  ...extra,
})

const triplet = { value: 'eighth' as const, dots: 0, tuplet: { id: 1, actual: 3, normal: 2 } }

/** Two bars of 4/4 as a score states them: a tie over the bar line, a triplet, fingers, a dynamic, the pedal. */
const scored: Song = buildSong({
  id: 'scored',
  title: 'Two bars',
  bpm: 120,
  beatsPerMeasure: 4,
  timeSignature: { beats: 4, beatType: 4 },
  source: 'musicxml',
  handsInferred: false,
  rhythmFromScore: true,
  key: { pitchClass: 0, mode: 'major', fifths: 0, declared: true },
  pedal: [{ startMs: 0, endMs: 4 * QUARTER_MS }],
  notes: [
    note(60, 'right', 0, 1, { finger: 1, dynamic: 'mf' }),
    note(62, 'right', 1, 1, { finger: 2 }),
    note(64, 'right', 2, 1, { finger: 3 }),
    // Held from beat four over the bar line: one note, tied.
    note(67, 'right', 3, 2, { finger: 5 }),
    note(65, 'right', 5, 1 / 3, { written: triplet }),
    note(64, 'right', 5 + 1 / 3, 1 / 3, { written: triplet }),
    note(62, 'right', 5 + 2 / 3, 1 / 3, { written: triplet }),
    note(60, 'right', 6, 2),
    note(48, 'left', 0, 4, { finger: 5 }),
    note(55, 'left', 0, 4, { finger: 1 }),
    note(43, 'left', 4, 4),
  ],
})

/**
 * A played take: times off the grid, and in each hand a note held under the
 * next ones — a melody over a held chord, which one voice cannot write.
 */
const played: Song = buildSong({
  id: 'played',
  title: 'Played',
  bpm: 120,
  beatsPerMeasure: 4,
  timeSignature: { beats: 4, beatType: 4 },
  source: 'midi',
  handsInferred: false,
  notes: [
    note(72, 'right', 0.01, 3.97),
    note(76, 'right', 1.02, 0.48),
    note(77, 'right', 1.49, 0.52),
    note(79, 'right', 2.0, 1.9),
    note(48, 'left', 0, 2.03),
    note(52, 'left', 0.98, 0.5),
    note(55, 'left', 2.01, 4.4),
  ].map((entry) => ({ ...entry, startQ: undefined, durationQ: undefined })),
})

const keyboardOf = (song: Song) =>
  song.notes
    .filter((entry) => entry.role === 'keyboard')
    .map((entry) => ({
      note: entry.note,
      hand: entry.hand,
      startQ: Math.round((entry.startQ ?? 0) * 1000) / 1000,
      durationQ: Math.round((entry.durationQ ?? 0) * 1000) / 1000,
    }))
    .sort((a, b) => a.startQ - b.startQ || a.note - b.note)

/**
 * Walks every measure as a reader does: the cursor never runs past the bar or
 * back before it, and the first voice of each staff fills the bar exactly.
 */
function checkMeasures(xml: string) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  expect(doc.querySelector('parsererror')).toBeNull()
  const divisions = Number(doc.querySelector('divisions')!.textContent)
  let barQ = 4
  for (const measure of doc.querySelectorAll('measure')) {
    const time = measure.querySelector('time')
    if (time) {
      barQ =
        (Number(time.querySelector('beats')!.textContent) * 4) /
        Number(time.querySelector('beat-type')!.textContent)
    }
    const bar = barQ * divisions
    let cursor = 0
    const filled = new Map<string, number>()
    for (const child of measure.children) {
      const duration = Number(child.querySelector('duration')?.textContent ?? 0)
      if (child.tagName === 'backup') cursor -= duration
      if (child.tagName === 'forward') cursor += duration
      if (child.tagName === 'note' && !child.querySelector('grace')) {
        if (!child.querySelector('chord')) {
          cursor += duration
          const voice = child.querySelector('voice')!.textContent!
          filled.set(voice, (filled.get(voice) ?? 0) + duration)
        }
      }
      expect(cursor).toBeGreaterThanOrEqual(0)
      expect(cursor).toBeLessThanOrEqual(bar)
    }
    expect(filled.get('1')).toBe(bar)
    expect(filled.get('5')).toBe(bar)
  }
}

describe('a song exported as MusicXML', () => {
  it('fills every bar exactly, score or performance', () => {
    checkMeasures(writeSongMusicXml(scored))
    checkMeasures(writeSongMusicXml(played))
  })

  it('reads back as the same notes in the same hands', () => {
    const back = importMusicXml(writeSongMusicXml(scored), 'back')!
    expect(keyboardOf(back)).toEqual(keyboardOf(scored))
  })

  it('keeps the fingers, the dynamic, the triplet and the pedal', () => {
    const xml = writeSongMusicXml(scored)
    const back = importMusicXml(xml, 'back')!
    expect(
      back.notes.filter((entry) => entry.finger).map((entry) => [entry.note, entry.finger]),
    ).toEqual(
      expect.arrayContaining([
        [60, 1],
        [62, 2],
        [64, 3],
        [67, 5],
        [48, 5],
        [55, 1],
      ]),
    )
    expect(back.notes.find((entry) => entry.note === 60)?.dynamic).toBe('mf')
    expect(back.notes.find((entry) => entry.note === 65)?.written?.tuplet).toMatchObject({
      actual: 3,
      normal: 2,
    })
    expect(back.pedal).toHaveLength(1)
    // The tie over the bar line is written as one, not struck again.
    expect(xml).toContain('<tie type="start"/>')
    expect(back.notes.filter((entry) => entry.note === 67)).toHaveLength(1)
  })

  it('puts a grace chord after a rest right before the note it leads into', () => {
    const graced = buildSong({
      ...scored,
      notes: [
        note(60, 'right', 0, 1),
        note(76, 'right', 2.75, 0.25, { grace: true }),
        note(79, 'right', 2.75, 0.25, { grace: true }),
        note(74, 'right', 3, 1),
        note(48, 'left', 0, 4),
      ],
    })
    const back = importMusicXml(writeSongMusicXml(graced), 'back')!
    expect(back.notes.filter((entry) => entry.grace).map((entry) => entry.startQ)).toEqual([
      2.75, 2.75,
    ])
  })

  it('writes a held note under a moving line as a second voice, not cut short', () => {
    const back = importMusicXml(writeSongMusicXml(played), 'back')!
    const held = back.notes.find((entry) => entry.note === 72)!
    expect(held.hand).toBe('right')
    expect(held.durationQ).toBe(4)
    const hands = (song: Song) =>
      keyboardOf(song)
        .map(({ note, hand }) => [note, hand])
        .sort((a, b) => Number(a[0]) - Number(b[0]))
    expect(hands(back)).toEqual(hands(played))
  })
})

describe('a song exported as MIDI', () => {
  it('reads back with its hands on their own tracks, exactly in time', () => {
    const back = importMidi(writeSongMidi(scored), 'back')!
    expect(back.title).toBe('Two bars')
    expect(back.handsInferred).toBe(false)
    expect(keyboardOf(back)).toEqual(keyboardOf(scored))
    expect(back.notes.every((entry) => entry.velocity === 80)).toBe(true)
  })

  it('plays the repeats out, since MIDI has no repeat signs', () => {
    const measures = gridMeasures({ bpm: 120, beats: 4, beatType: 4, durationMs: 4 * QUARTER_MS })
    const repeated = buildSong({
      ...scored,
      notes: [note(60, 'right', 0, 4), note(48, 'left', 0, 4)],
      measures: [{ ...measures[0]!, repeat: { start: true, times: 2 } }],
    })
    const back = importMidi(writeSongMidi(repeated), 'back')!
    expect(keyboardOf(back).map(({ note, startQ }) => [note, startQ])).toEqual([
      [48, 0],
      [60, 0],
      [48, 4],
      [60, 4],
    ])
  })
})
