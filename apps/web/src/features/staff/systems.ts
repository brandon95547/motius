import { STEP } from './staff-frame'
import type { Measured } from './score-model'
import { headerEnd } from './system-layout'
import { leadIn } from './score-lines'

/** Where a score's lines break, and how far each is opened up to fill its width. */

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
  const systems: Omit<System, 'stretch'>[] = []
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

    systems.push({ from, to })
    from = to
  }

  /*
   * The line before a change of staves.
   *
   * A line that has to end there ends wherever the music has got to, and that
   * can be one bar into it: three bars filling a line and a fourth alone on
   * the next, with the rest of that line bare, before the page goes on to
   * four staves. An engraver would have shared those four bars between the
   * two lines. So a short line in front of such a break takes bars from the
   * line before it, until the two are as even as a bar line allows.
   */
  for (let at = 1; at < systems.length; at++) {
    const short = systems[at]!
    const before = systems[at - 1]!
    if (!breaks?.has(short.to) || breaks.has(short.from)) continue
    if (naturalWidth(measured, short.from, short.to, fifths) >= width * MIN_FILL) continue
    let best = short.from
    let uneven = Infinity
    for (let split = before.from + 1; split <= short.from; split++) {
      if (measured[split]!.bar === measured[split - 1]!.bar) continue
      const second = naturalWidth(measured, split, short.to, fifths)
      if (second + RIGHT_MARGIN > width) continue
      const difference = Math.abs(naturalWidth(measured, before.from, split, fifths) - second)
      if (difference < uneven) {
        uneven = difference
        best = split
      }
    }
    systems[at - 1] = { ...before, to: best }
    systems[at] = { ...short, from: best }
  }

  return systems.map((system) => ({
    ...system,
    stretch: stretchFor(measured, system.from, system.to, fifths, width),
  }))
}

/** How wide a run of chords is as it was measured, from the head of its line to its last ink. */
function naturalWidth(
  measured: readonly Measured[],
  from: number,
  to: number,
  fifths: number,
): number {
  let width = headerEnd(fifths, from === 0) + leadIn(measured[from])
  for (let i = from + 1; i < to; i++) width += measured[i]!.gap
  return width + measured[to - 1]!.extent.right
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
  if (naturalWidth(measured, from, to, fifths) < width * MIN_FILL) return 1
  const target = width - RIGHT_MARGIN
  return Math.min(MAX_STRETCH, Math.max(1, (target - start - last) / gaps))
}
