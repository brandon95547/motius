import * as React from 'react'
import {
  AccidentalMemory,
  barIndexAt,
  songSteps,
  staffFor,
  staffPlacement,
  valueQuarters,
  written,
  writtenValue,
  type Hand,
  type Song,
  type SongMeasure,
  type SongNote,
  type SongStep,
  type Staff,
  type WrittenValue,
} from '@sonara/shared'
import {
  CLEF_CHANGE_WIDTH,
  HALF_HEIGHT,
  KEY_X,
  keyWidth,
  STAFF_BANDS,
  STAFF_HEIGHT,
  STEP,
  yOn,
  type LayerPlace,
  type RowsShown,
} from './staff-frame'
import {
  chordExtent,
  partsExtent,
  type Extent,
  placementOf,
  REST_HALF,
  staffOf,
  VOICE_SHIFT,
  type DrawnNote,
  type TieArc,
  type VoicePart,
} from './StaffNotes'
import type { SongPart } from '@/state/song-store'

/**
 * A song, measured — but not yet placed on a page.
 *
 * The two views draw the same music at the same size with the same fingering;
 * they disagree only about where the line ends. Flow runs one endless system
 * past a fixed playhead, Sheet breaks it into lines and stacks them. If they
 * measured separately they would drift apart, and switching between them would
 * quietly be switching between two scores.
 *
 * So the measuring happens once, here, and produces the gap before each chord
 * rather than its position. A gap is the same wherever the chord ends up; an x
 * is not.
 */

/** How much horizontal room a bar of music gets, before clamping. */
const MEASURE_WIDTH = 260
/**
 * Never closer than this, whatever else is true.
 *
 * A floor under the real constraint rather than the constraint itself: how
 * much room two chords need between them is a question about the marks they
 * are made of, and `chordExtent` answers it. A chord of four sharps reaches
 * half a bar to the left of its own noteheads, and no fixed number knows that.
 */
const MIN_GAP = 40
/** Never further than this: a held note should not push the next page away. */
const MAX_GAP = 170
/** The same two measures for the printed page, which sets its bars closer. */
const PAGE_BAR_WIDTH = 150
const PAGE_MIN_GAP = 26
/** The white space two chords keep between their ink. */
export const AIR = STEP * 3
/** The extra two chords keep when a bar line stands between them. */
const BAR_ROOM = STEP * 2
/** The room a bar with nothing in it but a rest is given. */
const EMPTY_BAR = STEP * 9
/** And the extra again when that line is a repeat sign, which has dots and a thick line to fit. */
const REPEAT_ROOM = STEP * 3

/** The repeat signs and ending bracket of a bar, by the number the page prints for it. */
export type BarMarks = ReadonlyMap<number, Pick<SongMeasure, 'repeat' | 'ending'>>

/** The marked bars of a score: the few that carry a repeat sign or stand under a bracket. */
export function barMarksOf(measures: readonly SongMeasure[] | undefined): BarMarks {
  const marks = new Map<number, Pick<SongMeasure, 'repeat' | 'ending'>>()
  for (const measure of measures ?? [])
    if (measure.repeat || measure.ending) marks.set(measure.number, measure)
  return marks
}
/** How far a bar number's ink rises above its own baseline, measured. */
const BAR_NUMBER_INK = 11

/** Half a time-signature numeral's measured width. */
const TIME_HALF = 9

export interface Measured {
  /**
   * The chord struck here, as the song has it. With no notes at all for a
   * place where nothing is struck: a note tied over from before is written
   * again there, and the page has a notehead for it though the player has
   * nothing new to do.
   */
  readonly step: SongStep
  /**
   * Which of the song's chords it is, counting from none. A place where
   * nothing is struck is not one of them, and stands between two: after the
   * third chord and before the fourth it is three and a half. So this says
   * where a place falls in the playing, and is not its place in the list.
   */
  readonly index: number
  /**
   * Its notes as the page will draw them: spelled, handed, and each carrying
   * the sign to print in front of it.
   *
   * Decided here rather than in the drawing because an accidental holds for the
   * rest of its bar, so what one chord prints depends on the chords before it —
   * and the components that draw chords are memoised, so a chord that does not
   * redraw would never be asked and the bar would forget what it had said.
   */
  readonly notes: readonly DrawnNote[]
  /** What this chord is written as, per staff — the hands keep their own rhythm. */
  readonly value: { readonly treble: WrittenValue; readonly bass: WrittenValue }
  /**
   * Its voices, where a staff carries more than one in this bar: each a chord
   * of its own. Absent where every staff has a single voice, which is drawn as
   * it always was.
   */
  readonly parts?: readonly VoicePart[]
  /**
   * The rests written with it: at its own moment, on the staff that is
   * waiting, or in the room before it where neither hand is playing.
   */
  readonly rests?: readonly RestMark[]
  /** The staves that rest for the whole of its bar. On the bar's first chord. */
  readonly barRest?: readonly Staff[]
  /** The bars before it in which nothing is struck at all, and the staves resting in each. */
  readonly emptyBars?: readonly { readonly bar: number; readonly staves: readonly Staff[] }[]
  /** The ties arriving at its held notes: which note, and the step each comes from. */
  readonly ties?: readonly { readonly note: number; readonly fromIndex: number }[]
  /** The ties leaving its notes: which note, and the step each goes to. */
  readonly tiesOut?: readonly { readonly note: number; readonly toIndex: number }[]
  /** How far its ink reaches, so a page can make room for it. */
  readonly extent: Extent
  /** The clef each staff is in here, where either is not its own. */
  readonly clefs?: StaffClefs
  /**
   * A clef that changes at this chord: the staff, the clef it goes into, and
   * how far left of the chord the small clef that says so is drawn.
   */
  readonly clefChange?: { readonly at: number; readonly treble?: Staff; readonly bass?: Staff }
  /** How far after the previous chord this one sits. Zero for the first. */
  readonly gap: number
  /** Which bar it falls in, counting from one. */
  readonly bar: number
  /**
   * The beam this chord is under on each staff: a number shared by every chord
   * of the group. Absent for a note that stands alone and keeps its flags.
   */
  readonly beam?: Partial<Record<BeamLine, number>>
  /** The tuplet its notes on each staff belong to, where the score said. */
  readonly tuplet?: Partial<Record<Staff, { readonly id: number; readonly actual: number }>>
}

/**
 * What measuring reads from a song: its pace, its key and where its bars fall.
 *
 * Four fields rather than the whole song, so music that is not a song can be
 * written out the same way — a scale is a run of steps in a key, and nothing
 * about engraving it needs a title or a track list. A song is one of these.
 */
/**
 * A line of music that can be beamed: a staff, or a staff's lower voice.
 *
 * Two voices on a staff are beamed apart. The upper voice — and a staff with
 * one voice — is the staff's own line; the lower voice, where there is one, is
 * a second line with a `2` to its name.
 */
export type BeamLine = Staff | 'treble2' | 'bass2'
export const BEAM_LINES: readonly BeamLine[] = ['treble', 'bass', 'treble2', 'bass2']
export const staffOfLine = (line: BeamLine): Staff =>
  line.startsWith('treble') ? 'treble' : 'bass'

/** The notes a chord has on one line, with what they are written as, or null where it has none. */
export function voiceOn(
  entry: Measured,
  line: BeamLine,
): { notes: readonly DrawnNote[]; value: WrittenValue; stem?: 'up' | 'down' } | null {
  const staff = staffOfLine(line)
  const lower = line.endsWith('2')
  if (entry.parts)
    return (
      entry.parts.find((part) => part.staff === staff && (part.stem === 'down') === lower) ?? null
    )
  if (lower) return null
  const notes = entry.notes.filter((note) => staffOf(note) === staff)
  return notes.length > 0 ? { notes, value: entry.value[staff] } : null
}

/** A rest beside a chord: its staff, what it is written as, and how far before the chord it stands. */
export interface RestMark {
  readonly staff: Staff
  readonly value: WrittenValue['value']
  readonly dots: number
  /** How far left of the chord, in units at the natural spacing. Zero for one at the chord's own moment. */
  readonly back: number
  /** The bar it is in, which is not always the chord's: a rest can end the bar before. */
  readonly bar: number
}

export interface ScoreSource {
  readonly bpm: number
  readonly measureMs: number
  readonly key?: { readonly fifths: number } | null
  /** The bars as a file laid them out. Without them, a bar is `measureMs` long. */
  readonly measures?: Song['measures']
  /**
   * How much room a bar gets before clamping, in units. A song keeps the
   * default; a scale — even steps, no rhythm to show — asks for less, so a
   * two-octave run fits the paper instead of scrolling a third of itself away.
   */
  readonly barWidth?: number
  /** The least room between two chords, in units, where `MIN_GAP` is too much. */
  readonly minGap?: number
  /**
   * Join short notes into beats with beams.
   *
   * On for material whose rhythm is stated exactly — an exercise knows every
   * note's length, and so does a song read from a score. Off for a song that
   * is a performance: grouping by the beat needs a beat to group by, and a
   * rubato bar does not have one this code can trust.
   */
  readonly beams?: boolean
  /** The rests the score writes, for the hands being shown. */
  readonly rests?: Song['rests']
  /** The clefs its staves are read in, where the score changes them. */
  readonly clefs?: Song['clefs']
  /** How many staves the piano is written on, where that is more than two. */
  readonly staves?: number
}

/**
 * One pair of staves out of a score written on more than two: which of the
 * score's staves, counted from the top, is drawn on each of the pair's.
 *
 * A piano on four staves is two pairs, a hand each. On three it is a pair and
 * a staff over, and that last pair has only its lower staff.
 */
export interface ScoreLayer {
  readonly treble?: number
  readonly bass?: number
}

/** The pairs a score's staves are drawn in. None for a piano's usual two, which is one pair and needs no telling. */
export function layersOf(staves: number | undefined): readonly ScoreLayer[] | undefined {
  if (!staves || staves <= 2) return undefined
  const layers: ScoreLayer[] = []
  for (let top = 1; top <= staves; top += 2)
    layers.push(top < staves ? { treble: top, bass: top + 1 } : { bass: top })
  return layers
}

/** The staff of the score something is written on: the one it names, or else its hand's own, the top or the bottom. */
const staffNumberOf = (on: { readonly staff?: number; readonly hand: Hand }, staves: number) =>
  on.staff ?? (on.hand === 'left' ? staves : 1)

/** The staff of a pair that one of the score's staves is drawn on, or null where it belongs to another pair. */
const rowIn = (layer: ScoreLayer, staff: number | undefined): Staff | null =>
  staff === undefined
    ? null
    : staff === layer.treble
      ? 'treble'
      : staff === layer.bass
        ? 'bass'
        : null

/** The clef each staff is in. */
export type StaffClefs = Readonly<Record<Staff, Staff>>

const OWN_CLEFS: StaffClefs = { treble: 'treble', bass: 'bass' }

/**
 * The clef each staff is in at a moment of the score.
 *
 * Of a piano's usual two, by hand. Of one pair out of more, by which of the
 * score's staves each is.
 */
export function clefsAt(clefs: Song['clefs'], ms: number, layer?: ScoreLayer): StaffClefs {
  if (!clefs?.length) return OWN_CLEFS
  let treble: Staff = 'treble'
  let bass: Staff = 'bass'
  for (const change of clefs) {
    if (change.startMs > ms + 1e-6) continue
    const row = layer ? rowIn(layer, change.staff) : change.hand === 'right' ? 'treble' : 'bass'
    if (row === 'treble') treble = change.clef
    else if (row === 'bass') bass = change.clef
  }
  return treble === 'treble' && bass === 'bass' ? OWN_CLEFS : { treble, bass }
}

/** The clefs a staff's marks should be told about: none, where each staff is in its own. */
export const changedClefs = (clefs: StaffClefs | undefined): StaffClefs | undefined =>
  !clefs || (clefs.treble === 'treble' && clefs.bass === 'bass') ? undefined : clefs

/** A place on the page where something is written: a chord, and which of the song's it is. */
interface Column {
  readonly step: SongStep
  readonly index: number
}

/** How near two moments are and still the same place on the page, in milliseconds. */
const SAME_MOMENT = 30

/**
 * The places of a score: its chords, and the moments between them where a
 * tied note is written again and nothing is struck.
 *
 * A note tied over a bar line has a notehead in the new bar. Where a chord is
 * struck at that moment the head is drawn with it. Where none is — the other
 * hand is resting, or the piece is ending on a chord held through its last
 * bar — there was nowhere to draw it: the head was left out, and a final bar
 * of nothing but tied notes was left off the page altogether. Such a moment
 * is a place of its own, with held noteheads and no chord.
 *
 * Null where every place is a chord, which is most music.
 */
function columnsOf(steps: readonly SongStep[]): readonly Column[] | null {
  const struck = (ms: number): boolean => {
    let low = 0
    let high = steps.length - 1
    while (low < high) {
      const middle = (low + high + 1) >> 1
      if (steps[middle]!.startMs <= ms + SAME_MOMENT) low = middle
      else high = middle - 1
    }
    return steps[low] !== undefined && Math.abs(steps[low]!.startMs - ms) <= SAME_MOMENT
  }
  const moments: number[] = []
  for (const step of steps)
    for (const note of step.notes)
      for (const segment of note.tied ?? [])
        if (segment.startMs > note.startMs && !struck(segment.startMs))
          moments.push(segment.startMs)
  if (moments.length === 0) return null
  moments.sort((a, b) => a - b)
  const distinct = moments.filter((ms, at) => at === 0 || ms - moments[at - 1]! > SAME_MOMENT)

  const columns: Column[] = []
  let next = 0
  for (const [index, step] of steps.entries()) {
    columns.push({ step, index })
    const until = steps[index + 1]?.startMs ?? Infinity
    const between: number[] = []
    while (next < distinct.length && distinct[next]! < until) between.push(distinct[next++]!)
    for (const [at, startMs] of between.entries())
      columns.push({
        step: { notes: [], startMs },
        index: index + (at + 1) / (between.length + 1),
      })
  }
  return columns
}

/**
 * Every chord of the song, measured and spaced but not placed.
 *
 * Spacing is proportional to the time before each chord, so the picture keeps
 * the rhythm, but clamped at both ends: without a floor a run of semiquavers
 * becomes a smear, and without a ceiling one long held chord pushes everything
 * after it off the end of the world. Under both, the ink has the last word —
 * a crowded bar is still readable and two chords printed on top of each other
 * are not.
 */
export function measureScore(
  song: ScoreSource | null,
  every: readonly SongStep[],
  hints?: ReadonlySet<SongNote>,
  /**
   * The pair of staves to measure, of a score written on more than two.
   *
   * Every chord of the piece is still measured, so the pairs count the same
   * chords and can be set under one another; a chord with nothing on this
   * pair is an empty place in it.
   */
  layer?: ScoreLayer,
): Measured[] {
  const staves = song?.staves ?? 2
  /** The staff of this pair a note is written on. Its hand's, on a piano's usual two. */
  const rowOf = (note: SongNote): Staff =>
    layer ? (rowIn(layer, staffNumberOf(note, staves)) ?? 'treble') : staffFor(note.note, note.hand)
  // Every place something is written, of the whole score, so that the pairs
  // of a score on several staves count the same places.
  const columns = columnsOf(every)
  const all = columns ? columns.map((column) => column.step) : every
  /** Which of the song's chords the place at a position in the list is. */
  const indexAt = (position: number) => (columns ? columns[position]!.index : position)
  const steps = layer
    ? all.map((step) => ({
        ...step,
        notes: step.notes.filter((note) => rowIn(layer, staffNumberOf(note, staves)) !== null),
      }))
    : all
  const beat = song ? 60000 / song.bpm : 500
  const fifths = song?.key?.fifths ?? 0
  /** The bars the file laid out. Absent only for a song stored before they were read. */
  const measures = song?.measures
  /** One bar length for the whole piece, which is what spacing needs and bar lines do not. */
  const measureMs = song?.measureMs ?? 2000

  /*
   * What each staff's current bar has already said.
   *
   * One memory per staff, because the two are engraved as separate lines: a
   * sharp printed in the left hand tells a reader nothing about the right.
   */
  const memory = {
    treble: new AccidentalMemory(fifths),
    bass: new AccidentalMemory(fifths),
  }
  let openBar = Number.NaN
  let previous = 0
  /** The clefs at the chord before, to know a change by. Those the piece opens in, to begin with. */
  let clefWas = clefsAt(song?.clefs, steps[0]?.startMs ?? 0, layer)
  const marks = barMarksOf(measures)

  const onStaff = (candidate: SongStep, staff: Staff) =>
    candidate.notes.some((note) => rowOf(note) === staff)

  /*
   * Which bar a chord falls in.
   *
   * Read off the bars the file wrote, which is the only way a pickup, a change
   * of metre or a change of tempo lands where the score puts it. Dividing
   * elapsed time by one bar length draws every bar line of a piece with a
   * pickup two beats late, and every one after a rallentando further out than
   * the last.
   */
  const barOf = (step: SongStep) =>
    measures
      ? measures[barIndexAt(measures, step.startMs)]!.number
      : measureMs > 0
        ? Math.floor(step.startMs / measureMs) + 1
        : 1

  /*
   * The voices each staff carries, bar by bar.
   *
   * A bar is the unit: where a staff has two voices anywhere in a bar, the
   * upper has its stems up and the lower down for the whole of it, including
   * the moments only one of them is sounding. Decided chord by chord instead,
   * a line's stems would flip every time the other line rested.
   */
  const voicesIn = new Map<string, number[]>()
  for (const step of steps) {
    const bar = barOf(step)
    for (const note of step.notes) {
      if (note.voice === undefined) continue
      const key = `${bar}:${rowOf(note)}`
      const seen = voicesIn.get(key) ?? []
      if (!seen.includes(note.voice))
        voicesIn.set(
          key,
          [...seen, note.voice].sort((a, b) => a - b),
        )
    }
  }

  /*
   * Tied notes: where each is written again.
   *
   * A tied note is struck once and written twice or more, and the later
   * noteheads stand at later moments — where, almost always, something else is
   * being struck, in the other hand or the other voice. So each is given to
   * the chord at its own moment, to be drawn with it, with a note of which
   * chord its tie comes from.
   *
   * One that falls where nothing at all is struck has a place of its own to be
   * drawn at (`columnsOf`), which is a chord of held noteheads and nothing else.
   */
  const heldAt = new Map<number, { note: SongNote; fromIndex: number }[]>()
  const tiedOut = new Map<number, { note: number; toIndex: number }[]>()
  const stepNear = (ms: number): number => {
    let low = 0
    let high = steps.length - 1
    while (low < high) {
      const middle = (low + high + 1) >> 1
      if (steps[middle]!.startMs <= ms + SAME_MOMENT) low = middle
      else high = middle - 1
    }
    return steps[low] && Math.abs(steps[low]!.startMs - ms) <= SAME_MOMENT ? low : -1
  }
  for (const [index, step] of steps.entries())
    for (const note of step.notes) {
      let from = index
      for (const segment of note.tied ?? []) {
        const at = stepNear(segment.startMs)
        if (at <= from) continue
        const held: SongNote = {
          ...note,
          written: segment.written,
          finger: undefined,
          rolled: undefined,
          tied: undefined,
        }
        heldAt.set(at, [...(heldAt.get(at) ?? []), { note: held, fromIndex: from }])
        tiedOut.set(from, [...(tiedOut.get(from) ?? []), { note: note.note, toIndex: at }])
        from = at
      }
    }
  // A held note is in its voice as much as a struck one is.
  for (const [at, helds] of heldAt) {
    const bar = barOf(steps[at]!)
    for (const { note } of helds) {
      if (note.voice === undefined) continue
      const key = `${bar}:${rowOf(note)}`
      const seen = voicesIn.get(key) ?? []
      if (!seen.includes(note.voice))
        voicesIn.set(
          key,
          [...seen, note.voice].sort((a, b) => a - b),
        )
    }
  }

  /*
   * Rests: where a hand is waiting.
   *
   * Not every rest the score writes. A staff with two voices rests one of them
   * while the other plays, and those are bookkeeping: the hand is busy. What a
   * player needs to see is the hand with nothing to do, so a rest is kept only
   * where no note of its hand is sounding — and, where both voices of a staff
   * rest at once, once.
   *
   * A rest for a whole bar goes in the middle of its bar. Any other stands at
   * its own moment: with the chord struck then, which will be the other
   * hand's, or in the room before the next chord where nothing is struck.
   */
  const restsBy = new Map<number, RestMark[]>()
  /** The rests waiting in the room before a chord, by the moment each begins. */
  const leadsBy = new Map<number, { at: number; mark: Omit<RestMark, 'back'> }[]>()
  const barRests = new Map<number, Staff[]>()
  if (song?.rests?.length && measures) {
    const sounding = { treble: [] as [number, number][], bass: [] as [number, number][] }
    const filled = new Set<string>()
    for (const step of steps)
      for (const note of step.notes) {
        const staff = rowOf(note)
        sounding[staff].push([note.startMs, note.startMs + note.durationMs])
        // Every bar the note sounds in, not only the one it starts in.
        const last = barIndexAt(measures, note.startMs + note.durationMs - 1)
        for (let at = barIndexAt(measures, note.startMs); at <= last; at++)
          filled.add(`${measures[at]!.number}:${staff}`)
      }
    const seen = new Set<string>()
    for (const rest of [...song.rests].sort((a, b) => b.durationQ - a.durationQ)) {
      const staff: Staff | null = layer
        ? rowIn(layer, staffNumberOf(rest, staves))
        : rest.hand === 'left'
          ? 'bass'
          : 'treble'
      // Another pair's rest.
      if (!staff) continue
      const measure = measures[barIndexAt(measures, rest.startMs)]!
      const endMs = rest.startMs + rest.durationQ * measure.quarterMs
      const whole =
        rest.wholeBar ||
        (Math.abs(rest.startQ - measure.startQ) < 1e-6 &&
          rest.durationQ >= measure.durationQ - 1e-6)
      if (whole) {
        if (
          !filled.has(`${measure.number}:${staff}`) &&
          !barRests.get(measure.number)?.includes(staff)
        )
          barRests.set(measure.number, [...(barRests.get(measure.number) ?? []), staff])
        continue
      }
      if (sounding[staff].some(([from, to]) => from < endMs - 1 && to > rest.startMs + 1)) continue
      const key = `${staff}:${Math.round(rest.startMs)}`
      if (seen.has(key)) continue
      seen.add(key)

      const shape = rest.written ?? writtenValue(endMs - rest.startMs, measure.quarterMs)
      const mark = { staff, value: shape.value, dots: shape.dots, bar: measure.number }
      const at = stepNear(rest.startMs)
      if (at >= 0) restsBy.set(at, [...(restsBy.get(at) ?? []), { ...mark, back: 0 }])
      else {
        // The next chord after it: the rest stands in the room before that.
        const next = steps.findIndex((step) => step.startMs > rest.startMs)
        if (next >= 0) leadsBy.set(next, [...(leadsBy.get(next) ?? []), { at: rest.startMs, mark }])
      }
    }
  }
  let lastBar = Number.NaN

  const measured = steps.map((step, index): Measured => {
    const bar = barOf(step)
    /** The notes written at this moment and held from before, not struck. */
    const helds = heldAt.get(index) ?? []
    const heldNotes = new Set(helds.map(({ note }) => note))
    /** Everything the page writes here: what is struck, and what is held over. */
    const writtenHere = helds.length > 0 ? [...step.notes, ...heldNotes] : step.notes
    /** The first chord of a bar, which has that bar's line to make room for. */
    const opensBar = index > 0 && bar !== openBar
    /** Whether that line is a repeat sign: one closing the bar before, or opening this. */
    const repeats =
      opensBar &&
      (marks.get(bar)?.repeat?.start === true || marks.get(bar - 1)?.repeat?.times !== undefined)
    if (bar !== openBar) {
      memory.treble.startBar()
      memory.bass.startBar()
      openBar = bar
    }

    // How long the notes are *written* as. Where the file said, that is the
    // answer; a performance only implies its durations and a score states them.
    // Otherwise it is the time until this staff next has something — not how
    // long a key was held, because a player releasing early has played a short
    // crotchet, not a quaver.
    //
    // Per staff, because the hands keep their own rhythm. A bar-long chord
    // under a run of quavers is a semibreve, and taking the melody's value for
    // it writes it as a crotchet with a stem.
    const value = { treble: valueOn('treble'), bass: valueOn('bass') }
    function valueOn(staff: Staff): WrittenValue {
      const here = writtenHere.filter((note) => rowOf(note) === staff)
      if (here.length === 0) return writtenValue(beat, beat)

      // One stem per staff, so one value for the chord under it: the longest,
      // which is the same note the held-duration fallback below would pick.
      const stated = here
        .map((note) => note.written)
        .filter((given) => given !== undefined)
        .sort((a, b) => valueQuarters(b.value, b.dots) - valueQuarters(a.value, a.dots))[0]
      if (stated) return written(stated.value, stated.dots)

      let next: SongStep | undefined
      for (let i = index + 1; i < steps.length; i++) {
        if (onStaff(steps[i]!, staff)) {
          next = steps[i]
          break
        }
      }
      const held = Math.max(...here.map((note) => note.durationMs))
      return writtenValue(next ? next.startMs - step.startMs : held, beat)
    }

    /*
     * The chord as it will be drawn.
     *
     * Including which fingerings the page prints: the extent is what decides
     * how much room the next chord gets, and reserving space for a numeral
     * that the reader's density setting suppresses spaces the whole score for
     * ink that is never laid down.
     */
    // The clef each staff is in at this moment, and whether either has just
    // changed. The clef the piece opens in is not a change: the head of the
    // line says it.
    const clefs = clefsAt(song?.clefs, step.startMs, layer)
    const changed = (['treble', 'bass'] as const).filter((staff) => clefs[staff] !== clefWas[staff])
    clefWas = clefs
    const sorted = [...writtenHere].sort((a, b) => a.note - b.note)
    const notes: DrawnNote[] = sorted.map((note) => {
      const held = heldNotes.has(note)
      const on = rowOf(note)
      const drawn = {
        note: note.note,
        ...(layer ? { row: on } : {}),
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

    /*
     * The step's voices, where a staff has two in this bar.
     *
     * The upper voice's notes are one chord with its stem up, the lower's
     * another with its stem down, and each is as long as its own notes are
     * written. Where their heads would land on each other — a second apart, or
     * the same line with different heads — the lower steps to the right.
     */
    const parts = ((): VoicePart[] | undefined => {
      const voicesOn = (staff: Staff) => voicesIn.get(`${bar}:${staff}`) ?? []
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

        const lengthOf = (group: typeof here): WrittenValue => {
          const stated = group
            .map(({ note }) => note.written)
            .filter((given) => given !== undefined)
            .sort((a, b) => valueQuarters(b.value, b.dots) - valueQuarters(a.value, a.dots))[0]
          return stated ? written(stated.value, stated.dots) : value[staff]
        }
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
    })()
    // What each staff's first voice is written as: the one a beam is worked
    // out for, and the one the rest of the page asks about.
    const shown = parts
      ? {
          treble: parts.find((part) => part.staff === 'treble')?.value ?? value.treble,
          bass: parts.find((part) => part.staff === 'bass')?.value ?? value.bass,
        }
      : value

    const ink = parts ? partsExtent(parts, fifths) : chordExtent(notes, value, fifths)
    // A change of clef is set just in front of the chord, in room of its own.
    const clefRoom = changed.length > 0 ? CLEF_CHANGE_WIDTH + STEP : 0
    const inked = clefRoom > 0 ? { ...ink, left: ink.left + clefRoom } : ink
    /*
     * The rests with this chord.
     *
     * Those at its own moment stand in its column, on the other staff. Those
     * before it take a place each in the room in front, in the order they
     * come, two that begin together sharing one — the last nearest the chord.
     */
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

    /** The bars since the last chord in which nothing at all is struck, and who rests in them. */
    const emptyBars: { bar: number; staves: Staff[] }[] = []
    if (index > 0 && bar - lastBar > 1 && bar - lastBar <= 64)
      for (let empty = lastBar + 1; empty < bar; empty++)
        if (barRests.has(empty)) emptyBars.push({ bar: empty, staves: barRests.get(empty)! })
    const firstOfBar = bar !== lastBar
    lastBar = bar

    let gap = 0
    if (index > 0) {
      const elapsed = step.startMs - steps[index - 1]!.startMs
      const rhythmic = Math.min(MAX_GAP, (elapsed / measureMs) * (song?.barWidth ?? MEASURE_WIDTH))
      gap = Math.max(
        song?.minGap ?? MIN_GAP,
        rhythmic,
        previous +
          extent.left +
          AIR +
          lead +
          emptyBars.length * EMPTY_BAR +
          (opensBar ? BAR_ROOM : 0) +
          (repeats ? REPEAT_ROOM : 0),
      )
    }
    previous = extent.right

    /** The tuplet a staff's notes are written inside, if the score put them in one. */
    const tupletOn = (staff: Staff) =>
      step.notes.find((note) => rowOf(note) === staff && note.written?.tuplet)?.written?.tuplet
    const tuplet = {
      ...(tupletOn('treble') ? { treble: tupletOn('treble')! } : {}),
      ...(tupletOn('bass') ? { bass: tupletOn('bass')! } : {}),
    }

    return {
      // The chord as the score has it, every pair's notes and all: the keys
      // are watched for the whole of it.
      step: all[index]!,
      index: indexAt(index),
      notes,
      value: shown,
      ...(parts ? { parts } : {}),
      ...(helds.length > 0
        ? {
            ties: helds.map(({ note, fromIndex }) => ({
              note: note.note,
              fromIndex: indexAt(fromIndex),
            })),
          }
        : {}),
      ...(tiedOut.has(index)
        ? {
            tiesOut: tiedOut
              .get(index)!
              .map(({ note, toIndex }) => ({ note, toIndex: indexAt(toIndex) })),
          }
        : {}),
      ...(rests.length > 0 ? { rests } : {}),
      ...(firstOfBar && barRests.has(bar) ? { barRest: barRests.get(bar)! } : {}),
      ...(emptyBars.length > 0 ? { emptyBars } : {}),
      extent,
      ...(changedClefs(clefs) ? { clefs } : {}),
      ...(changed.length > 0
        ? {
            clefChange: {
              at: ink.left + STEP * 0.6 + CLEF_CHANGE_WIDTH / 2,
              ...Object.fromEntries(changed.map((staff) => [staff, clefs[staff]])),
            },
          }
        : {}),
      gap,
      bar,
      ...(tuplet.treble || tuplet.bass ? { tuplet } : {}),
    }
  })

  return song?.beams ? beamed(measured, beat, measureMs, measures) : measured
}

/**
 * Says which chords share a beam.
 *
 * A beam joins the short notes of one beat: notes with a flag, one straight
 * after another, on the same staff, in the same bar. A rest breaks it, and so
 * does a note long enough to stand without a flag. Quavers in common time are
 * the one case that runs further — four to a beam, half a bar — because that is
 * how every scale book prints a scale in quavers, and two-note beams the length
 * of a page read as hiccups.
 *
 * Each staff is grouped by itself. The hands keep their own rhythm, and a beam
 * never joins them.
 */
function beamed(
  measured: readonly Measured[],
  beat: number,
  measureMs: number,
  /** The bars as the score wrote them, where it did: each has its own start, tempo and metre. */
  measures?: Song['measures'],
): Measured[] {
  const beamOf: Record<BeamLine, Map<number, number>> = {
    treble: new Map(),
    bass: new Map(),
    treble2: new Map(),
    bass2: new Map(),
  }
  let nextId = 0

  /**
   * The bar a moment falls in: where it starts, how long a crotchet lasts in
   * it, how long its beat is, and how many crotchets it holds.
   *
   * A beat is a crotchet, except in compound time — six, nine or twelve
   * quavers to the bar, and three to a bar of 3/8 — where it is three quavers
   * and the beam runs across all three.
   */
  const barAt = (startMs: number, bar: number) => {
    const written = measures?.[barIndexAt(measures, startMs)]
    if (!written)
      return {
        startMs: (bar - 1) * measureMs,
        quarterMs: beat,
        beatMs: beat,
        quarters: Math.round(measureMs / beat),
      }
    const compound = written.beatType === 8 && written.beats % 3 === 0
    return {
      startMs: written.startMs,
      quarterMs: written.quarterMs,
      beatMs: written.quarterMs * (compound ? 1.5 : 1),
      quarters: compound ? 0 : Math.round((written.beats * 4) / written.beatType),
    }
  }

  for (const line of BEAM_LINES) {
    /** The beam being gathered, if one is open. */
    interface Group {
      members: number[]
      bar: number
      beat: number
      end: number
      plain: boolean
    }
    const open: { group: Group | null } = { group: null }
    const close = () => {
      if (open.group && open.group.members.length > 1) {
        const id = nextId++
        for (const index of open.group.members) beamOf[line].set(index, id)
      }
      open.group = null
    }

    for (const entry of measured) {
      // Each voice is beamed by itself: the hands keep their own rhythm, and
      // so do two voices in one hand.
      const voice = voiceOn(entry, line)
      if (!voice) continue
      const value = voice.value
      const tuplet = entry.step.notes.find(
        (note) => note.written?.tuplet && voice.notes.some((drawn) => drawn.note === note.note),
      )?.written?.tuplet
      const start = entry.step.startMs
      const bar = barAt(start, entry.bar)
      const length =
        valueQuarters(value.value, value.dots) *
        bar.quarterMs *
        (tuplet ? tuplet.normal / tuplet.actual : 1)
      // Which beat of its bar it starts on. The small allowance is for thirds
      // of a beat, which do not add up to a whole one in floating point.
      const inBar = start - bar.startMs
      const onBeat = Math.floor(inBar / bar.beatMs + 1e-6)
      const plain = value.flags === 1 && !value.dotted && !tuplet

      if (value.flags === 0) {
        close()
        continue
      }
      const current = open.group
      if (
        current !== null &&
        current.bar === entry.bar &&
        // Two milliseconds: a bar read from a score puts its notes where its
        // tempo marks say, and they add up to within a rounding of each other.
        Math.abs(start - current.end) < 2 &&
        (onBeat === current.beat ||
          // Plain quavers in four: beats one and two, or three and four.
          (current.plain &&
            plain &&
            bar.quarters === 4 &&
            Math.floor(onBeat / 2) === Math.floor(current.beat / 2)))
      ) {
        current.members.push(entry.index)
        current.end = start + length
        current.plain = current.plain && plain
      } else {
        close()
        open.group = {
          members: [entry.index],
          bar: entry.bar,
          beat: onBeat,
          end: start + length,
          plain,
        }
      }
    }
    close()
  }

  return measured.map((entry) => {
    const beam: Partial<Record<BeamLine, number>> = {}
    for (const line of BEAM_LINES) {
      const id = beamOf[line].get(entry.index)
      if (id !== undefined) beam[line] = id
    }
    return Object.keys(beam).length > 0 ? { ...entry, beam } : entry
  })
}

/**
 * The song's chords, measured, kept until the song, the part or the printed
 * fingering changes.
 *
 * The fingering belongs in here rather than in the drawing because a printed
 * numeral takes room on the page, and a score spaced for numbers it does not
 * print is spaced wrong.
 */
export function useMeasuredScore(
  song: Song | null,
  part: SongPart,
  hints?: ReadonlySet<SongNote>,
  /**
   * Spaced for the printed page rather than for the moving staff.
   *
   * The moving staff shows a few bars and gives them room; a page is read a
   * line at a time and wants as many bars on the line as an engraver would
   * set. Same notes, same ink, less air between them.
   */
  page = false,
) {
  const steps = React.useMemo(() => (song ? songSteps(song, part) : []), [song, part])
  const source = React.useMemo<ScoreSource | null>(
    () =>
      song && {
        ...song,
        // A score states every length, so its short notes can be beamed. A
        // performance only implies them.
        beams: song.provides?.rhythm === true,
        // The rests of the hands being shown. A hand that is not on the page
        // has no silences to mark on it.
        rests: song.rests?.filter((rest) => part === 'both' || rest.hand === part),
        ...(page ? { barWidth: PAGE_BAR_WIDTH, minGap: PAGE_MIN_GAP } : {}),
      },
    [song, page, part],
  )
  const score = React.useMemo((): {
    /** Every chord, measured: the whole system's, where the score has more than one pair of staves. */
    measured: readonly Measured[]
    /** Each pair's chords, on a score written on more than two staves. */
    layers?: readonly (readonly Measured[])[]
    /** The stretches of such a score that are drawn on the same staves. */
    regions?: readonly ScoreRegion[]
  } => {
    const pairs = layersOf(song?.staves)
    if (!song || !pairs) return { measured: measureScore(source, steps, hints) }
    const { layers, outline } = alignLayers(
      pairs.map((pair) => measureScore(source, steps, hints, pair)),
    )
    return { measured: outline, layers, regions: regionsOf(song, outline, pairs) }
  }, [song, source, steps, hints])
  return { steps, ...score }
}

/**
 * Set the pairs of a score's staves under one another.
 *
 * Each pair was measured by itself, and gave each chord the room its own ink
 * asks for. On the page the pairs are one system: a chord is one column down
 * all of them. So every chord takes the widest room any pair wanted for it —
 * and `outline` is the system seen as a whole, for the things that are
 * decided once for all its staves: where the lines break, and where the bar
 * lines stand.
 */
export function alignLayers(layers: readonly (readonly Measured[])[]): {
  layers: Measured[][]
  outline: Measured[]
} {
  const outline = (layers[0] ?? []).map((entry, at): Measured => {
    const all = layers.map((layer) => layer[at]!)
    const rests = all.flatMap((each) => each.rests ?? [])
    return {
      ...entry,
      notes: all.flatMap((each) => each.notes),
      gap: Math.max(...all.map((each) => each.gap)),
      // Sideways, the widest of them. Up and down mean nothing across pairs,
      // each of which measures from its own middle: `layoutOf` asks the pairs.
      extent: {
        ...entry.extent,
        left: Math.max(...all.map((each) => each.extent.left)),
        right: Math.max(...all.map((each) => each.extent.right)),
      },
      ...(rests.length > 0 ? { rests } : {}),
    }
  })
  return {
    layers: layers.map((layer) =>
      layer.map((entry, at) =>
        entry.gap === outline[at]!.gap ? entry : { ...entry, gap: outline[at]!.gap },
      ),
    ),
    outline,
  }
}

/** How many bars a staff is empty for before the page leaves it out. */
const HIDE_AFTER = 8

/** A stretch of a score drawn on the same staves throughout. */
export interface ScoreRegion {
  /** The half-open run of places it holds, counted along the measured list. */
  readonly from: number
  readonly to: number
  /** Which staves of each pair are drawn through it. */
  readonly rows: readonly RowsShown[]
}

/**
 * Which staves each stretch of a score is drawn on.
 *
 * A piece on four staves is seldom on four throughout. The extra staves are
 * there for the pages that need them, and a printed score leaves them off the
 * pages that do not: two staves until the music thickens, four after. So a
 * staff with nothing on it for a good many bars is left out for as long as it
 * is empty — never fewer than two, because a piano is two hands whether or not
 * one of them is resting.
 *
 * Read from the whole piece, not from the hand being practised: which staves
 * a page has does not change with who is playing from it.
 */
export function regionsOf(
  song: Pick<Song, 'notes' | 'measures' | 'staves'>,
  /** The places of the score, in order: its chords, as measured or as the song has them. */
  places: readonly (SongStep | Pick<Measured, 'step'>)[],
  pairs: readonly ScoreLayer[],
): ScoreRegion[] {
  const steps = places.map((place) => ('step' in place ? place.step : place))
  const measures = song.measures
  const count = song.staves ?? 2
  const everything = (): ScoreRegion[] => [
    {
      from: 0,
      to: steps.length,
      rows: pairs.map((pair) => ({
        treble: pair.treble !== undefined,
        bass: pair.bass !== undefined,
      })),
    },
  ]
  if (!measures?.length || steps.length === 0) return everything()

  /** Whether each staff, counted from one, has a note sounding in each bar. */
  const used = Array.from({ length: count + 1 }, () =>
    new Array<boolean>(measures.length).fill(false),
  )
  for (const note of song.notes) {
    if (note.role !== 'keyboard') continue
    const row = used[Math.min(count, Math.max(1, staffNumberOf(note, count)))]!
    const last = barIndexAt(measures, note.startMs + note.durationMs - 1)
    for (let bar = barIndexAt(measures, note.startMs); bar <= last; bar++) row[bar] = true
  }
  // Left out only through a long silence: a staff that came and went with
  // every bar's rest would have the page rearranging itself as it was read.
  const drawn = used.map((row) => {
    const kept = row.map(() => true)
    for (let bar = 0; bar < row.length;) {
      let end = bar
      while (end < row.length && !row[end]) end++
      if (end - bar >= HIDE_AFTER) kept.fill(false, bar, end)
      bar = Math.max(end, bar + 1)
    }
    return kept
  })
  const sets = measures.map((_, bar) => {
    const set = new Set<number>()
    for (let staff = 1; staff <= count; staff++) if (drawn[staff]![bar]) set.add(staff)
    return set
  })
  // Never fewer than two: a bar that would be left with one staff keeps the
  // staves of the bars beside it.
  for (let bar = 1; bar < sets.length; bar++)
    if (sets[bar]!.size < 2) for (const staff of sets[bar - 1]!) sets[bar]!.add(staff)
  for (let bar = sets.length - 2; bar >= 0; bar--)
    if (sets[bar]!.size < 2) for (const staff of sets[bar + 1]!) sets[bar]!.add(staff)
  if (sets.some((set) => set.size < 2)) return everything()

  const regions: (ScoreRegion & { key: string })[] = []
  for (const [index, step] of steps.entries()) {
    const set = sets[barIndexAt(measures, step.startMs)]!
    const key = [...set].sort((a, b) => a - b).join()
    const open = regions.at(-1)
    if (open && open.key === key) {
      regions[regions.length - 1] = { ...open, to: index + 1 }
      continue
    }
    regions.push({
      key,
      from: index,
      to: index + 1,
      rows: pairs.map((pair) => ({
        treble: pair.treble !== undefined && set.has(pair.treble),
        bass: pair.bass !== undefined && set.has(pair.bass),
      })),
    })
  }
  return regions.map(({ from, to, rows }) => ({ from, to, rows }))
}

/** Where the time signature's numerals are centred, after the key. */
export function timeX(fifths: number): number {
  return KEY_X + keyWidth(fifths) + (fifths === 0 ? 0 : STEP * 2) + TIME_HALF
}

/**
 * Where a system's first chord can sit.
 *
 * After the clefs, the key and — on the opening system only — the metre, with
 * room left over: an engraver does not begin the first bar hard against the
 * time signature. Measured rather than fixed, because a system that reserves
 * room for seven sharps it does not have has thrown away a bar of a short line.
 */
export function headerEnd(fifths: number, withTime: boolean): number {
  const after = withTime ? timeX(fifths) + TIME_HALF : KEY_X + keyWidth(fifths)
  return after + STEP * 4
}

/**
 * How tall a run of chords needs its frame to be.
 *
 * `HALF_HEIGHT` holds a grand staff and its clefs, and for most music that is
 * the whole answer. It is not always: a chord in the top octave
 * carries four ledger lines and its fingering above them, and a fixed frame
 * cuts them off — noteheads and all, with the staff beneath looking perfectly
 * correct.
 *
 * Each edge is measured on its own. A piece that climbs is not a reason to
 * open up room underneath it: growing both ways would shrink the staff twice
 * as much as the music asks for, and the extra would be blank paper.
 */
export function frameOf(
  measured: readonly Measured[],
  /** The marked bars, where the run may have an ending bracket over it. */
  marks?: BarMarks,
  /** How far the system's staves have been moved apart (`spreadOf`). */
  spread = 0,
): { top: number; bottom: number } {
  let top = Math.min(-HALF_HEIGHT, yOn(14, 'treble') - BAR_NUMBER_INK)
  // A bracket over an ending stands above the bar numbers, and its number
  // above that.
  if (marks?.size && measured.some((entry) => marks.get(entry.bar)?.ending))
    top = Math.min(top, VOLTA_Y - STEP * 1.5)
  let bottom = HALF_HEIGHT
  for (const { extent } of measured) {
    top = Math.min(top, extent.top)
    bottom = Math.max(bottom, extent.bottom)
  }
  // An opened system is taller by what it opened: the treble staff and all it
  // carries went up by the spread, and the bass staff down.
  return { top: Math.floor(top - spread), bottom: Math.ceil(bottom + spread) }
}

/** The least room kept between one staff's ink and the other's: a staff space. */
const STAFF_CLEAR = STEP * 2

/**
 * How far to move the staves of a system apart so the two hands are not drawn
 * through each other.
 *
 * Each staff is its hand's, whatever the pitch: a right hand below middle C is
 * written under the treble staff on ledger lines, and a left hand above it
 * over the bass staff. At the plain distance that works until both happen in
 * one bar. Then the treble's lowest ink — a notehead, the end of a stem, a
 * numeral — is lower on the page than the bass's highest, and the bar is a
 * thicket nobody can read. A printed page gives that system more room between
 * its staves. This says how much: enough that in every bar the two keep a
 * staff space clear of each other.
 *
 * By the bar because that is what collides: a beam runs across its bar, and a
 * stem two chords along is as much in the way as the one beside it. And one
 * answer for the whole run, the worst bar's, because a system has one distance
 * between its staves — spacing that changed from chord to chord would have the
 * staff itself moving under the player's eye.
 *
 * Zero for most music, which is the point: a piece that keeps to its staves is
 * drawn exactly as it always was.
 */
export function spreadOf(measured: readonly Measured[]): number {
  const bars = new Map<number, { treble: number; bass: number }>()
  for (const { bar, extent } of measured) {
    const reach = bars.get(bar) ?? { treble: -Infinity, bass: Infinity }
    if (extent.inner.treble !== undefined)
      reach.treble = Math.max(reach.treble, extent.inner.treble)
    if (extent.inner.bass !== undefined) reach.bass = Math.min(reach.bass, extent.inner.bass)
    bars.set(bar, reach)
  }
  let overlap = 0
  for (const { treble, bass } of bars.values())
    if (Number.isFinite(treble) && Number.isFinite(bass))
      overlap = Math.max(overlap, treble - bass + STAFF_CLEAR)
  // Each staff takes half of it.
  return Math.ceil(overlap / 2)
}

/** From one staff's top line to the next's, on a plain system. */
const STAFF_APART = STAFF_BANDS.bass.top - STAFF_BANDS.treble.top
/** What a frame keeps clear above its top staff and below its bottom one: the room the clefs reach into. */
const HEAD_ROOM = HALF_HEIGHT + STAFF_BANDS.treble.top
const BOTH_ROWS: RowsShown = { treble: true, bass: true }

/** Where everything of a system stands, top to bottom. */
export interface SystemLayout {
  /** Each pair of staves: how far down the system it is, how far it has opened, and which of its two it has. */
  readonly layers: readonly LayerPlace[]
  /** The top line of every staff drawn, from the top of the system down. */
  readonly staves: readonly number[]
  /** The frame that holds all of it. */
  readonly top: number
  readonly bottom: number
}

/** How far one staff's ink reaches above and below its own top line, bar by bar. */
function staffReach(measured: readonly Measured[], row: Staff) {
  const line = STAFF_BANDS[row].top
  const bars = new Map<number, { up: number; down: number }>()
  for (const { bar, extent } of measured) {
    const up = row === 'treble' ? extent.outer.treble : extent.inner.bass
    const down = row === 'treble' ? extent.inner.treble : extent.outer.bass
    if (up === undefined || down === undefined) continue
    const reach = bars.get(bar) ?? { up: Infinity, down: -Infinity }
    reach.up = Math.min(reach.up, up - line)
    reach.down = Math.max(reach.down, down - line)
    bars.set(bar, reach)
  }
  return bars
}

/**
 * Lay a system out from the top: where each of its staves stands.
 *
 * One pair of staves is a piano's usual system, opened by its `spreadOf` and
 * framed by `frameOf`, and comes out of here exactly as those two say. More
 * than one — or a pair with a staff left out — is the same question asked of
 * every two staves that are neighbours on the page, whichever pairs they
 * belong to: the plain distance, or more where in some bar the upper one's ink
 * comes down past the lower one's. So a staff of chords under a staff of
 * ledger lines gets the room, and the staves either side of them do not.
 *
 * One answer for the whole run, as with a single pair: the staves of a system
 * do not move while it is read.
 */
export function layoutOf(
  layers: readonly (readonly Measured[])[],
  /** Which staves of each pair are drawn. All of them, where it does not say. */
  rows?: readonly RowsShown[],
  marks?: BarMarks,
): SystemLayout {
  const shown = (at: number): RowsShown => rows?.[at] ?? BOTH_ROWS
  if (layers.length === 1 && shown(0).treble && shown(0).bass) {
    const spread = spreadOf(layers[0]!)
    return {
      layers: [{ offset: 0, spread, rows: BOTH_ROWS }],
      staves: [STAFF_BANDS.treble.top - spread, STAFF_BANDS.bass.top + spread],
      ...frameOf(layers[0]!, marks, spread),
    }
  }

  const slots = layers.flatMap((layer, at) =>
    (['treble', 'bass'] as const)
      .filter((row) => shown(at)[row])
      .map((row) => ({ at, row, reach: staffReach(layer, row) })),
  )
  const tops: number[] = []
  for (const [index, slot] of slots.entries()) {
    const above = slots[index - 1]
    if (!above) {
      tops.push(STAFF_BANDS.treble.top)
      continue
    }
    let overlap = 0
    for (const [bar, upper] of above.reach) {
      const lower = slot.reach.get(bar)
      if (lower) overlap = Math.max(overlap, upper.down - lower.up + STAFF_CLEAR - STAFF_APART)
    }
    // In whole steps either way, as a single pair opens.
    tops.push(tops[index - 1]! + STAFF_APART + Math.ceil(overlap / 2) * 2)
  }

  const places = layers.map((_, at): LayerPlace => {
    const upper = slots.findIndex((slot) => slot.at === at && slot.row === 'treble')
    const lower = slots.findIndex((slot) => slot.at === at && slot.row === 'bass')
    if (upper >= 0 && lower >= 0) {
      const spread = (tops[lower]! - tops[upper]! - STAFF_APART) / 2
      return { offset: tops[upper]! - STAFF_BANDS.treble.top + spread, spread, rows: shown(at) }
    }
    if (upper >= 0)
      return { offset: tops[upper]! - STAFF_BANDS.treble.top, spread: 0, rows: shown(at) }
    if (lower >= 0)
      return { offset: tops[lower]! - STAFF_BANDS.bass.top, spread: 0, rows: shown(at) }
    return { offset: 0, spread: 0, rows: shown(at) }
  })

  const first = tops[0] ?? STAFF_BANDS.treble.top
  let top = first - HEAD_ROOM
  // A bracket over an ending stands above the bar numbers, and its number
  // above that: as far over the top staff as it is on a plain system.
  if (marks?.size && layers[0]?.some((entry) => marks.get(entry.bar)?.ending))
    top = Math.min(top, first - (STAFF_BANDS.treble.top - (VOLTA_Y - STEP * 1.5)))
  let bottom = (tops.at(-1) ?? first) + STAFF_HEIGHT + HEAD_ROOM
  for (const [index, slot] of slots.entries())
    for (const reach of slot.reach.values()) {
      top = Math.min(top, tops[index]! + reach.up)
      bottom = Math.max(bottom, tops[index]! + reach.down)
    }
  return { layers: places, staves: tops, top: Math.floor(top), bottom: Math.ceil(bottom) }
}

export interface Placed extends Measured {
  readonly x: number
  /** The ties arriving here, each with where it comes from on this line. */
  readonly arcs?: readonly TieArc[]
  /** The notes whose tie leaves this line, to be finished on the next. */
  readonly arcsOut?: readonly number[]
  /** Its rests, each where it stands on this line. */
  readonly restsAt?: readonly (RestMark & { readonly x: number })[]
}

/**
 * How much later a line starts for the rests in front of its first chord.
 *
 * A rest before a chord stands in the gap that leads to it, and the first
 * chord of a line has no gap: left where it was measured, the rest is drawn
 * on top of the time signature. So the rest furthest in front takes the place
 * the chord would have had, and the chord follows at the distance they were
 * measured apart.
 */
export function leadIn(first: Measured | undefined): number {
  return Math.max(0, ...(first?.rests ?? []).map((rest) => rest.back))
}

/**
 * Lay a run of chords out from a starting point, keeping their measured gaps.
 *
 * `stretch` justifies a system: engraved music fills its line, and a page of
 * lines that each stop wherever the music happened to run out reads as a
 * draft rather than as a score.
 */
export function place(
  measured: readonly Measured[],
  startX: number,
  stretch = 1,
  /**
   * How much later the line starts for the rests in front of its first chord.
   * Its own, unless it is one pair of staves of several, which all start where
   * the one with the most in front of it has to.
   */
  lead = leadIn(measured[0]),
): Placed[] {
  let x = startX + lead
  const placed = measured.map((entry, index): Placed => {
    if (index > 0) x += entry.gap * stretch
    // A rest in front of the chord keeps its share of the room as the line is
    // opened up. The first chord of a line has no room to share, and its
    // rests stand as close as they were measured.
    const open = index > 0 ? stretch : 1
    return {
      ...entry,
      x,
      ...(entry.rests
        ? { restsAt: entry.rests.map((rest) => ({ ...rest, x: x - rest.back * open })) }
        : {}),
    }
  })
  if (!placed.some((entry) => entry.ties || entry.tiesOut)) return placed

  // A tie is drawn from one chord to another, so it needs both placed. One
  // whose other end is on another line is drawn as far as the edge of this.
  const at = new Map(placed.map((entry) => [entry.index, entry.x]))
  return placed.map((entry) => {
    const leaving = entry.tiesOut?.filter((tie) => !at.has(tie.toIndex)).map((tie) => tie.note)
    if (!entry.ties && !leaving?.length) return entry
    return {
      ...entry,
      ...(entry.ties
        ? {
            arcs: entry.ties.map((tie) => ({
              note: tie.note,
              fromX: at.get(tie.fromIndex) ?? null,
            })),
          }
        : {}),
      ...(leaving?.length ? { arcsOut: leaving } : {}),
    }
  })
}

/** How far a bar line stands in front of the first ink of its bar. */
const BAR_LEAD = STEP * 2.4
/** The least a bar line keeps from the ink of the bar it closes. */
const BAR_TRAIL = STEP * 0.8
/** The most bars with nothing struck in them that get a line each between two chords. */
const MAX_EMPTY_BARS = 16

/**
 * The bar lines of a run of chords: one for every bar, each numbered.
 *
 * A line stands just in front of the bar it opens — a bar's first note follows
 * its line closely, and the room a long note is given is after it, inside its
 * own bar. Halfway between the two chords, which is where these used to be
 * drawn, put the line in the middle of that room and left a semibreve looking
 * as though it belonged to neither bar.
 *
 * And every bar gets one, including a bar in which nothing is struck: a chord
 * held across three bars has three bar lines over it, and counting bars on a
 * page that skips the quiet ones gives the wrong number. Those lines share the
 * room between the two chords evenly.
 */
export function barLinesIn(placed: readonly Placed[], marks?: BarMarks): BarLine[] {
  const lines: BarLine[] = []
  for (let i = 1; i < placed.length; i++) {
    const before = placed[i - 1]!
    const after = placed[i]!
    if (after.bar === before.bar) continue
    // A rest in front of the chord is in one bar or the other: the line goes
    // after the ones that end the bar before, and before the ones that begin
    // this bar.
    const closing = (after.restsAt ?? []).filter((rest) => rest.bar < after.bar && rest.back > 0)
    const opening = (after.restsAt ?? []).filter((rest) => rest.bar >= after.bar && rest.back > 0)
    const earliest =
      Math.max(before.x + before.extent.right, ...closing.map((rest) => rest.x + REST_HALF)) +
      BAR_TRAIL
    const last = Math.max(
      earliest,
      Math.min(after.x - after.extent.left, ...opening.map((rest) => rest.x - REST_HALF)) -
        BAR_LEAD,
    )
    const count = Math.min(MAX_EMPTY_BARS, Math.max(1, after.bar - before.bar))
    for (let n = 1; n <= count; n++) {
      const bar = after.bar - (count - n)
      lines.push({
        x: earliest + ((last - earliest) * n) / count,
        bar,
        ...(marks?.get(bar - 1)?.repeat?.times !== undefined ? { closes: true } : {}),
        ...(marks?.get(bar)?.repeat?.start ? { opens: true } : {}),
      })
    }
  }
  return lines
}

/** A bar line: where it stands, the bar it opens, and whether it is a repeat sign. */
export interface BarLine {
  readonly x: number
  readonly bar: number
  /** A repeat ends on it: dots before it, facing back. */
  readonly closes?: boolean
  /** A repeat begins on it: dots after it, facing on. */
  readonly opens?: boolean
}

/** How high an ending bracket runs, above the bar numbers. */
export const VOLTA_Y = yOn(19, 'treble')

/** One bar's stretch of an ending bracket. */
export interface Volta {
  readonly from: number
  readonly to: number
  /** Its number — "1." — where the bracket begins on this bar. */
  readonly label?: string
  /** The bracket comes down at the end of this bar: the ending leads back. */
  readonly closed: boolean
}

/**
 * The ending brackets over a run of chords.
 *
 * A bracket runs over the bars played only some of the times through: "1."
 * over the bar that leads back, "2." over the bar that leads on. Bar by bar,
 * from one bar line to the next, with the run's own ends standing in for the
 * lines it does not have.
 */
export function voltasIn(
  placed: readonly Placed[],
  lines: readonly BarLine[],
  marks: BarMarks | undefined,
  startX: number,
  endX: number,
): Volta[] {
  if (!marks?.size || placed.length === 0) return []
  const voltas: Volta[] = []
  const first = placed[0]!.bar
  const last = Math.max(placed.at(-1)!.bar, lines.at(-1)?.bar ?? first)
  for (let bar = first; bar <= last; bar++) {
    const ending = marks.get(bar)?.ending
    if (!ending) continue
    const before = marks.get(bar - 1)?.ending
    const after = marks.get(bar + 1)?.ending
    const same = (other: readonly number[] | undefined) => other?.join() === ending.join()
    voltas.push({
      from: bar === first ? startX : (lines.find((line) => line.bar === bar)?.x ?? startX),
      to: lines.find((line) => line.bar === bar + 1)?.x ?? endX,
      ...(same(before) ? {} : { label: `${ending.join(', ')}.` }),
      closed: !same(after) && marks.get(bar)?.repeat?.times !== undefined,
    })
  }
  return voltas
}

/** A rest for a whole bar: where the middle of its bar is, and the staff it is on. */
export interface BarRest {
  readonly x: number
  readonly staff: Staff
  readonly bar: number
}

/**
 * The whole-bar rests of a run, each in the middle of its bar.
 *
 * In the middle, between the bar's two lines, which is where one is always
 * printed: it is the bar that is silent, not a beat of it.
 */
export function barRestsIn(
  placed: readonly Placed[],
  lines: readonly BarLine[],
  startX: number,
  endX: number,
): BarRest[] {
  const found: BarRest[] = []
  const first = placed[0]?.bar
  const middle = (bar: number) => {
    const from = bar === first ? startX : (lines.find((line) => line.bar === bar)?.x ?? startX)
    const to = lines.find((line) => line.bar === bar + 1)?.x ?? endX
    return (from + to) / 2
  }
  for (const entry of placed) {
    for (const staff of entry.barRest ?? [])
      found.push({ x: middle(entry.bar), staff, bar: entry.bar })
    // A bar with no chord of its own is found through the chord after it —
    // unless that chord starts the line, and the bar was on the one before.
    if (entry !== placed[0])
      for (const empty of entry.emptyBars ?? [])
        for (const staff of empty.staves)
          found.push({ x: middle(empty.bar), staff, bar: empty.bar })
  }
  return found
}

/** Where the music of a run ends, for the line that closes it. */
export function endOf(placed: readonly Placed[]): number {
  const last = placed.at(-1)
  return last ? last.x + last.extent.right + BAR_LEAD : 0
}

/** The most a system's gaps may be opened up to fill its line. */
const MAX_STRETCH = 2.5
/** Below this much of the line, a system is left short rather than pulled apart. */
const MIN_FILL = 0.55
/** The air kept at the end of a system, before its closing bar line. */
const RIGHT_MARGIN = STEP * 6

export interface System {
  /** The half-open run of chords this line holds. */
  readonly from: number
  readonly to: number
  /** How much its gaps are opened up to fill the line. */
  readonly stretch: number
}

/**
 * Where the lines break.
 *
 * Chords are added until the next one would not fit, and then the break moves
 * back to the last bar line — engraved music breaks between bars, and a system
 * that ends mid-bar reads as a mistake even to someone who could not say why.
 * If a single bar is wider than the line there is nowhere to move back to, so
 * it breaks where it overflows and stays readable.
 *
 * Every system takes at least one chord, so a chord too wide for any line
 * still ends the loop.
 */
export function breakIntoSystems(
  measured: readonly Measured[],
  fifths: number,
  width: number,
  /**
   * The chords a new line has to begin on, whatever room is left: where the
   * staves the music is drawn on change, which a line cannot do halfway along.
   */
  breaks?: ReadonlySet<number>,
): System[] {
  const systems: System[] = []
  let from = 0

  while (from < measured.length) {
    const start = headerEnd(fifths, from === 0) + leadIn(measured[from])
    let x = start
    let to = from + 1
    let lastBar = -1
    let forced = false
    for (let i = from + 1; i < measured.length; i++) {
      if (breaks?.has(i)) {
        forced = true
        break
      }
      const at = x + measured[i]!.gap
      if (at + measured[i]!.extent.right + RIGHT_MARGIN > width) break
      x = at
      to = i + 1
      if (measured[i]!.bar !== measured[i - 1]!.bar) lastBar = i
    }
    // Back up to the bar line, unless that would empty the system or we have
    // reached the end of the piece and there is nothing to back up for.
    if (!forced && to < measured.length && lastBar > from) to = lastBar

    systems.push({ from, to, stretch: stretchFor(measured, from, to, fifths, width) })
    from = to
  }

  return systems
}

/**
 * How far to open a system's gaps so it fills its line.
 *
 * Never on the shortest lines: a final system holding two chords, stretched to
 * the full width, puts half a bar of white space between them and looks like a
 * fault rather than an ending. Those are left short, which is what an engraver
 * does with a last line.
 */
function stretchFor(
  measured: readonly Measured[],
  from: number,
  to: number,
  fifths: number,
  width: number,
): number {
  if (to >= measured.length) return 1
  const start = headerEnd(fifths, from === 0) + leadIn(measured[from])
  let gaps = 0
  for (let i = from + 1; i < to; i++) gaps += measured[i]!.gap
  if (gaps <= 0) return 1
  const last = measured[to - 1]!.extent.right
  const natural = start + gaps + last
  if (natural < width * MIN_FILL) return 1
  const target = width - RIGHT_MARGIN
  return Math.min(MAX_STRETCH, Math.max(1, (target - start - last) / gaps))
}
