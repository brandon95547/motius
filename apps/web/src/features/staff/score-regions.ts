import { barIndexAt, type Song, type SongStep } from '@motius/shared'
import type { RowsShown } from './staff-frame'
import { staffNumberOf, type Measured, type ScoreLayer } from './score-model'

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
