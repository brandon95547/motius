import {
  DEFAULT_VELOCITY,
  inferHand,
  type Accidental,
  type DynamicLine,
  type Hand,
  type Spelling,
  type WrittenNote,
} from '@motius/shared'
import {
  flag,
  GRACE_Q,
  inner,
  LETTER_INDEX,
  num,
  STEP_SEMITONES,
  TYPE_VALUES,
} from './musicxml-scan'
import type { MeasureCursor, Parsed, PartReading, ScoreReading } from './musicxml-reading'

/**
 * One `<note>` of a bar: a rest written down for the page, a note tied on
 * from one before, or a note struck — its pitch, its hand, its written value
 * and its fingering.
 */
export function readNote(
  score: ScoreReading,
  part: PartReading,
  at: MeasureCursor,
  content: string,
) {
  const { divisions, measureStartQ, role, partHand, manyStaves, base } = part
  const duration = num(content, 'duration') ?? 0
  const isChord = flag(content, 'chord')
  const isGrace = flag(content, 'grace')
  const start = isChord ? at.previousStart : at.cursor
  const voice = inner(content, 'voice')?.trim() ?? '1'

  if (flag(content, 'rest')) {
    // Written down for the page: a rest is not played, but it is what
    // shows a hand waiting. Only the piano's, and only the ones printed.
    if (role === 'keyboard' && !isGrace && !/<note\b[^>]*print-object="no"/.test(content)) {
      const restType = inner(content, 'type')?.trim()
      const onStaff = num(content, 'staff')
      const barQ = (part.beats * 4) / part.beatType
      score.rests.push({
        startQ: measureStartQ + start / divisions,
        startMs: 0,
        durationQ: duration / divisions,
        hand: part.handOn(onStaff) ?? 'right',
        ...(manyStaves ? { staff: base + (onStaff ?? 1) } : {}),
        voice: part.voiceOn(voice, onStaff),
        ...(restType
          ? {
              written: {
                value: TYPE_VALUES[restType] ?? 'quarter',
                dots: (content.match(/<dot\s*\/>/g) ?? []).length,
              },
            }
          : {}),
        // Marked as the bar's, or given no length of its own and the
        // bar's whole duration, which is how most programs write one.
        ...(/<rest\b[^>]*measure="yes"/.test(content) ||
        (!restType && duration / divisions >= barQ - 1e-6)
          ? { wholeBar: true }
          : {}),
      })
    }
    at.cursor = start + duration
    at.longest = Math.max(at.longest, at.cursor)
    return
  }

  // Notation writes drums as <unpitched>: a line on the staff, not a pitch.
  const unpitched = inner(content, 'unpitched')
  const pitch = inner(content, 'pitch') ?? unpitched
  if (!pitch) {
    if (!isChord) at.cursor = start + duration
    return
  }

  const step = (inner(pitch, 'step') ?? inner(pitch, 'display-step'))?.trim() ?? 'C'
  const alter = Math.max(-2, Math.min(2, Math.round(num(pitch, 'alter') ?? 0))) as Accidental
  const octave = num(pitch, 'octave') ?? num(pitch, 'display-octave') ?? 4
  const midi = (octave + 1) * 12 + (STEP_SEMITONES[step] ?? 0) + alter
  const spelling: Spelling = { letter: LETTER_INDEX[step] ?? 0, accidental: alter }

  const staff = num(content, 'staff')
  if (role === 'keyboard' && (staff !== undefined || partHand)) score.leadNamesStaves = true
  /*
   * Whose note it is.
   *
   * Its voice's hand: a line of music stays one hand's, and a line that
   * goes onto the other staff is not handed over for being there. But
   * that is a reading. A staff is not proof of a hand and neither is a
   * voice, and where the two disagree the score has not said — so the
   * note keeps its line's hand and is marked as suggested, never moved
   * to the other hand on a guess. So is a note on an inner staff of a
   * piano written on three or four, where no convention says whose it is.
   */
  const home = staff === undefined ? undefined : (part.homes?.get(voice) ?? staff)
  const hand: Hand = part.handOn(home) ?? inferHand(midi)
  const away = home !== staff && part.handOn(staff) !== hand
  const between =
    manyStaves > 0 && !partHand && staff !== undefined && staff > 1 && staff < manyStaves

  const startQ = isGrace
    ? Math.max(0, measureStartQ + start / divisions - GRACE_Q)
    : measureStartQ + start / divisions
  const durationQ = isGrace ? GRACE_Q : Math.max(0.0625, duration / divisions)
  const written = writtenOf(score, part, content, voice)

  const tieKey = `${staff ?? 0}:${voice}:${midi}`
  if (/<tie[^>]*type="stop"/.test(content)) {
    // The note this one is tied from. In its own voice, as a rule — but
    // a suspension is often held in one voice and written again in
    // another, and a tie joins a pitch to itself whatever line of the
    // counterpoint each end is in. So failing its own voice, the held
    // note of this pitch that ends where this one begins.
    const { tied } = part
    const heldKey = tied.has(tieKey)
      ? tieKey
      : [...tied].find(
          ([, open]) =>
            open.note === midi && Math.abs(open.startQ + open.durationQ - startQ) < 1e-3,
        )?.[0]
    const held = heldKey === undefined ? undefined : tied.get(heldKey)
    if (held && heldKey !== undefined) {
      // Replace the held note with a longer one rather than adding a second.
      const index = score.notes.lastIndexOf(held)
      if (index >= 0) {
        const extended: Parsed = {
          ...held,
          durationQ: startQ + durationQ - held.startQ,
          // One sound, written twice: the second notehead is kept for
          // the page, with the tie that joins it to the first.
          tied: [...(held.tied ?? []), { startQ, startMs: 0, ...(written ? { written } : {}) }],
        }
        score.notes[index] = extended
        tied.delete(heldKey)
        if (/<tie[^>]*type="start"/.test(content)) tied.set(tieKey, extended)
      }
      if (!isChord && !isGrace) {
        at.previousStart = start
        at.cursor = start + duration
        at.longest = Math.max(at.longest, at.cursor)
      }
      return
    }
  }

  // <notations><technical><fingering> — the one place a file can tell us
  // which finger to use. Worth reading precisely because it cannot be
  // recovered from anywhere else.
  const fingerText = inner(content, 'fingering')?.trim()
  const finger = fingerText && /^[1-5]$/.test(fingerText) ? Number(fingerText) : undefined

  const note: Parsed = {
    note: midi,
    // Until the whole score has been read: see where `dynamics` is applied.
    velocity: DEFAULT_VELOCITY,
    startMs: 0,
    durationMs: 0,
    startQ,
    durationQ,
    hand,
    // The staff it is written on, where that is not simply its hand's.
    ...(manyStaves ? { staff: base + (staff ?? 1) } : away && staff !== undefined ? { staff } : {}),
    ...(away || between ? { handSuggested: true } : {}),
    role: unpitched ? 'percussion' : role,
    spelling,
    voice: part.voiceOn(voice, staff),
    ...(written ? { written } : {}),
    ...(isGrace ? { grace: true } : {}),
    ...(finger ? { finger } : {}),
  }
  score.notes.push(note)
  if (staff !== undefined) part.writtenOn.set(score.notes.length - 1, staff)
  const line: DynamicLine | undefined = partHand ? part.id : staff
  part.loudness.notes.push({
    index: score.notes.length - 1,
    ...(line === undefined ? {} : { line }),
  })
  if (/<tie[^>]*type="start"/.test(content)) part.tied.set(tieKey, note)

  if (!isChord && !isGrace) {
    at.previousStart = start
    at.cursor = start + duration
  }
  if (!isGrace) at.longest = Math.max(at.longest, start + duration)
}

/**
 * The written value, tuplet included. A tuplet's notes carry their
 * ratio individually; the bracket over them is one thing, so every
 * note between a `start` and a `stop` shares an id.
 */
function writtenOf(
  score: ScoreReading,
  part: PartReading,
  content: string,
  voice: string,
): WrittenNote | undefined {
  const { tuplets } = part
  const typeName = inner(content, 'type')?.trim()
  const actual = num(content, 'actual-notes')
  const normal = num(content, 'normal-notes')
  const tupletKey = `${voice}`
  if (/<tuplet\b[^>]*type="start"/.test(content) || (actual && normal && !tuplets.has(tupletKey))) {
    if (actual && normal) tuplets.set(tupletKey, { id: ++score.tupletCounter, actual, normal })
  }
  const tuplet = actual && normal ? tuplets.get(tupletKey) : undefined
  const written: WrittenNote | undefined = typeName
    ? {
        value: TYPE_VALUES[typeName] ?? 'quarter',
        dots: (content.match(/<dot\s*\/>/g) ?? []).length,
        ...(tuplet ? { tuplet } : {}),
      }
    : undefined
  if (/<tuplet\b[^>]*type="stop"/.test(content) || !(actual && normal)) tuplets.delete(tupletKey)
  return written
}
