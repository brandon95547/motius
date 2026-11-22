import type { Accidental, Hand, Spelling, Staff, WrittenValue } from '@motius/shared'

/**
 * The shapes the staff's modules hand each other.
 *
 * Measuring a score, laying out a chord and drawing its beams all speak of
 * the same notes, voices, beams and stems. Kept here, where none of them has
 * to import another to name what they pass around.
 */

export interface DrawnNote {
  readonly note: number
  /**
   * The clef its staff is being read in, where that is not the staff's own:
   * a right hand in the bass clef, a left hand in the treble. It moves where
   * on the staff the note is written and changes nothing else about it.
   */
  readonly clef?: Staff
  /**
   * The staff of its pair it is written on, where the score says: on a piano
   * written on three staves or four, a note is on the staff the score put it
   * on, whichever hand plays it.
   */
  readonly row?: Staff
  /**
   * The voice it is in, where that voice is written on both staves in this
   * bar: a line that crosses from one staff to the other, to be beamed as the
   * one line it is.
   */
  readonly voice?: number
  readonly finger?: number
  /** Whether this pitch is under a finger right now. */
  readonly sounding?: boolean
  /** Part of a chord too wide to close on at once, so it is spread. */
  readonly rolled?: boolean
  /**
   * The letter and accidental it is written with.
   *
   * A MIDI number knows its pitch and not its name, and a note that arrives
   * without one is spelled with sharps — which is the wrong note to a reader
   * in every flat key. Whoever knows the score passes the spelling in.
   */
  readonly spelling?: Spelling | null
  /**
   * Which hand plays it, where anything knows.
   *
   * It decides the staff. Piano music writes the left hand in the bass
   * wherever the notes fall — a left-hand chord above middle C carries ledger
   * lines rather than moving into the treble.
   */
  readonly hand?: Hand | null
  /**
   * The sign to print in front of it, or `null` for none.
   *
   * Decided by whoever knows the bar, because an accidental holds for the rest
   * of one and no chord can see the chord before it. Left `undefined` by the
   * live staff, which draws a single moment and asks the key instead.
   */
  readonly accidental?: Accidental | null
  /**
   * A tied note's second notehead: written here, and not struck here.
   *
   * It is drawn as a note, because that is what the page shows, and joined to
   * the head before it by a tie. It is never the note to play: the key is
   * already down.
   */
  readonly held?: boolean
}

/** A tie arriving at a notehead: which note, and where the head it comes from stands. */
export interface TieArc {
  readonly note: number
  /** The step the tie comes from, or null where that is on another line. */
  readonly fromX: number | null
}

/**
 * One voice's notes at a moment, on one staff: a chord with a stem of its own.
 *
 * A staff can carry two lines at once, a melody over held notes, and each is
 * written as itself: its own length, and its stem pointing away from the other
 * so the eye can follow either. One stem for everything on the staff, which is
 * all this drew before, has to give the whole chord one length — and a crotchet
 * of melody over a held minim came out as a minim.
 */
export interface VoicePart {
  readonly staff: Staff
  readonly notes: readonly DrawnNote[]
  readonly value: WrittenValue
  /**
   * The way its stem must point: up for the upper voice, down for the lower.
   * Absent where the staff has one voice and the notes decide.
   */
  readonly stem?: 'up' | 'down'
  /** How far it stands to the right of the step, to clear the other voice's heads. */
  readonly dx: number
}

/** The room a chord takes, and how far each staff's share of it reaches towards the other staff. */
export interface Extent {
  readonly left: number
  readonly right: number
  readonly top: number
  readonly bottom: number
  /**
   * The treble staff's lowest ink and the bass staff's highest, on a plain
   * system: noteheads, ledger lines, stems, signs and fingering alike. Where
   * the first is below the second, the two hands are drawn through each other,
   * and the system needs opening (`spreadOf`).
   */
  readonly inner: { readonly treble?: number; readonly bass?: number }
  /**
   * The other way: the treble staff's highest ink and the bass staff's lowest.
   * What a staff stacked above or below this pair has to keep clear of.
   */
  readonly outer: { readonly treble?: number; readonly bass?: number }
}

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

/** How one chord's stem is drawn when a beam decides it. */
export interface StemOverride {
  readonly up: boolean
  /** Where the stem ends: on the beam's outer edge. */
  readonly end: number
}

/** The stems of one step that beams have decided, by staff. */
export type StepStems = Partial<Record<BeamLine, StemOverride>>
