import type { Hand, Song, SongMeasure, SongStep, Staff, WrittenValue } from '@motius/shared'
import { staffOf } from './chord-layout'
import { staffOfLine, type BeamLine, type DrawnNote, type Extent, type VoicePart } from './notation'

/**
 * What a measured score is made of, and the small questions about it that
 * measuring, laying out and beaming all ask: which voice is on a line, which
 * pair of staves a staff is in, and which clef each staff is read in.
 */

/** The repeat signs and ending bracket of a bar, by the number the page prints for it. */
export type BarMarks = ReadonlyMap<number, Pick<SongMeasure, 'repeat' | 'ending'>>

/** The marked bars of a score: the few that carry a repeat sign or stand under a bracket. */
export function barMarksOf(measures: readonly SongMeasure[] | undefined): BarMarks {
  const marks = new Map<number, Pick<SongMeasure, 'repeat' | 'ending'>>()
  for (const measure of measures ?? [])
    if (measure.repeat || measure.ending) marks.set(measure.number, measure)
  return marks
}

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
  /**
   * The beam it is under where that beam crosses from one staff to the other:
   * the same number on the chords of both staves that it joins.
   */
  readonly cross?: Partial<Record<BeamLine, number>>
  /** The tuplet its notes on each staff belong to, where the score said. */
  readonly tuplet?: Partial<Record<Staff, { readonly id: number; readonly actual: number }>>
}

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

/**
 * What measuring reads from a song: its pace, its key and where its bars fall.
 *
 * Four fields rather than the whole song, so music that is not a song can be
 * written out the same way — a scale is a run of steps in a key, and nothing
 * about engraving it needs a title or a track list. A song is one of these.
 */
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
export const staffNumberOf = (
  on: { readonly staff?: number; readonly hand: Hand },
  staves: number,
) => on.staff ?? (on.hand === 'left' ? staves : 1)

/** The staff of a pair that one of the score's staves is drawn on, or null where it belongs to another pair. */
export const rowIn = (layer: ScoreLayer, staff: number | undefined): Staff | null =>
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
