import {
  accidentalToShow,
  ledgerSteps,
  staffFor,
  stemDirection,
  staffPlacement,
  type Accidental,
  type Staff,
  type StaffPlacement,
  type WrittenValue,
} from '@motius/shared'
import { STEP, yOn } from './staff-frame'
import type { DrawnNote, Extent, StemOverride, VoicePart } from './notation'

/**
 * Where a chord's marks go, worked out before anything is drawn.
 *
 * The page asks how much room a chord needs before it decides where to put the
 * next one, and the drawing (`StaffNotes`) asks where each mark goes. Both get
 * the answer from here, so the room reserved is the room the ink takes.
 */

/** A stem is an octave long — seven letter-steps — unless the note is far out. */
export const STEM_STEPS = 7
export const HEAD_RX = STEP * 1.35
export const HEAD_RY = STEP * 0.98
/** Half a ledger line, which reaches wider than the head it carries. */
const LEDGER_RX = STEP * 2.2
/** How far a ledger line still reaches past its head where a sign sits beside it. */
const LEDGER_STUB = STEP * 0.2
/** The room the arpeggio sign takes, outside everything else on the left. */
const ARPEGGIO_WIDTH = STEP * 2.2
/** The air between the arpeggio sign and whatever of the chord is leftmost. */
const ARPEGGIO_GAP = STEP * 0.4

/*
 * The numbers below are the glyphs, measured.
 *
 * Guessing at them is what put fingerings on top of each other and accidental
 * columns eight staff spaces out from the notes they belonged to, so they are
 * measurements now — and measurements of the ink, not of the box the glyph is
 * set in. The box is what `getBBox` reports and it is far bigger than the
 * sign: a sharp's is 10.5 by 20 around ink that is 6.8 by 15.9. Keeping the
 * box clear of the chord is what left a sharp standing a notehead's width away
 * from the note it belonged to.
 */

/**
 * An accidental's ink, from its anchor: the right edge of the glyph, on the
 * baseline.
 *
 * Which glyph is drawn depends on the machine — `--font-music` is a stack of
 * faces that may or may not be installed — so this is the most any of them
 * reaches, measured with `measureText` at the size the stylesheet sets. Every
 * accidental is given that room. A flat is shorter and a natural narrower, so
 * it over-reserves for them, which costs a little white space and can never
 * let two signs touch.
 *
 * Anchored on the right because that is the edge that has to sit against the
 * note. The faces disagree by three units about how wide a sharp is and by
 * rather less about how much air it carries on its right.
 */
const SIGN_INK = { width: 11, above: 16.5, below: 2.5 }
/** The fingering numeral's ink, from its own anchor point. It is centred. */
const FINGER_INK = { half: 2.2, above: 9.8, below: 2.5 }

/** The pitch of a column of accidentals: the sign, plus air. */
const ACCIDENTAL_WIDTH = STEP * 2.4
/**
 * The air between a sign's glyph and what it sits against.
 *
 * Small, because the glyph brings air of its own: two units of it on the
 * right, in the face a Mac draws these with.
 */
const ACCIDENTAL_GAP = STEP * 0.1
/**
 * How far apart two accidentals must be to share a column.
 *
 * A seventh, which is the engraver's rule rather than a measurement: closer
 * than that and two signs read as one mark even when their ink does not touch.
 */
const ACCIDENTAL_CLEAR = 6
/** The least vertical room between two fingering numerals. */
const FINGER_CLEAR = STEP * 2.8
/** How far the fingering column sits from the chord. */
const MARGIN = STEP * 1.5
/**
 * Half the width of a drawn line.
 *
 * Stems and ledger lines are geometry to place and ink to look at, and the ink
 * is wider than the geometry. Small enough not to matter to the spacing, big
 * enough that what the extent promises is what the page actually gets.
 */
const STROKE = 1

/** How far the lower voice steps aside when its heads would land on the upper voice's. */
export const VOICE_SHIFT = STEP * 1.35 * 2 + STEP * 0.5

/** Which staff a note is written on: the one the score names, or else its hand's, where a hand is known. */
export const staffOf = (note: DrawnNote): Staff => note.row ?? staffFor(note.note, note.hand)

/**
 * How far up its staff a note moves for the clef it is read in, in steps.
 *
 * The five lines of a staff are the same five lines whatever the clef; the
 * clef says which notes they are. In the treble clef the bottom line is the E
 * above middle C, in the bass clef the G an octave and a sixth below it —
 * twelve steps. So a note read in the bass clef on the upper staff is written
 * twelve steps higher up it than the treble clef would put it, and one read in
 * the treble clef on the lower staff twelve steps further down.
 */
export const clefShift = (staff: Staff, clef: Staff | undefined): number =>
  !clef || clef === staff ? 0 : staff === 'treble' ? 12 : -12

/**
 * Where a note is written on its staff.
 *
 * `steps` is where it goes among the lines, in the clef its staff is in. Under
 * a changed clef that is not how far the note is from middle C — its letter,
 * octave and accidental still say what it is.
 */
export const placementOf = (note: DrawnNote): StaffPlacement => {
  const staff = staffOf(note)
  const placement = staffPlacement(note.note, note.spelling, staff)
  const shift = clefShift(staff, note.clef)
  return shift ? { ...placement, steps: placement.steps + shift } : placement
}

/** Where a chord's stem stands: on the right of the heads going up, the left going down. */
export const stemXFor = (x: number, up: boolean) => (up ? x + HEAD_RX * 0.95 : x - HEAD_RX * 0.95)

/**
 * Where every mark of one staff's chord goes.
 *
 * Worked out as a whole rather than note by note, because most of engraving is
 * about what two marks do to each other. A note cannot decide alone where its
 * accidental goes, or its fingering, or which side of the stem its head sits
 * on — those answers depend on its neighbours, and the chord is the smallest
 * thing that knows them all.
 *
 * Separate from the drawing so the page can ask how much room a chord needs
 * before deciding where to put the next one.
 */
export function layout(
  x: number,
  notes: readonly DrawnNote[],
  value: WrittenValue,
  fifths: number,
  /** The stem a beam has decided: its direction and where it ends. */
  stem?: StemOverride,
  /** The way the stem must point, where the voice decides and no beam has. */
  direction?: 'up' | 'down',
) {
  const placed = notes
    .map((note) => ({ ...note, placement: placementOf(note) }))
    .sort((a, b) => a.placement.steps - b.placement.steps)
  if (placed.length === 0) return null

  const staff = placed[0]!.placement.staff
  // Under a beam the group decides the direction, not this chord.
  const up = stem
    ? stem.up
    : direction
      ? direction === 'up'
      : stemDirection(placed.map((entry) => entry.placement)) === 'up'
  const sounding = placed.some((entry) => entry.sounding)

  /*
   * Which heads sit across the stem rather than beside it.
   *
   * Two notes a second apart cannot share a side; their heads would land on
   * top of each other. One crosses the stem — and which one is not arbitrary:
   * with the stem up it is the upper note that moves right, with the stem down
   * the lower note that moves left, so the displaced head always ends up on
   * the far side of the stem from the column.
   */
  const shifted = placed.map(() => false)
  if (up) {
    for (let i = 1; i < placed.length; i++)
      if (placed[i]!.placement.steps - placed[i - 1]!.placement.steps === 1 && !shifted[i - 1])
        shifted[i] = true
  } else {
    for (let i = placed.length - 2; i >= 0; i--)
      if (placed[i + 1]!.placement.steps - placed[i]!.placement.steps === 1 && !shifted[i + 1])
        shifted[i] = true
  }
  // Exactly one notehead across, so the two share an edge and neither eats the
  // other — which is what a second looks like in print.
  const offset = up ? HEAD_RX * 2 : -HEAD_RX * 2
  const headX = placed.map((_, index) => (shifted[index] ? x + offset : x))

  /*
   * The stem.
   *
   * An octave long, which is the conventional length, but never stopping short
   * of the middle line: a note far above or below the staff needs a stem that
   * reaches back towards it, or the chord floats free of the system it belongs
   * to. Engravers lengthen rather than shorten, so the clamp only ever adds.
   */
  const stemX = stemXFor(x, up)
  const middle = staff === 'treble' ? 6 : -6
  const outer = up ? placed.at(-1)! : placed[0]!
  const reach = outer.placement.steps + (up ? STEM_STEPS : -STEM_STEPS)
  // A beamed stem ends on its beam, which is wherever the group put it.
  const stemEnd = stem
    ? stem.end
    : yOn(up ? Math.max(reach, middle) : Math.min(reach, middle), staff)
  const stemStart = yOn(placed[up ? 0 : placed.length - 1]!.placement.steps, staff)

  /*
   * Ledger lines, once each.
   *
   * Two notes below the staff ask for most of the same lines, and drawing one
   * per note stacks them: identical to look at, until one note is sounding and
   * the other is not and whichever draws last decides the colour. Gathered
   * here instead, each line spanning the heads that need it and lit if any of
   * them is.
   */
  const ledgers = new Map<number, { from: number; to: number; head: number; sounding: boolean }>()
  for (const [index, entry] of placed.entries())
    for (const steps of ledgerSteps(entry.placement)) {
      const line = ledgers.get(steps)
      ledgers.set(steps, {
        from: Math.min(line?.from ?? Infinity, headX[index]! - LEDGER_RX),
        to: Math.max(line?.to ?? -Infinity, headX[index]! + LEDGER_RX),
        // Where the leftmost head on the line begins, for the line to be cut
        // back to when a sign needs the room.
        head: Math.min(line?.head ?? Infinity, headX[index]! - HEAD_RX),
        sounding: (line?.sounding ?? false) || (entry.sounding ?? false),
      })
    }

  // What the heads and their lines actually cover.
  const reachOf = (index: number) =>
    ledgerSteps(placed[index]!.placement).length > 0 ? LEDGER_RX : HEAD_RX
  const headLeft = Math.min(...headX.map((at, index) => at - reachOf(index)))
  const headRight = Math.max(
    ...headX.map((at, index) => at + reachOf(index)),
    up ? stemX : -Infinity,
  )

  /*
   * Accidentals, each against whatever is actually beside it.
   *
   * A sign belongs to one note and has to read as part of it, so it goes as
   * close to that note as the ink allows. What is in its way is only what
   * shares its height: its own head, a head displaced across the stem at a
   * second, a down-stem, a ledger line. This used to clear the widest point of
   * the whole chord instead, and a sharp three steps above a displaced head, or
   * level with nothing but another note's ledger line, stood off in the margin
   * looking like it belonged to no note at all.
   *
   * Signs then keep clear of each other. Two closer than a seventh cannot share
   * a column, so the later one moves out past the earlier — working down from
   * the top and outwards, which is how an engraver does it. It is the
   * difference between a dense chord you can read and a stack of sharps you
   * cannot.
   */
  const signY = (steps: number) => yOn(steps, staff) + STEP * 0.9
  const signBand = (steps: number) => ({
    top: signY(steps) - SIGN_INK.above,
    bottom: signY(steps) + SIGN_INK.below,
  })
  // Whoever knew the bar has already decided. The live staff has no bar to
  // remember in, so its notes arrive undecided and the key answers.
  const shown = placed.map((entry) =>
    entry.accidental !== undefined ? entry.accidental : accidentalToShow(entry.placement, fifths),
  )

  /*
   * A ledger line gives way to a sign.
   *
   * It reaches well past its notehead, and a sign kept clear of that reach is
   * a sign kept away from its note. So the line is cut back on that side to a
   * stub, the way it is in print, and the sign takes the room.
   */
  for (const [index, entry] of placed.entries()) {
    // A natural is 0, so this has to ask for null and not for falsy.
    if (shown[index] == null) continue
    const { top, bottom } = signBand(entry.placement.steps)
    for (const [steps, line] of ledgers) {
      const y = yOn(steps, staff)
      if (y + STROKE > top && y - STROKE < bottom)
        ledgers.set(steps, { ...line, from: Math.max(line.from, line.head - LEDGER_STUB) })
    }
  }

  const stemTop = Math.min(stemStart, stemEnd)
  const stemBottom = Math.max(stemStart, stemEnd)
  const signs = new Map<number, { x: number; steps: number; sign: Accidental }>()
  for (let i = placed.length - 1; i >= 0; i--) {
    const sign = shown[i]
    if (sign == null) continue
    const steps = placed[i]!.placement.steps
    const { top, bottom } = signBand(steps)

    // The right edge of the glyph: left of everything at this height.
    let at = Infinity
    for (const [index, other] of placed.entries()) {
      const y = yOn(other.placement.steps, staff)
      if (y + HEAD_RY > top && y - HEAD_RY < bottom) at = Math.min(at, headX[index]! - HEAD_RX)
    }
    for (const [line, { from }] of ledgers) {
      const y = yOn(line, staff)
      if (y + STROKE > top && y - STROKE < bottom) at = Math.min(at, from - STROKE)
    }
    if (value.stemmed && stemBottom > top && stemTop < bottom) at = Math.min(at, stemX - STROKE)
    at -= ACCIDENTAL_GAP

    // Then out past any sign it would crowd, until it crowds none.
    for (let moved = true; moved;) {
      moved = false
      for (const other of signs.values()) {
        if (Math.abs(other.steps - steps) >= ACCIDENTAL_CLEAR) continue
        if (at > other.x - ACCIDENTAL_WIDTH && at - ACCIDENTAL_WIDTH < other.x) {
          at = other.x - ACCIDENTAL_WIDTH
          moved = true
        }
      }
    }
    signs.set(placed[i]!.note, { x: at, steps, sign })
  }
  // The leftmost ink of the chord itself: its heads, or a sign beyond them.
  const chordLeft = Math.min(
    headLeft,
    ...[...signs.values()].map((sign) => sign.x - ACCIDENTAL_WIDTH),
  )

  /*
   * The arpeggio sign, for a chord the hand cannot close on at once.
   *
   * Outside the accidentals, which is where an engraver puts it — it applies to
   * the whole chord, so nothing of the chord may sit outside it.
   */
  const rolled = placed.some((entry) => entry.rolled)
  const arpeggioX = chordLeft - ARPEGGIO_GAP - ARPEGGIO_WIDTH

  // Dots go in one column clear of the whole chord, not each beside its own
  // head, so a displaced head cannot push its dot into the stem.
  const dotX = headRight + STEP * 0.9
  const inked = value.dotted ? dotX + STEP * 0.5 : headRight

  /*
   * Fingerings, in one column to the right of the chord.
   *
   * To the right because that is the side the accidentals are not on. Putting
   * them opposite the stem instead reads well until a chord carries four
   * sharps, at which point the column is driven so far out that it lands on
   * the previous chord — which is exactly what it did.
   *
   * Each sits level with its own note; any that would overlap are pushed
   * apart, then the whole column is re-centred on the chord so the spreading
   * is shared rather than piled onto the top note. Two notes a second apart
   * are five units apart while the numerals are twelve tall, so this is a
   * collision by construction, not bad luck.
   */
  const fingerX = inked + MARGIN
  const fingerY: number[] = []
  for (const [index, entry] of placed.entries()) {
    let at = yOn(entry.placement.steps, staff) + STEP * 0.75
    const below = fingerY[index - 1]
    // The list runs bottom to top and a lower step has the larger y, so each
    // numeral has to clear the one under it.
    if (below !== undefined && below - at < FINGER_CLEAR) at = below - FINGER_CLEAR
    fingerY.push(at)
  }
  const spread = (yOn(placed.at(-1)!.placement.steps, staff) + STEP * 0.75 - fingerY.at(-1)!) / 2
  for (const [index, at] of fingerY.entries()) fingerY[index] = at + spread

  /*
   * How far the chord reaches up and down.
   *
   * The frame used to be a fixed height, and anything past it was simply not
   * drawn: a chord in the top octave lost its noteheads, its ledger lines and
   * its fingering, silently, with the staff underneath looking perfectly
   * normal. The page asks for this and grows to fit.
   */
  const marked = placed.some((entry) => entry.finger !== undefined)
  const ys = [
    ...placed.map((entry) => yOn(entry.placement.steps, staff)),
    ...[...ledgers.keys()].map((steps) => yOn(steps, staff)),
  ]
  let top = Math.min(stemStart, stemEnd, ...ys.map((at) => at - HEAD_RY))
  let bottom = Math.max(stemStart, stemEnd, ...ys.map((at) => at + HEAD_RY))
  for (const [index, entry] of placed.entries()) {
    if (entry.finger !== undefined) {
      top = Math.min(top, fingerY[index]! - FINGER_INK.above)
      bottom = Math.max(bottom, fingerY[index]! + FINGER_INK.below)
    }
    if (signs.has(entry.note)) {
      const band = signBand(entry.placement.steps)
      top = Math.min(top, band.top)
      bottom = Math.max(bottom, band.bottom)
    }
  }

  return {
    placed,
    staff,
    up,
    sounding,
    headX,
    stemX,
    stemStart,
    stemEnd,
    ledgers,
    signs,
    dotX,
    fingerX,
    fingerY,
    rolled,
    arpeggioX,
    /** How far the ink reaches either side of the chord's own position. */
    left: (rolled ? arpeggioX : chordLeft) - x - STROKE,
    right: (marked ? fingerX + FINGER_INK.half : inked) - x + STROKE,
    top: top - STROKE,
    bottom: bottom + STROKE,
  }
}

type Reach = { treble?: number; bass?: number }

function reachOf(inner: Reach, outer: Reach, staff: Staff, box: { top: number; bottom: number }) {
  if (staff === 'treble') {
    inner.treble = Math.max(inner.treble ?? -Infinity, box.bottom)
    outer.treble = Math.min(outer.treble ?? Infinity, box.top)
  } else {
    inner.bass = Math.min(inner.bass ?? Infinity, box.top)
    outer.bass = Math.max(outer.bass ?? -Infinity, box.bottom)
  }
}

/**
 * How much room a chord needs: sideways from where it sits, and up and down.
 *
 * Sideways is relative to the chord's own position, so the page can decide
 * where to put the next one. Up and down are absolute, because the staff is.
 */
export function chordExtent(
  notes: readonly DrawnNote[],
  value: WrittenValue | { readonly treble: WrittenValue; readonly bass: WrittenValue },
  fifths = 0,
): Extent {
  const per = 'treble' in value ? value : { treble: value, bass: value }
  let left = 0
  let right = 0
  let top = 0
  let bottom = 0
  const inner: Reach = {}
  const outer: Reach = {}
  for (const staff of ['treble', 'bass'] as const) {
    const on = notes.filter((note) => staffOf(note) === staff)
    const box = layout(0, on, per[staff], fifths)
    if (!box) continue
    left = Math.min(left, box.left)
    right = Math.max(right, box.right)
    top = Math.min(top, box.top)
    bottom = Math.max(bottom, box.bottom)
    reachOf(inner, outer, staff, box)
  }
  return { left: -left, right, top, bottom, inner, outer }
}

/** How much room a step's voices need between them, each where it stands. */
export function partsExtent(parts: readonly VoicePart[], fifths = 0): Extent {
  let left = 0
  let right = 0
  let top = 0
  let bottom = 0
  const inner: Reach = {}
  const outer: Reach = {}
  for (const part of parts) {
    const box = layout(part.dx, part.notes, part.value, fifths, undefined, part.stem)
    if (!box) continue
    left = Math.min(left, box.left + part.dx)
    right = Math.max(right, box.right + part.dx)
    top = Math.min(top, box.top)
    bottom = Math.max(bottom, box.bottom)
    reachOf(inner, outer, box.staff, box)
  }
  return { left: -left, right, top, bottom, inner, outer }
}

/** Half the room a rest takes, for the spacing: the widest of them, the semibreve's block. */
export const REST_HALF = STEP * 1.3
