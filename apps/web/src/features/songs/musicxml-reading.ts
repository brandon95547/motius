import type { DynamicEvent, DynamicLine, Hand, PartRole, SongNote, SongRest } from '@motius/shared'
import { openingClef, voiceHomes, type Piano } from './musicxml-parts'

/**
 * What reading a MusicXML score keeps track of: what the whole score has said
 * so far, and what the part being read has.
 */

export interface Parsed extends SongNote {
  readonly startQ: number
  readonly durationQ: number
}

/** The repeat signs and ending brackets on one bar, from whichever part wrote them. */
export interface BarSigns {
  start?: boolean
  times?: number
  /** An ending bracket opens on this bar, for these passes… */
  opens?: number[]
  /** …and one closes on it. */
  closes?: boolean
  ending?: readonly number[]
}

/** What one instrument's score says about loudness, and the notes it says it to. */
export interface Loudness {
  readonly events: DynamicEvent[]
  readonly notes: { index: number; line?: DynamicLine }[]
}

/** What the whole score has said, gathered part by part. */
export interface ScoreReading {
  fifths: number | null
  mode: 'major' | 'minor' | null
  /** Tempo marks, in crotchets from the start, from whichever part carried them. */
  readonly tempos: { atQ: number; bpm: number }[]
  /** Each bar's length and metre, longest of any part that has it. */
  readonly bars: { durationQ: number; beats: number; beatType: number }[]
  /** The rests the piano's staves write, for the page. */
  readonly rests: SongRest[]
  /** The repeat signs and ending brackets on each bar, from whichever part wrote them. */
  readonly signs: BarSigns[]
  readonly notes: Parsed[]
  /*
   * What each instrument's score says about loudness, and the notes it says
   * it to. Gathered as the parts are read and applied once they all have been:
   * a marking governs by when it falls in the music, not where it falls in the
   * file, and a piano written as a part a hand is one instrument with one set
   * of markings.
   */
  readonly dynamics: Map<string, Loudness>
  readonly pedalsQ: { fromQ: number; toQ: number }[]
  readonly chordsQ: { startQ: number; text: string }[]
  /** The clefs the piano's staves are put in, in the order the file says so. */
  readonly clefsQ: { hand: Hand; staff?: number; startQ: number; clef: 'treble' | 'bass' }[]
  /** How many staves the piano is written on, where that is more than two. */
  pianoStaves: number | undefined
  leadNamesStaves: boolean
  tupletCounter: number
}

export function scoreReading(): ScoreReading {
  return {
    fifths: null,
    mode: null,
    tempos: [],
    bars: [],
    rests: [],
    signs: [],
    notes: [],
    dynamics: new Map(),
    pedalsQ: [],
    chordsQ: [],
    clefsQ: [],
    pianoStaves: undefined,
    leadNamesStaves: false,
    tupletCounter: 0,
  }
}

/** What the part being read has said, and how its staves and voices are read. */
export interface PartReading {
  readonly id: string
  readonly role: PartRole
  /** The hand this whole part is, when the piano is written as a part a hand. */
  readonly partHand: Hand | undefined
  /** How many staves the piano is on, where that is more than two; else none. */
  readonly manyStaves: number
  /** Where this part's staves begin among the piano's, where the piano is a part to a hand. */
  readonly base: number
  /** The staff each voice is at home on, where the part's voices say. */
  readonly homes: Map<string, number> | null
  /** The hand a staff of this part belongs to. */
  readonly handOn: (staffNumber: number | undefined) => Hand | undefined
  /** The number a voice is kept under. */
  readonly voiceOn: (voice: string, staff: number | undefined) => number
  /** Where this part's notes begin, and the staff each of them is written on. */
  readonly firstNote: number
  readonly writtenOn: Map<number, number>
  /** The hands the score marks over the music: where, and which hand. */
  readonly handMarks: { atQ: number; hand: Hand }[]
  readonly loudness: Loudness
  /** Hairpins that have opened and not yet closed, by the number the file gives them. */
  readonly wedges: Map<string, { fromQ: number; direction: 'louder' | 'softer' }>
  /** Open tied notes, so the continuation extends rather than restrikes. */
  readonly tied: Map<string, Parsed>
  /** The tuplet each voice is inside, if any. */
  readonly tuplets: Map<string, { id: number; actual: number; normal: number }>
  divisions: number
  beats: number
  beatType: number
  measureStartQ: number
  pedalFromQ: number | null
}

/** Where a bar is being read: how far in, where the last note began, and its longest voice so far. */
export interface MeasureCursor {
  cursor: number
  previousStart: number
  longest: number
}

/** How a part is to be read: whose it is, and how its staves and voices are numbered. */
export function partReading(
  score: ScoreReading,
  part: { readonly id: string; readonly body: string },
  piano: Piano | null,
  stavesOf: ReadonlyMap<string, number>,
): PartReading {
  const role: PartRole = piano?.parts.has(part.id) ? 'keyboard' : 'accompaniment'
  const partHand = piano?.hands.get(part.id)
  /*
   * A piano on three staves or four.
   *
   * Music too thick for two staves is given more: a staff for what a hand
   * holds and another for what it moves. Each note is then kept on the staff
   * the score put it on, and the hand is read from which staff that is — the
   * upper half the right hand's, the lower the left's. With an odd number
   * the middle staff could be either, and goes by the clef it opens in.
   */
  const staffCount = role === 'keyboard' ? (stavesOf.get(part.id) ?? 1) : 1
  const base = piano?.staffBase?.get(part.id) ?? 0
  /** How many staves the piano is on, where that is more than two: this part's, or both hands' parts together. */
  const whole = partHand ? (piano?.staves ?? 1) : staffCount
  const manyStaves = whole > 2 ? whole : 0
  if (manyStaves) score.pianoStaves = manyStaves
  const rightStaves =
    manyStaves % 2 === 0
      ? manyStaves / 2
      : openingClef(part.body, (manyStaves + 1) / 2) === 'F'
        ? (manyStaves - 1) / 2
        : (manyStaves + 1) / 2
  const handOn = (staffNumber: number | undefined): Hand | undefined =>
    partHand ??
    (manyStaves && staffNumber !== undefined
      ? staffNumber <= rightStaves
        ? 'right'
        : 'left'
      : staffNumber === 2
        ? 'left'
        : staffNumber === 1
          ? 'right'
          : undefined)
  const homes = staffCount >= 2 ? voiceHomes(part.body, staffCount) : null
  /*
   * The number a voice is kept under. The file's own, where its voices are
   * lines of music: a line that goes from one staff to the other is then the
   * same voice on both, and the page can beam it as one. Where the numbers
   * name nothing — the same one for a line on each staff — each staff's are
   * set apart, so that two lines are never taken for one that crosses.
   */
  const voiceOn = (voice: string, staff: number | undefined): number =>
    (Number(voice) || 1) +
    // A hand's part has voices of its own, whatever the other hand's are called.
    base * 4 +
    (staffCount >= 2 && !homes && staff ? (staff - 1) * 100 : 0)
  const loudnessOf = partHand ? 'piano' : part.id
  const loudness = score.dynamics.get(loudnessOf) ?? { events: [], notes: [] }
  score.dynamics.set(loudnessOf, loudness)

  return {
    id: part.id,
    role,
    partHand,
    manyStaves,
    base,
    homes,
    handOn,
    voiceOn,
    firstNote: score.notes.length,
    writtenOn: new Map(),
    handMarks: [],
    loudness,
    wedges: new Map(),
    tied: new Map(),
    tuplets: new Map(),
    divisions: 1,
    beats: 4,
    beatType: 4,
    measureStartQ: 0,
    pedalFromQ: null,
  }
}

/**
 * A note given to a hand. It is still drawn where the score wrote it,
 * which is said where that is not the hand's own staff; and whether the
 * hand is the score's or a reading of it is said too.
 */
function given(
  reading: PartReading,
  note: Parsed,
  hand: Hand,
  written: number | undefined,
  suggested: boolean,
): Parsed {
  const { staff: placed, handSuggested: _was, ...plain } = note
  const own = hand === 'right' ? 1 : 2
  return {
    ...plain,
    hand,
    ...(reading.manyStaves
      ? { staff: placed }
      : written !== undefined && written !== own
        ? { staff: written }
        : {}),
    ...(suggested ? { handSuggested: true } : {}),
  }
}

/*
 * The hands a score marks outright.
 *
 * "m.d." over a run, "L.H." under a note: the one place a page says which
 * hand, and it is said exactly where the staves would mislead. So it is
 * taken at its word — for the notes it stands on. Which those are is plain
 * where one line of music begins at the mark, and then that note is the
 * marked hand's, stated, with nothing suggested about it.
 *
 * How far the mark carries is not written down. It governs the phrase it
 * opens, which is read here as that line running on unbroken on the same
 * staff until it rests or another mark takes over; those notes follow the
 * mark and are said to be a reading.
 *
 * And where more than one line begins at a mark it is given to none of
 * them. Not even to the one on the staff the mark is written against: a
 * mark is put where there is room for it, as often over the staff that is
 * resting as over the notes it means, and in the scores this was measured
 * on it agreed with its own staff and spoke of the other more often than
 * not. So nothing is moved, and the notes it disagrees with are said to
 * be open.
 */
export function applyHandMarks(notes: Parsed[], reading: PartReading) {
  const { handMarks, writtenOn } = reading
  if (handMarks.length === 0) return
  handMarks.sort((a, b) => a.atQ - b.atQ)
  const mine: number[] = []
  for (let at = reading.firstNote; at < notes.length; at++)
    if (notes[at]!.role === 'keyboard' && !notes[at]!.grace) mine.push(at)
  for (const mark of handMarks) {
    const until = handMarks.find((next) => next.atQ > mark.atQ + 1e-6)?.atQ ?? Infinity
    const marked = mine.filter((at) => Math.abs(notes[at]!.startQ - mark.atQ) < 1e-6)
    if (marked.length === 0) continue
    if (new Set(marked.map((at) => notes[at]!.voice)).size !== 1) {
      for (const at of marked)
        if (notes[at]!.hand !== mark.hand)
          notes[at] = given(reading, notes[at]!, notes[at]!.hand, writtenOn.get(at), true)
      continue
    }
    for (const at of marked)
      notes[at] = given(reading, notes[at]!, mark.hand, writtenOn.get(at), false)

    const voice = notes[marked[0]!]!.voice
    const staff = writtenOn.get(marked[0]!)
    let end = Math.max(...marked.map((at) => notes[at]!.startQ + notes[at]!.durationQ))
    const later = mine
      .filter((at) => notes[at]!.voice === voice && notes[at]!.startQ > mark.atQ + 1e-6)
      .sort((a, b) => notes[a]!.startQ - notes[b]!.startQ)
    for (const at of later) {
      const note = notes[at]!
      if (note.startQ >= until - 1e-6 || note.startQ > end + 1e-3) break
      if (writtenOn.get(at) !== staff) break
      end = Math.max(end, note.startQ + note.durationQ)
      if (note.hand !== mark.hand) notes[at] = given(reading, note, mark.hand, staff, true)
    }
  }
}
