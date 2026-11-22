import type { Staff } from '@motius/shared'
import {
  HALF_HEIGHT,
  KEY_X,
  keyWidth,
  STAFF_BANDS,
  STAFF_HEIGHT,
  STEP,
  yOn,
  type BraceSpan,
  type LayerPlace,
  type RowsShown,
} from './staff-frame'
import type { BarMarks, Measured } from './score-model'

/**
 * Where a system stands on the page, top to bottom: the head of each line,
 * the height of its frame, and how far its staves are opened apart.
 */

/** How far a bar number's ink rises above its own baseline, measured. */
const BAR_NUMBER_INK = 11

/** Half a time-signature numeral's measured width. */
const TIME_HALF = 9

/** How high an ending bracket runs, above the bar numbers. */
export const VOLTA_Y = yOn(19, 'treble')

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
  /**
   * Where the braces go, where the system has more than the one down its
   * whole height: a brace to each pair of staves, on a page with two staves
   * to a hand.
   */
  readonly braces?: readonly BraceSpan[]
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
  // A brace to each pair, where every pair on the page is a whole one and
  // there is more than one: two staves to a hand. Three staves, or a pair with
  // a staff left out, are under one brace like any piano system.
  const pairs = places.filter((each) => each.rows.treble || each.rows.bass)
  const braces =
    pairs.length > 1 && pairs.every((each) => each.rows.treble && each.rows.bass)
      ? pairs.map((each) => ({
          top: each.offset + STAFF_BANDS.treble.top - each.spread,
          bottom: each.offset + STAFF_BANDS.bass.bottom + each.spread,
        }))
      : undefined

  return {
    layers: places,
    staves: tops,
    ...(braces ? { braces } : {}),
    top: Math.floor(top),
    bottom: Math.ceil(bottom),
  }
}
