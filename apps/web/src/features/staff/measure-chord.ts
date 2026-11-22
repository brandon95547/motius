import {
  staffPlacement,
  valueQuarters,
  written,
  writtenValue,
  type AccidentalMemory,
  type SongNote,
  type SongStep,
  type Staff,
  type WrittenValue,
} from '@motius/shared'
import { STEP } from './staff-frame'
import { placementOf, REST_HALF, staffOf, VOICE_SHIFT } from './chord-layout'
import type { DrawnNote, Extent, VoicePart } from './notation'
import type { Measured, RestMark, StaffClefs } from './score-model'
import type { Measuring, ScoreRests } from './measure-marks'

/**
 * One chord, measured: what its notes are written as, how they are drawn,
 * its voices, and the rests that come with it. Asked by `measureScore` of
 * every place in the score, in order.
 */

/** The white space two chords keep between their ink. */
export const AIR = STEP * 3

/** The longest of the lengths some notes are written as, where any says. */
const longestStated = (given: readonly SongNote[]): WrittenValue | undefined => {
  const stated = given
    .map((note) => note.written)
    .filter((each) => each !== undefined)
    .sort((a, b) => valueQuarters(b.value, b.dots) - valueQuarters(a.value, a.dots))[0]
  return stated ? written(stated.value, stated.dots) : undefined
}

/**
 * How long the notes of a staff are *written* as. Where the file said, that is
 * the answer; a performance only implies its durations and a score states them.
 * Otherwise it is the time until this staff next has something — not how
 * long a key was held, because a player releasing early has played a short
 * crotchet, not a quaver.
 *
 * Per staff, because the hands keep their own rhythm. A bar-long chord
 * under a run of quavers is a semibreve, and taking the melody's value for
 * it writes it as a crotchet with a stem.
 */
export function writtenValueOn(
  m: Measuring,
  writtenHere: readonly SongNote[],
  index: number,
  staff: Staff,
): WrittenValue {
  const here = writtenHere.filter((note) => m.rowOf(note) === staff)
  if (here.length === 0) return writtenValue(m.beat, m.beat)

  // One stem per staff, so one value for the chord under it: the longest,
  // which is the same note the held-duration fallback below would pick.
  const stated = longestStated(here)
  if (stated) return stated

  let next: SongStep | undefined
  for (let i = index + 1; i < m.steps.length; i++) {
    if (m.steps[i]!.notes.some((note) => m.rowOf(note) === staff)) {
      next = m.steps[i]
      break
    }
  }
  const held = Math.max(...here.map((note) => note.durationMs))
  return writtenValue(next ? next.startMs - m.steps[index]!.startMs : held, m.beat)
}

/**
 * The chord as it will be drawn.
 *
 * Including which fingerings the page prints: the extent is what decides
 * how much room the next chord gets, and reserving space for a numeral
 * that the reader's density setting suppresses spaces the whole score for
 * ink that is never laid down.
 */
export function drawnNotesOf(
  m: Measuring,
  sorted: readonly SongNote[],
  here: {
    readonly heldNotes: ReadonlySet<SongNote>
    readonly clefs: StaffClefs
    readonly crosses: (voice: number) => boolean
    readonly hints: ReadonlySet<SongNote> | undefined
    readonly memory: Readonly<Record<Staff, AccidentalMemory>>
  },
): DrawnNote[] {
  const { heldNotes, clefs, hints, memory } = here
  return sorted.map((note) => {
    const held = heldNotes.has(note)
    const on = m.rowOf(note)
    const drawn = {
      note: note.note,
      ...(m.layer || note.staff !== undefined ? { row: on } : {}),
      ...(note.voice !== undefined && here.crosses(note.voice) ? { voice: note.voice } : {}),
      ...(clefs[on] !== on ? { clef: clefs[on] } : {}),
      finger: !hints || hints.has(note) ? note.finger : undefined,
      rolled: note.rolled,
      spelling: note.spelling,
      hand: note.hand,
      ...(held ? { held } : {}),
    }
    const staff = staffOf(drawn)
    return {
      ...drawn,
      // A tied note keeps the sign its first notehead had, and does not
      // print it again.
      accidental: held
        ? null
        : memory[staff].printFor(staffPlacement(note.note, note.spelling, staff)),
    }
  })
}

/**
 * The step's voices, where a staff has two in this bar.
 *
 * The upper voice's notes are one chord with its stem up, the lower's
 * another with its stem down, and each is as long as its own notes are
 * written. Where their heads would land on each other — a second apart, or
 * the same line with different heads — the lower steps to the right.
 */
export function voicePartsOf(
  sorted: readonly SongNote[],
  notes: readonly DrawnNote[],
  value: Readonly<Record<Staff, WrittenValue>>,
  voicesOn: (staff: Staff) => readonly number[],
): VoicePart[] | undefined {
  if (voicesOn('treble').length < 2 && voicesOn('bass').length < 2) return undefined

  const found: VoicePart[] = []
  for (const staff of ['treble', 'bass'] as const) {
    const voices = voicesOn(staff)
    const here = sorted
      .map((note, at) => ({ note, drawn: notes[at]! }))
      .filter(({ drawn }) => staffOf(drawn) === staff)
    if (here.length === 0) continue
    if (voices.length < 2) {
      found.push({ staff, notes: here.map(({ drawn }) => drawn), value: value[staff], dx: 0 })
      continue
    }

    const lengthOf = (group: typeof here): WrittenValue =>
      longestStated(group.map(({ note }) => note)) ?? value[staff]
    const isUpper = ({ note }: (typeof here)[number]) =>
      voices.indexOf(note.voice ?? voices[0]!) <= 0
    const upper = here.filter(isUpper)
    const lower = here.filter((entry) => !isUpper(entry))
    const upperValue = lengthOf(upper)
    const lowerValue = lengthOf(lower)
    const crowded =
      upper.length > 0 &&
      lower.length > 0 &&
      upper.some(({ drawn: above }) =>
        lower.some(({ drawn: below }) => {
          const apart = Math.abs(placementOf(above).steps - placementOf(below).steps)
          // A second apart always; the same line unless the two heads are
          // the same head, which one notehead with two stems can be.
          return (
            apart === 1 ||
            (apart === 0 &&
              (upperValue.filled !== lowerValue.filled ||
                upperValue.dotted !== lowerValue.dotted ||
                upperValue.stemmed !== lowerValue.stemmed))
          )
        }),
      )
    if (upper.length > 0)
      found.push({
        staff,
        notes: upper.map(({ drawn }) => drawn),
        value: upperValue,
        stem: 'up',
        dx: 0,
      })
    if (lower.length > 0)
      found.push({
        staff,
        notes: lower.map(({ drawn }) => drawn),
        value: lowerValue,
        stem: 'down',
        dx: crowded ? VOICE_SHIFT : 0,
      })
  }
  return found
}

/**
 * The rests with a chord, and the room the chord then takes.
 *
 * Those at its own moment stand in its column, on the other staff. Those
 * before it take a place each in the room in front, in the order they
 * come, two that begin together sharing one — the last nearest the chord.
 */
export function restsWith(
  index: number,
  inked: Extent,
  { restsBy, leadsBy }: ScoreRests,
): { rests: RestMark[]; lead: number; extent: Extent } {
  const waiting = [...(leadsBy.get(index) ?? [])].sort((a, b) => a.at - b.at)
  const moments = [...new Set(waiting.map((lead) => Math.round(lead.at)))]
  const slot = REST_HALF * 2 + AIR
  const rests: RestMark[] = [
    ...(restsBy.get(index) ?? []),
    ...waiting.map(({ at, mark }) => ({
      ...mark,
      back:
        inked.left +
        AIR +
        REST_HALF +
        (moments.length - 1 - moments.indexOf(Math.round(at))) * slot,
    })),
  ]
  /** The room the rests in front need, on top of the chord's own. */
  const lead = moments.length * slot
  const beside = (restsBy.get(index)?.length ?? 0) > 0 ? REST_HALF + STEP : 0
  const extent = {
    ...inked,
    left: Math.max(inked.left, beside),
    right: Math.max(inked.right, beside),
  }
  return { rests, lead, extent }
}

/** The tuplet each staff's notes are written inside, where the score put them in one. */
export function tupletsOf(m: Measuring, step: SongStep): NonNullable<Measured['tuplet']> {
  const tupletOn = (staff: Staff) =>
    step.notes.find((note) => m.rowOf(note) === staff && note.written?.tuplet)?.written?.tuplet
  return {
    ...(tupletOn('treble') ? { treble: tupletOn('treble')! } : {}),
    ...(tupletOn('bass') ? { bass: tupletOn('bass')! } : {}),
  }
}
