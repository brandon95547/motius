import * as React from 'react'
import { songSteps, type Song, type SongNote } from '@motius/shared'
import { layersOf, type Measured, type ScoreSource } from './score-model'
import { measureScore } from './measure-score'
import { regionsOf, type ScoreRegion } from './score-regions'
import type { SongPart } from '@/state/song-store'

/** The same two measures for the printed page, which sets its bars closer. */
const PAGE_BAR_WIDTH = 150
const PAGE_MIN_GAP = 26

/**
 * The song's chords, measured, kept until the song, the part or the printed
 * fingering changes.
 *
 * The fingering belongs in here rather than in the drawing because a printed
 * numeral takes room on the page, and a score spaced for numbers it does not
 * print is spaced wrong.
 */
export function useMeasuredScore(
  song: Song | null,
  part: SongPart,
  hints?: ReadonlySet<SongNote>,
  /**
   * Spaced for the printed page rather than for the moving staff.
   *
   * The moving staff shows a few bars and gives them room; a page is read a
   * line at a time and wants as many bars on the line as an engraver would
   * set. Same notes, same ink, less air between them.
   */
  page = false,
) {
  const steps = React.useMemo(() => (song ? songSteps(song, part) : []), [song, part])
  const source = React.useMemo<ScoreSource | null>(
    () =>
      song && {
        ...song,
        // A score states every length, so its short notes can be beamed. A
        // performance only implies them.
        beams: song.provides?.rhythm === true,
        // The rests of the hands being shown. A hand that is not on the page
        // has no silences to mark on it.
        rests: song.rests?.filter((rest) => part === 'both' || rest.hand === part),
        ...(page ? { barWidth: PAGE_BAR_WIDTH, minGap: PAGE_MIN_GAP } : {}),
      },
    [song, page, part],
  )
  const score = React.useMemo((): {
    /** Every chord, measured: the whole system's, where the score has more than one pair of staves. */
    measured: readonly Measured[]
    /** Each pair's chords, on a score written on more than two staves. */
    layers?: readonly (readonly Measured[])[]
    /** The stretches of such a score that are drawn on the same staves. */
    regions?: readonly ScoreRegion[]
  } => {
    const pairs = layersOf(song?.staves)
    if (!song || !pairs) return { measured: measureScore(source, steps, hints) }
    const { layers, outline } = alignLayers(
      pairs.map((pair) => measureScore(source, steps, hints, pair)),
    )
    return { measured: outline, layers, regions: regionsOf(song, outline, pairs) }
  }, [song, source, steps, hints])
  return { steps, ...score }
}

/**
 * Set the pairs of a score's staves under one another.
 *
 * Each pair was measured by itself, and gave each chord the room its own ink
 * asks for. On the page the pairs are one system: a chord is one column down
 * all of them. So every chord takes the widest room any pair wanted for it —
 * and `outline` is the system seen as a whole, for the things that are
 * decided once for all its staves: where the lines break, and where the bar
 * lines stand.
 */
export function alignLayers(layers: readonly (readonly Measured[])[]): {
  layers: Measured[][]
  outline: Measured[]
} {
  const outline = (layers[0] ?? []).map((entry, at): Measured => {
    const all = layers.map((layer) => layer[at]!)
    const rests = all.flatMap((each) => each.rests ?? [])
    return {
      ...entry,
      notes: all.flatMap((each) => each.notes),
      gap: Math.max(...all.map((each) => each.gap)),
      // Sideways, the widest of them. Up and down mean nothing across pairs,
      // each of which measures from its own middle: `layoutOf` asks the pairs.
      extent: {
        ...entry.extent,
        left: Math.max(...all.map((each) => each.extent.left)),
        right: Math.max(...all.map((each) => each.extent.right)),
      },
      ...(rests.length > 0 ? { rests } : {}),
    }
  })
  return {
    layers: layers.map((layer) =>
      layer.map((entry, at) =>
        entry.gap === outline[at]!.gap ? entry : { ...entry, gap: outline[at]!.gap },
      ),
    ),
    outline,
  }
}
