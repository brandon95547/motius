import type { Staff } from '@motius/shared'
import { STEP } from './staff-frame'
import { REST_HALF } from './chord-layout'
import type { TieArc } from './notation'
import type { BarMarks, Measured, RestMark } from './score-model'

/**
 * A run of chords laid out along a line: each chord's x, and the bar lines,
 * ending brackets and whole-bar rests between them.
 */

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
