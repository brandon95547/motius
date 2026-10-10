import { describe, expect, it } from 'vitest'
import { songSteps } from '@sonara/shared'
import { importMusicXml } from '@/features/songs/import-musicxml'
import { beamsIn } from '@/features/staff/beams'
import { measureScore, place } from '@/features/staff/score'
import { STAFF_BANDS, STAFF_HEIGHT } from '@/features/staff/staff-frame'
import { staffOf } from '@/features/staff/StaffNotes'

/**
 * A hand written on the other hand's staff.
 *
 * The right hand of the Moonlight Sonata's first movement runs down into the
 * bass, and the page keeps it off the ledger lines by writing those notes on
 * the lower staff, beamed to the rest of their triplet on the upper one. They
 * are still the right hand's: the file keeps them in its voice. Sonara read
 * the hand from the staff, so it gave them to the left hand, and broke every
 * such beam in two.
 */

const TYPES: Record<number, string> = { 4: 'whole', 2: 'half', 1: 'quarter', 0.5: 'eighth' }
const note = (step: string, octave: number, staff: number, voice: number, beats = 4) =>
  `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>${beats * 2}</duration><voice>${voice}</voice><type>${TYPES[beats]}</type><staff>${staff}</staff></note>`
const rest = (staff: number, voice: number, beats = 4) =>
  `<note><rest/><duration>${beats * 2}</duration><voice>${voice}</voice><type>${TYPES[beats]}</type><staff>${staff}</staff></note>`
const back = (beats = 4) => `<backup><duration>${beats * 2}</duration></backup>`
const score = (bars: string[]) =>
  importMusicXml(
    `<score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">${bars
      .map(
        (body, index) =>
          `<measure number="${index + 1}">${index === 0 ? '<attributes><divisions>2</divisions><staves>2</staves><time><beats>4</beats><beat-type>4</beat-type></time></attributes>' : ''}${body}</measure>`,
      )
      .join('')}</part></score-partwise>`,
    'cross',
  )!
/** Four eighth notes of the upper staff's first voice: two on the lower staff, then two on the upper. */
const run =
  note('C', 3, 2, 1, 0.5) +
  note('G', 3, 2, 1, 0.5) +
  note('E', 4, 1, 1, 0.5) +
  note('C', 5, 1, 1, 0.5)

describe('whose notes they are', () => {
  it('keeps a note with its voice’s hand while the other hand is playing', () => {
    // The left hand holds a note of its own under the right hand's run.
    const song = score([run + rest(1, 1, 2) + back() + note('C', 2, 2, 5)])
    const by = (midi: number) => song.notes.find((each) => each.note === midi)!
    expect([by(48).hand, by(48).staff]).toEqual(['right', 2])
    expect([by(55).hand, by(55).staff]).toEqual(['right', 2])
    // On its own staff there is nothing to add.
    expect([by(64).hand, by(64).staff]).toEqual(['right', undefined])
    expect([by(36).hand, by(36).staff]).toEqual(['left', undefined])
  })

  it('gives a run shared between the hands to each hand’s own staff', () => {
    // Nothing else for the left hand to do: the notes on its staff are its.
    const song = score([run + rest(1, 1, 2) + back() + rest(2, 5)])
    expect(song.notes.map((each) => [each.note, each.hand, each.staff])).toEqual([
      [48, 'left', undefined],
      [55, 'left', undefined],
      [64, 'right', undefined],
      [72, 'right', undefined],
    ])
    // One voice all the same, for the page to beam as one line.
    expect(new Set(song.notes.map((each) => each.voice)).size).toBe(1)
  })

  it('goes by where most of a voice is written, where the numbers are not a program’s usual ones', () => {
    // Voices 1 and 2, a staff each, and one note of the upper staff's on the lower.
    const song = score([
      note('E', 5, 1, 1, 2) + note('G', 3, 2, 1, 2) + back() + note('C', 2, 2, 2),
      note('E', 5, 1, 1) + back() + note('C', 2, 2, 2),
    ])
    const visitor = song.notes.find((each) => each.note === 55)!
    expect([visitor.hand, visitor.staff]).toEqual(['right', 2])
    expect(song.notes.filter((each) => each.note === 36).map((each) => each.hand)).toEqual([
      'left',
      'left',
    ])
  })

  it('reads the staff, as before, where one number is used for a line on each staff', () => {
    const song = score([
      note('E', 5, 1, 1) + back() + note('C', 3, 2, 1),
      note('D', 5, 1, 1) + back() + note('B', 2, 2, 1),
    ])
    expect(song.notes.map((each) => [each.note, each.hand, each.staff])).toEqual([
      [48, 'left', undefined],
      [76, 'right', undefined],
      [47, 'left', undefined],
      [74, 'right', undefined],
    ])
    // And the two lines are told apart, so the page does not take them for one.
    const voices = (hand: string) =>
      new Set(song.notes.filter((each) => each.hand === hand).map((each) => each.voice))
    expect([...voices('right')].some((voice) => voices('left').has(voice))).toBe(false)
  })
})

describe('a hand on the other staff, on the page', () => {
  const song = score([run + rest(1, 1, 2) + back() + note('C', 2, 2, 5)])
  const measured = measureScore({ ...song, beams: true }, songSteps(song, 'both'))

  it('is drawn on the staff the score wrote it on, and is still that hand', () => {
    const drawn = measured.flatMap((entry) => entry.notes)
    expect(drawn.map((each) => [each.note, each.hand, staffOf(each)])).toEqual([
      [36, 'left', 'bass'],
      [48, 'right', 'bass'],
      [55, 'right', 'bass'],
      [64, 'right', 'treble'],
      [72, 'right', 'treble'],
    ])
  })

  it('has its stems up on a staff it shares, and the staff’s own hand has them down', () => {
    expect(measured[0]!.parts!.map((part) => [part.staff, part.stem, part.notes[0]!.note])).toEqual(
      [
        ['bass', 'up', 48],
        ['bass', 'down', 36],
      ],
    )
  })

  it('is beamed as the one line it is, across both staves', () => {
    // The same beam on the lower staff's two notes and the upper staff's two.
    const ids = measured.map((entry) => entry.cross)
    expect(ids).toEqual([{ bass: 0 }, { bass: 0 }, { treble: 0 }, { treble: 0 }])
    // And none of them under a beam of its own staff as well.
    expect(measured.every((entry) => entry.beam === undefined)).toBe(true)
  })

  it('draws that beam between the staves, with the stems of each coming to it', () => {
    const placed = place(measured, 200)
    const { beams, stems } = beamsIn(placed)
    expect(beams).toHaveLength(1)
    expect(beams[0]!.staff).toBeNull()
    expect(beams[0]!.indices).toEqual([0, 1, 2, 3])
    // Lower staff up, upper staff down.
    expect(
      placed.map((entry) => (stems.get(entry.index)!.bass ?? stems.get(entry.index)!.treble)!.up),
    ).toEqual([true, true, false, false])
    // Between the upper staff's bottom line and the lower staff's top one.
    const ys = beams[0]!.bars[0]!.points.split(' ').map((point) => Number(point.split(',')[1]))
    expect(Math.min(...ys)).toBeGreaterThan(STAFF_BANDS.treble.top + STAFF_HEIGHT)
    expect(Math.max(...ys)).toBeLessThan(STAFF_BANDS.bass.top)
  })

  it('follows the staves when the system opens', () => {
    const placed = place(measured, 200)
    const plain = beamsIn(placed).stems
    const opened = beamsIn(placed, 30).stems
    // The beam stays midway, so each staff's stems are longer by what it moved.
    expect(opened.get(0)!.bass!.end).toBe(plain.get(0)!.bass!.end - 30)
    expect(opened.get(3)!.treble!.end).toBe(plain.get(3)!.treble!.end + 30)
  })

  it('writes no rest for a hand that is playing on the other staff', () => {
    // The right hand's whole bar is on the lower staff, over the left hand's
    // held note; its second voice rests for the bar on its own staff.
    const visiting = score([
      note('E', 3, 2, 1, 1).repeat(4) +
        back() +
        `<note><rest measure="yes"/><duration>8</duration><voice>2</voice><staff>1</staff></note>` +
        back() +
        note('C', 2, 2, 5),
      // Enough of the piece on its own staves for the voices to be known by.
      ...Array<string>(6).fill(note('E', 5, 1, 1, 0.5).repeat(8) + back() + note('C', 2, 2, 5)),
    ])
    expect(visiting.notes.filter((each) => each.note === 52).map((each) => each.hand)).toEqual(
      Array(4).fill('right'),
    )
    const places = measureScore(visiting, songSteps(visiting, 'both'))
    // A rest says a hand is waiting, and this one is not.
    expect(places.flatMap((entry) => entry.barRest ?? [])).toEqual([])
  })
})

describe('a score with no such line', () => {
  it('says nothing of voices or crossing beams', () => {
    const song = score([
      note('E', 5, 1, 1, 0.5).repeat(8) + back() + note('C', 3, 2, 5, 0.5).repeat(8),
    ])
    const measured = measureScore({ ...song, beams: true }, songSteps(song, 'both'))
    expect(measured.every((entry) => entry.cross === undefined)).toBe(true)
    expect(measured.flatMap((entry) => entry.notes).every((each) => each.voice === undefined)).toBe(
      true,
    )
    expect(song.notes.every((each) => each.staff === undefined)).toBe(true)
    expect(beamsIn(place(measured, 200)).beams.every((beam) => beam.staff !== null)).toBe(true)
  })
})
