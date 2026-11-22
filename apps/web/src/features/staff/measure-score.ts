import {
  AccidentalMemory,
  barIndexAt,
  staffFor,
  type SongNote,
  type SongStep,
  type Staff,
} from '@motius/shared'
import { CLEF_CHANGE_WIDTH, STEP } from './staff-frame'
import { chordExtent, partsExtent } from './chord-layout'
import {
  barMarksOf,
  changedClefs,
  clefsAt,
  rowIn,
  staffNumberOf,
  type Measured,
  type ScoreLayer,
  type ScoreSource,
} from './score-model'
import {
  columnsOf,
  restsOf,
  tiesOf,
  voicesOf,
  type BarVoices,
  type Measuring,
} from './measure-marks'
import {
  AIR,
  drawnNotesOf,
  restsWith,
  tupletsOf,
  voicePartsOf,
  writtenValueOn,
} from './measure-chord'
import { beamed } from './beam-groups'

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
/** The extra two chords keep when a bar line stands between them. */
const BAR_ROOM = STEP * 2
/** The room a bar with nothing in it but a rest is given. */
const EMPTY_BAR = STEP * 9
/** And the extra again when that line is a repeat sign, which has dots and a thick line to fit. */
const REPEAT_ROOM = STEP * 3

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
  // Every place something is written, of the whole score, so that the pairs
  // of a score on several staves count the same places.
  const columns = columnsOf(every)
  const all = columns ? columns.map((column) => column.step) : every
  /** Which of the song's chords the place at a position in the list is. */
  const indexAt = (position: number) => (columns ? columns[position]!.index : position)
  const m = measuringOf(song, all, layer)
  const { steps, fifths } = m
  const marks = barMarksOf(m.measures)

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

  const { heldAt, tiedOut } = tiesOf(steps)
  const voicesIn = voicesOf(m, heldAt)
  const rested = restsOf(m)
  let lastBar = Number.NaN

  const measured = steps.map((step, index): Measured => {
    const bar = m.barOf(step)
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

    const value = {
      treble: writtenValueOn(m, writtenHere, index, 'treble'),
      bass: writtenValueOn(m, writtenHere, index, 'bass'),
    }

    // The clef each staff is in at this moment, and whether either has just
    // changed. The clef the piece opens in is not a change: the head of the
    // line says it.
    const clefs = clefsAt(song?.clefs, step.startMs, layer)
    const changed = (['treble', 'bass'] as const).filter((staff) => clefs[staff] !== clefWas[staff])
    clefWas = clefs
    const sorted = [...writtenHere].sort((a, b) => a.note - b.note)
    const notes = drawnNotesOf(m, sorted, {
      heldNotes,
      clefs,
      crosses: (voice) => crosses(voicesIn, bar, voice),
      hints,
      memory,
    })

    const parts = voicePartsOf(
      sorted,
      notes,
      value,
      (staff) => voicesIn.get(`${bar}:${staff}`) ?? [],
    )
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
    const { rests, lead, extent } = restsWith(index, inked, rested)

    /** The bars since the last chord in which nothing at all is struck, and who rests in them. */
    const emptyBars: { bar: number; staves: Staff[] }[] = []
    if (index > 0 && bar - lastBar > 1 && bar - lastBar <= 64)
      for (let empty = lastBar + 1; empty < bar; empty++)
        if (rested.barRests.has(empty))
          emptyBars.push({ bar: empty, staves: rested.barRests.get(empty)! })
    const firstOfBar = bar !== lastBar
    lastBar = bar

    let gap = 0
    if (index > 0) {
      const elapsed = step.startMs - steps[index - 1]!.startMs
      const rhythmic = Math.min(
        MAX_GAP,
        (elapsed / m.measureMs) * (song?.barWidth ?? MEASURE_WIDTH),
      )
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

    const tuplet = tupletsOf(m, step)

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
      ...(firstOfBar && rested.barRests.has(bar) ? { barRest: rested.barRests.get(bar)! } : {}),
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

  return song?.beams ? beamed(measured, m.beat, m.measureMs, m.measures) : measured
}

/** What measuring needs to know about a score and the pair of staves being measured. */
function measuringOf(
  song: ScoreSource | null,
  all: readonly SongStep[],
  layer: ScoreLayer | undefined,
): Measuring {
  const staves = song?.staves ?? 2
  /**
   * The staff of this pair a note is written on. On a piano's usual two that
   * is its hand's, unless the score wrote it on the other: a hand that goes
   * onto the other staff is drawn there, and is still that hand.
   */
  const rowOf = (note: SongNote): Staff =>
    layer
      ? (rowIn(layer, staffNumberOf(note, staves)) ?? 'treble')
      : note.staff === 1
        ? 'treble'
        : note.staff === 2
          ? 'bass'
          : staffFor(note.note, note.hand)
  /**
   * The staff a note keeps busy, for the rests: its hand's own. A rest says a
   * hand is waiting, and a hand playing on the other staff is not.
   */
  const busies = (note: SongNote): Staff => (layer ? rowOf(note) : staffFor(note.note, note.hand))
  const steps = layer
    ? all.map((step) => ({
        ...step,
        notes: step.notes.filter((note) => rowIn(layer, staffNumberOf(note, staves)) !== null),
      }))
    : all
  const measures = song?.measures
  const measureMs = song?.measureMs ?? 2000

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

  return {
    song,
    steps,
    ...(layer ? { layer } : {}),
    staves,
    ...(measures ? { measures } : {}),
    measureMs,
    beat: song ? 60000 / song.bpm : 500,
    fifths: song?.key?.fifths ?? 0,
    rowOf,
    busies,
    barOf,
  }
}

/** Whether a voice is written on both staves in a bar: a line that crosses between them. */
const crosses = (voicesIn: BarVoices, bar: number, voice: number) =>
  voicesIn.get(`${bar}:treble`)?.includes(voice) === true &&
  voicesIn.get(`${bar}:bass`)?.includes(voice) === true
