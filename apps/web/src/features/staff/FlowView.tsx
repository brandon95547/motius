import * as React from 'react'
import { useElementSize } from '@/lib/hooks'
import {
  GUTTER,
  GutterStaves,
  STAFF_HEIGHT,
  STAFF_START,
  StaffLayer,
  StaffLines,
  STEP,
  SystemBrace,
  SystemContext,
  type RowsShown,
} from './staff-frame'
import {
  BarLines,
  BarRests,
  Beams,
  isLive,
  LiveStep,
  phaseOf,
  Playhead,
  PLAYHEAD_SHOWN,
  RepeatSign,
  Signatures,
  Step,
  SystemEnd,
  Voltas,
  watchedIn,
  type Phase,
  type Role,
  type Watched,
} from './score-parts'
import {
  barLinesIn,
  barRestsIn,
  endOf,
  headerEnd,
  layoutOf,
  leadIn,
  place,
  voltasIn,
  type BarLine,
  type BarMarks,
  type Measured,
  type Placed,
} from './score'
import { beamsIn, type StepStems } from './beams'

/**
 * The music as one endless system, running past a fixed clef.
 *
 * Sonara's guided reading: the music moves and your place in it does not, which
 * is the same bargain the keyboard makes when it follows what you play. It suits
 * a learner, who is watching one chord arrive at a time and wants the next few
 * in front of them — and it suits nobody who can already read a song, which is
 * what Sheet is for.
 *
 * Three layers. The paper is at the back and does not scroll: two strips the
 * width of the stage, each exactly as tall as its staff, however short the
 * music on them is. The clefs are pinned over their left end, standing out
 * above and below them. And the music scrolls in a window that starts where
 * the clefs end and stops where the strips do — so a note leaving the view goes
 * out at an edge, rather than sliding under an opaque cover laid over the
 * clefs.
 *
 * Only the stretch of music near the window is drawn. The system is as long as
 * the piece — a few thousand notes and tens of thousands of pixels — and with
 * all of it in the page, every chord that changed colour had the browser
 * laying out and repainting the whole song. That took a quarter of a second at
 * a time, during which nothing else ran: not the clock that strikes the notes,
 * so a song played late and unevenly for as long as its staff was showing.
 */

export function FlowView({
  measured,
  layers,
  rows,
  marks,
  here,
  fifths,
  beats,
  beatType,
  roleFor,
  label,
  withTime = true,
  final = true,
  numbered = true,
  watchAll = false,
  position = here,
}: {
  /**
   * The chords to draw, in order. The whole piece, or — of a piece whose
   * staves come and go — the stretch of it the player is in, which is drawn on
   * the same staves from end to end.
   */
  measured: readonly Measured[]
  /**
   * The same chords a pair of staves at a time, where the score is written on
   * more than two: each pair drawn as a piano's usual two are, one under the
   * other. Absent for a plain score, whose one pair is `measured` itself.
   */
  layers?: readonly (readonly Measured[])[]
  /** Which staves of each pair are drawn. All of them, where it does not say. */
  rows?: readonly RowsShown[]
  /** The bars with a repeat sign or an ending bracket, where the music has any. */
  marks?: BarMarks
  /** The chord the page is turned to, as the piece counts them. */
  here: number
  fifths: number
  beats: number
  beatType: number
  roleFor: (index: number) => Role
  label: string
  /** The metre up front. A song states it; a scale has no metre to state. */
  withTime?: boolean
  /**
   * The line ends where the piece does, on the final bar line. Not so for a
   * stretch of a piece that goes on, on other staves, after it.
   */
  final?: boolean
  /** Bar numbers, so a player can say where they are. A scale is too short to need them. */
  numbered?: boolean
  /**
   * Every chord watches the keys, not only the few near your place.
   *
   * A song keeps to the window: it has hundreds of chords and plays middle C
   * fifty times, so watching all of them costs a redraw of the piece and says
   * nothing about where you are. A scale has a couple of dozen notes, and a
   * player running up it before pressing Start — or past the window after —
   * expects the note they are holding to light where it is written.
   */
  watchAll?: boolean
  /**
   * The step the player is known to be on, where that is not `here`.
   *
   * `here` is where the page is turned to, and a scale that has not been
   * started is turned to its first note without anybody being on it. A held
   * pitch lights at its writing nearest this, so it is negative when nobody is
   * anywhere and the keys are left to say where they are.
   */
  position?: number
}) {
  const [frameRef, size] = useElementSize<HTMLDivElement>()
  const scrollRef = React.useRef<HTMLDivElement>(null)

  // Where the player is along the places drawn, which need not begin at the
  // piece's first, and are not all chords.
  const base = measured[0]?.index ?? 0
  const at = React.useMemo(
    () => measured.findIndex((entry) => entry.index === here),
    [measured, here],
  )

  const placed = React.useMemo(
    () => place(measured, headerEnd(fifths, withTime)),
    [measured, fifths, withTime],
  )
  // Each pair of staves, set out on the same line: the same chords at the
  // same places, each pair with its own notes on them.
  const stack = React.useMemo(() => layers ?? [measured], [layers, measured])
  const placedLayers = React.useMemo(
    () =>
      layers
        ? layers.map((layer) => place(layer, headerEnd(fifths, withTime), 1, leadIn(measured[0])))
        : [placed],
    [layers, placed, measured, fifths, withTime],
  )
  // One distance between the staves for the whole of the line: it scrolls
  // under the player, and a staff that moved as it went would be the worst
  // thing on the page.
  const layout = React.useMemo(() => layoutOf(stack, rows, marks), [stack, rows, marks])
  const frame = layout
  const height = frame.bottom - frame.top
  // The chords listening to the keys, so each can tell whether a pitch it is
  // holding is being played here or somewhere else it is written.
  // With every chord listening, the one that struck a held note is among them
  // and speaks for itself.
  const watched = React.useMemo(
    () =>
      watchedIn(measured, (index) => watchAll || isLive(roleFor(index)), watchAll ? -1 : position),
    [measured, watchAll, roleFor, position],
  )

  // The drawing scales with the panel's height, so the width in pixels follows
  // from it — which is what makes the container scroll by the right amount.
  //
  // Not rounded. The clefs and the music are two drawings that have to meet
  // as one: a width a fraction of a pixel short makes `meet` fit that drawing
  // by its width instead, at a scale of its own, and the staff lines step
  // where the two join.
  const scale = size.height > 0 ? size.height / height : 1
  const gutterPx = GUTTER * scale
  const insetPx = STAFF_START * scale
  /** The music's window, in pixels: between the clefs and the strips' right end. */
  const visible = size.width - gutterPx - insetPx
  // At least as wide as the window, so the lines run the length of the paper
  // under them even when the music stops short of it.
  const totalWidth = Math.max((placed.at(-1)?.x ?? 0) + 60, GUTTER + Math.max(0, visible) / scale)
  const musicWidth = totalWidth - GUTTER
  const pixelWidth = musicWidth * scale

  /*
   * Which stretch is drawn: the window, and a window's width either side.
   *
   * Counted in half-windows of scroll rather than in pixels, so the drawing
   * changes when the view has moved half a screen and not on every pixel of a
   * drag. The margin either side is wider than any jump the view makes to
   * follow the player, so what it lands on is already there.
   *
   * Everything, until the panel has been measured: there is no window yet to
   * draw a part of.
   */
  const [page, setPage] = React.useState(0)
  const stride = Math.max(1, visible / 2)
  const span = React.useMemo(() => {
    if (visible <= 0) return null
    return {
      from: GUTTER + (page * stride - visible) / scale,
      to: GUTTER + ((page + 1) * stride + visible * 2) / scale,
    }
  }, [page, stride, visible, scale])
  const barLines = React.useMemo(() => barLinesIn(placed, marks), [placed, marks])
  // Where the first bar's own marks go: just in front of its first ink.
  const opening = placed[0] ? placed[0].x - placed[0].extent.left - STEP * 3 : 0
  const voltas = React.useMemo(
    () => voltasIn(placed, barLines, marks, opening, endOf(placed)),
    [placed, barLines, marks, opening],
  )
  const shownVoltas = React.useMemo(
    () =>
      span ? voltas.filter((volta) => volta.to >= span.from && volta.from <= span.to) : voltas,
    [voltas, span],
  )
  const shownBars = React.useMemo(
    () => (span ? barLines.filter((line) => line.x >= span.from && line.x <= span.to) : barLines),
    [barLines, span],
  )

  // A new stretch of the piece is a new line: back to its beginning, and then
  // on to wherever in it the player is.
  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = 0
    setPage(0)
  }, [base])

  // Keep the current chord on screen, the way the keyboard follows what you
  // play. Nothing to do until the panel has been laid out — a width of zero
  // makes every margin zero, and the score scrolls to nowhere before the first
  // note is played.
  React.useEffect(() => {
    const box = scrollRef.current
    const current = placed[at]
    // The panel's own measured width, not `box.clientWidth`. Reading layout
    // from inside the effect returns zero here — the element is in the document
    // and is the right one, and still measures nothing — so the guard below
    // rejected every scroll and the score silently never followed. The observer
    // that already sizes the drawing knows the answer.
    if (!box || !current || visible <= 0) return
    const x = (current.x - GUTTER) * scale
    const margin = visible * 0.35
    if (x < box.scrollLeft + margin || x > box.scrollLeft + visible - margin) {
      // A jump, on purpose. Smooth scrolling here — by CSS or by the `behavior`
      // option — does nothing at all on engines that have not implemented it,
      // and the score just stops following with no sign of why. Arriving
      // abruptly beats not arriving.
      box.scrollLeft = Math.max(0, x - margin)
    }
  }, [at, placed, scale, visible])

  // Where the paper goes, in pixels: the same bands PaperCards draws in units,
  // one under every staff.
  const band = (top: number) => ({
    top: (top - frame.top) * scale,
    height: STAFF_HEIGHT * scale,
    left: insetPx,
    right: insetPx,
  })
  /** Each pair of staves that has a staff to draw, with where it stands. */
  const pairs = placedLayers
    .map((entries, index) => ({ entries, index, place: layout.layers[index]! }))
    .filter(({ place }) => place.rows.treble || place.rows.bass)

  return (
    <SystemContext.Provider value={layout.staves}>
      <div ref={frameRef} className="staff-fit staff-score">
        {layout.staves.map((top) => (
          <div key={top} className="staff-card" style={band(top)} aria-hidden />
        ))}

        <svg
          className="staff-gutter"
          viewBox={`0 ${frame.top} ${GUTTER} ${height}`}
          width={gutterPx || undefined}
          height="100%"
          preserveAspectRatio="xMinYMid meet"
          aria-hidden
        >
          <SystemBrace braces={layout.braces} />
          {/* The clef where the player is: the clefs stay put while the music
              passes them, so they are the ones the music at hand is read in. */}
          {pairs.map(({ entries, index, place }) => (
            <StaffLayer key={index} place={place}>
              <GutterStaves clefs={entries[at]?.clefs ?? entries[0]?.clefs} />
            </StaffLayer>
          ))}
        </svg>

        <div
          ref={scrollRef}
          className="staff-scroll"
          style={{ left: gutterPx, right: insetPx }}
          onScroll={(event) => setPage(Math.floor(event.currentTarget.scrollLeft / stride))}
        >
          <svg
            viewBox={`${GUTTER} ${frame.top} ${musicWidth} ${height}`}
            width={pixelWidth || undefined}
            height="100%"
            preserveAspectRatio="xMinYMid meet"
            className="staff"
            role="img"
            aria-label={label}
          >
            {pairs.map(({ entries, index, place }) => (
              <StaffLayer key={index} place={place}>
                <StaffLines from={GUTTER} to={totalWidth} />
                <Signatures
                  fifths={fifths}
                  beats={beats}
                  beatType={beatType}
                  withTime={withTime}
                  clefs={entries[0]?.clefs}
                />
              </StaffLayer>
            ))}
            <BarLines lines={shownBars} numbered={numbered} />
            {placed.length > 0 && (
              <SystemEnd
                x={endOf(placed)}
                final={final}
                repeat={marks?.get(placed.at(-1)!.bar)?.repeat?.times !== undefined}
              />
            )}
            {placed[0] && marks?.get(placed[0].bar)?.repeat?.start && (
              <RepeatSign x={opening} opens />
            )}
            <Voltas voltas={shownVoltas} />
            {PLAYHEAD_SHOWN && placed[at] && <Playhead x={placed[at]!.x} />}
            {pairs.map(({ entries, index, place }) => (
              <StaffLayer key={index} place={place}>
                <Music
                  placed={entries}
                  spread={place.spread}
                  span={span}
                  barLines={barLines}
                  opening={opening}
                  end={endOf(placed)}
                  roleFor={roleFor}
                  watchAll={watchAll}
                  fifths={fifths}
                  watched={watched}
                  position={position}
                />
              </StaffLayer>
            ))}
          </svg>
        </div>
      </div>
    </SystemContext.Provider>
  )
}

/**
 * The notes of one pair of staves: its chords, their beams and its rests.
 *
 * A piano's usual score has one pair and this is all its music. A score on
 * three staves or four has this once for each pair, the same chords in each
 * with that pair's notes on them.
 */
function Music({
  placed,
  spread,
  span,
  barLines,
  opening,
  end,
  roleFor,
  watchAll,
  fifths,
  watched,
  position,
}: {
  placed: readonly Placed[]
  /** How far this pair of staves has opened, for a beam that lies between them. */
  spread: number
  /** The stretch being drawn, or null where all of it is. */
  span: { from: number; to: number } | null
  barLines: readonly BarLine[]
  /** Where the first bar begins and the last ends, for a rest in the middle of either. */
  opening: number
  end: number
  roleFor: (index: number) => Role
  watchAll: boolean
  fifths: number
  watched: readonly Watched[]
  position: number
}) {
  // Where the beams run, and the stems they have decided. Once per layout:
  // the stems are handed to memoised chords and must stay the same objects.
  const beaming = React.useMemo(() => beamsIn(placed, spread), [placed, spread])
  const shown = React.useMemo(
    () => (span ? placed.filter((entry) => entry.x >= span.from && entry.x <= span.to) : placed),
    [placed, span],
  )
  // The stretch in runs of a few chords, each drawn again only when the player
  // is in it. Cut where the chord's number divides, not where the window
  // starts, so a run is the same run as the window slides over it.
  const runs = React.useMemo(() => {
    const groups: Placed[][] = []
    for (const entry of shown) {
      // A chord with nothing on this pair of staves is not drawn on it.
      if (entry.notes.length === 0 && !entry.restsAt && !entry.clefChange) continue
      const group = groups.at(-1)
      if (group && Math.floor(group[0]!.index / RUN) === Math.floor(entry.index / RUN))
        group.push(entry)
      else groups.push([entry])
    }
    return groups
  }, [shown])
  const barRests = React.useMemo(
    () => barRestsIn(placed, barLines, opening, end),
    [placed, barLines, opening, end],
  )
  const shownBarRests = React.useMemo(
    () => (span ? barRests.filter((rest) => rest.x >= span.from && rest.x <= span.to) : barRests),
    [barRests, span],
  )
  const shownBeams = React.useMemo(() => {
    const first = shown[0]?.index ?? 0
    const last = shown.at(-1)?.index ?? -1
    return span
      ? beaming.beams.filter((beam) =>
          beam.indices.some((index) => index >= first && index <= last),
        )
      : beaming.beams
  }, [beaming, shown, span])

  return (
    <>
      <BarRests rests={shownBarRests} />
      <Beams beams={shownBeams} roleFor={roleFor} />
      {runs.map((run) => (
        <Run
          key={run[0]!.index}
          entries={run}
          // A scale watches every chord, so every run of one is live.
          phase={watchAll ? 'live' : phaseOf(roleFor, run[0]!.index, run.at(-1)!.index + 1)}
          roleFor={roleFor}
          watchAll={watchAll}
          fifths={fifths}
          watched={watched}
          position={position}
          stems={beaming.stems}
        />
      ))}
    </>
  )
}

/** How many chords are drawn, and redrawn, together. */
const RUN = 16

interface RunProps {
  entries: readonly Placed[]
  phase: Phase
  roleFor: (index: number) => Role
  watchAll: boolean
  fifths: number
  watched: readonly Watched[]
  position: number
  stems: ReadonlyMap<number, StepStems>
}

/**
 * A few chords of the system, drawn again only when the player is among them.
 * See `phaseOf`: a run wholly behind or wholly ahead is the same picture
 * wherever the player is.
 */
const Run = React.memo(
  function Run({ entries, roleFor, watchAll, fifths, watched, position, stems }: RunProps) {
    return (
      <>
        {entries.map((entry) => {
          const role = roleFor(entry.index)
          return (
            <StepAt
              key={entry.index}
              placed={entry}
              role={role}
              live={watchAll || isLive(role)}
              fifths={fifths}
              watched={watched}
              position={position}
              stems={stems.get(entry.index)}
            />
          )
        })}
      </>
    )
  },
  (before, after) =>
    before.entries === after.entries &&
    before.phase === after.phase &&
    before.fifths === after.fifths &&
    before.stems === after.stems &&
    before.watchAll === after.watchAll &&
    (after.phase !== 'live' ||
      (before.roleFor === after.roleFor &&
        before.watched === after.watched &&
        before.position === after.position)),
)

/** Watched if it is live, drawn once and left alone if it is not. */
function StepAt({
  placed,
  role,
  live,
  fifths,
  watched,
  position,
  stems,
}: {
  placed: Placed
  role: Role
  live: boolean
  fifths: number
  watched: readonly Watched[]
  position: number
  stems?: StepStems
}) {
  return live ? (
    <LiveStep
      placed={placed}
      role={role}
      fifths={fifths}
      watched={watched}
      position={position}
      stems={stems}
    />
  ) : (
    <Step placed={placed} role={role} fifths={fifths} lit="" stems={stems} />
  )
}
