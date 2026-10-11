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
  const hands = (song: ReturnType<typeof score>) =>
    song.notes.map((each) => [each.note, each.hand, each.staff, each.handSuggested ?? false])

  it('keeps a note with its line’s hand on the other staff, and says the score has not settled it', () => {
    // The left hand holds a note of its own under the right hand's run.
    const song = score([run + rest(1, 1, 2) + back() + note('C', 2, 2, 5)])
    expect(hands(song)).toEqual([
      [36, 'left', undefined, false],
      // On the lower staff, in the upper staff's voice: the right hand's, as a reading.
      [48, 'right', 2, true],
      [55, 'right', 2, true],
      // On its own staff there is nothing to add, and nothing in doubt.
      [64, 'right', undefined, false],
      [72, 'right', undefined, false],
    ])
    expect(song.handsSuggested).toBe(2)
  })

  it('never hands a note to the other hand for being free to take it', () => {
    // The left hand has nothing else to do here. That is not the score saying
    // these notes are its: the line stays one hand's, and is marked as open.
    const song = score([run + rest(1, 1, 2) + back() + rest(2, 5)])
    expect(hands(song)).toEqual([
      [48, 'right', 2, true],
      [55, 'right', 2, true],
      [64, 'right', undefined, false],
      [72, 'right', undefined, false],
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
    expect([visitor.hand, visitor.staff, visitor.handSuggested]).toEqual(['right', 2, true])
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
    expect(hands(song)).toEqual([
      [48, 'left', undefined, false],
      [76, 'right', undefined, false],
      [47, 'left', undefined, false],
      [74, 'right', undefined, false],
    ])
    expect(song.handsSuggested).toBeUndefined()
    // And the two lines are told apart, so the page does not take them for one.
    const voices = (hand: string) =>
      new Set(song.notes.filter((each) => each.hand === hand).map((each) => each.voice))
    expect([...voices('right')].some((voice) => voices('left').has(voice))).toBe(false)
  })
})

/**
 * The hands a score marks outright.
 *
 * "m.d." over a run on the lower staff, "L.H." under a note of the melody: the
 * one place a page names a hand, written exactly where the staves would
 * mislead. Read from the staves alone, the right hand's bar in the Flight of
 * the Bumblebee was taught to the left.
 */
describe('a hand marked in the score', () => {
  const mark = (text: string, staff: number) =>
    `<direction placement="below"><direction-type><words>${text}</words></direction-type><staff>${staff}</staff></direction>`
  const hands = (song: ReturnType<typeof score>) =>
    song.notes.map((each) => [each.note, each.hand, each.staff, each.handSuggested ?? false])
  /** Four quarter notes of the lower staff's own voice, on the lower staff. */
  const low = (...steps: string[]) => steps.map((step) => note(step, 3, 2, 5, 1)).join('')

  it('takes the note it stands on for that hand, as the score’s own word', () => {
    // The upper staff rests; "m.d." says the right hand plays what is below.
    const song = score([mark('m.d.', 1) + rest(1, 1) + back() + low('C', 'D', 'E', 'F')])
    expect(hands(song)[0]).toEqual([48, 'right', 2, false])
  })

  it('carries through the phrase it opens, as a reading, until another mark takes over', () => {
    const song = score([
      mark('m.d.', 1) + rest(1, 1) + back() + low('C', 'D', 'E', 'F'),
      rest(1, 1) + back() + mark('m.g.', 2) + low('G', 'A', 'B', 'C'),
    ])
    expect(hands(song)).toEqual([
      // Stated for the first, and followed, as a reading, by the rest of the run.
      [48, 'right', 2, false],
      [50, 'right', 2, true],
      [52, 'right', 2, true],
      [53, 'right', 2, true],
      // The left hand takes over where the score says so: its own notes, on its own staff.
      [55, 'left', undefined, false],
      [57, 'left', undefined, false],
      [59, 'left', undefined, false],
      [48, 'left', undefined, false],
    ])
    expect(song.handsSuggested).toBe(3)
  })

  it('stops at a rest: the phrase the mark was on is over', () => {
    const song = score([
      mark('R.H.', 2) +
        note('C', 3, 2, 5, 1) +
        note('D', 3, 2, 5, 1) +
        rest(2, 5, 1) +
        note('E', 3, 2, 5, 1) +
        back() +
        rest(1, 1),
    ])
    expect(hands(song)).toEqual([
      [48, 'right', 2, false],
      [50, 'right', 2, true],
      [52, 'left', undefined, false],
    ])
  })

  it('moves nothing where it is not clear which line it is for, and says those notes are open', () => {
    // Two lines begin under the mark on the lower staff.
    const song = score([
      mark('m.d.', 2) +
        note('G', 3, 2, 5) +
        back() +
        note('C', 2, 2, 6) +
        back() +
        note('E', 5, 1, 1),
    ])
    expect(hands(song)).toEqual([
      [36, 'left', undefined, true],
      [55, 'left', undefined, true],
      [76, 'right', undefined, false],
    ])
  })

  it('settles a note the staves had left open', () => {
    // The right hand's run on the lower staff, and the score saying so. The
    // left hand comes in a beat later, so the mark stands on the run alone.
    const song = score([
      mark('m.d.', 2) +
        run +
        rest(1, 1, 2) +
        back() +
        rest(2, 5, 1) +
        note('C', 2, 2, 5, 1) +
        note('C', 2, 2, 5, 2),
    ])
    const by = (midi: number) => song.notes.find((each) => each.note === midi)!
    expect([by(48).hand, by(48).staff, by(48).handSuggested ?? false]).toEqual(['right', 2, false])
    // The next note of the run, which the mark was not on, is still a reading.
    expect([by(55).hand, by(55).staff, by(55).handSuggested ?? false]).toEqual(['right', 2, true])
  })

  it('is told from the words around it: only a mark that is nothing else', () => {
    const song = score([
      mark('Andante m.d. espressivo', 1) + rest(1, 1) + back() + low('C', 'D', 'E', 'F'),
    ])
    expect(song.notes.every((each) => each.hand === 'left' && !each.handSuggested)).toBe(true)
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
