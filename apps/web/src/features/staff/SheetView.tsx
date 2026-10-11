import * as React from 'react'
import { useElementSize } from '@/lib/hooks'
import {
  GUTTER,
  GutterStaves,
  HALF_HEIGHT,
  PAPER_MARGIN,
  PaperCards,
  STAFF_START,
  StaffLayer,
  StaffLines,
  STEP,
  SystemBrace,
  SystemContext,
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
  breakIntoSystems,
  headerEnd,
  layoutOf,
  leadIn,
  place,
  voltasIn,
  type BarMarks,
  type Measured,
  type Placed,
  type ScoreRegion,
  type SystemLayout,
} from './score'
import { beamsIn, type StepStems } from './beams'

/**
 * The song as printed music: lines, read left to right and then down.
 *
 * For someone who already reads. Flow moves the music past a fixed playhead,
 * which is the right way to be taught and the wrong way to sight-read — the
 * page will not hold still, and you cannot look ahead of a note that has not
 * arrived yet. Here the notation stays where it is and the playhead travels
 * across it, exactly as your eye does on paper.
 *
 * The page turns only when it has to, and lands the current system at the top
 * so everything still to be played is below it. Anything gentler — following
 * continuously, or centring the current line — spends half the panel on music
 * already behind you.
 *
 * Two systems to a screen, at the size music is engraved for one. It was once
 * two thirds of that, with four or five lines in view, which is a page held at
 * arm's length: the notes were there and nobody at a piano could read them.
 *
 * Only the systems near the window are drawn, for the reason Flow draws only
 * the stretch near its own: with a whole sonata in the page, every chord that
 * changed colour cost a repaint of all of it.
 */

/**
 * Pixels per unit at full size: one.
 *
 * A staff space is ten units, so the lines of a staff stand ten pixels apart —
 * the size engraving programs set music at on a screen. Printed music has a
 * staff size; a page that resized its notes as it filled up would be a strange
 * thing to read. So a taller panel gives the lines more room rather than
 * bigger notes, and only a panel too small for two systems shrinks them.
 */
const FULL_SCALE = 1
/** How many systems the panel shows at a time. */
const ROWS = 2
/**
 * The narrowest line worth breaking music onto, in units.
 *
 * The brace, the clefs and the key take about a hundred and fifty of them
 * before a single note is drawn. On a phone at full size that is most of the
 * line, and bars start breaking in half — so the staff shrinks, but only as
 * far as it takes to fit a bar, and never on a screen with room to spare.
 */
const MIN_PAGE = 520
/** The least air between two systems, in units. */
const MIN_SPACING = 26
/** A system with nothing reaching out of its frame, in units. */
const PLAIN_SYSTEM = HALF_HEIGHT * 2

export function SheetView({
  measured,
  layers,
  regions,
  marks,
  here,
  fifths,
  beats,
  beatType,
  roleFor,
  label,
}: {
  measured: readonly Measured[]
  /**
   * The same chords a pair of staves at a time, where the score is written on
   * more than two. Absent for a plain score, whose one pair is `measured`.
   */
  layers?: readonly (readonly Measured[])[]
  /**
   * The stretches of such a score that are drawn on the same staves. A line
   * never runs from one into the next: it has the staves it starts with.
   */
  regions?: readonly ScoreRegion[]
  /** The bars with a repeat sign or an ending bracket, where the music has any. */
  marks?: BarMarks
  here: number
  fifths: number
  beats: number
  beatType: number
  roleFor: (index: number) => Role
  label: string
}) {
  const [frameRef, size] = useElementSize<HTMLDivElement>()
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const scale = Math.min(
    FULL_SCALE,
    size.width > 0 ? size.width / MIN_PAGE : FULL_SCALE,
    // Two plain systems have to fit, or the page is one line at a time.
    size.height > 0 ? size.height / (ROWS * (PLAIN_SYSTEM + MIN_SPACING)) : FULL_SCALE,
  )
  const pageWidth = size.width > 0 ? size.width / scale : 0
  // Each system has half the panel, so two fill it exactly and the next page
  // turn shows the next two. One that reaches further out of its frame, for a
  // run of ledger lines, takes the room it needs.
  const spacing = Math.max(MIN_SPACING, size.height / scale / ROWS - PLAIN_SYSTEM)

  const systems = React.useMemo(() => {
    if (pageWidth <= 0 || measured.length === 0) return []
    let y = spacing / 2
    const breaks = regions && new Set(regions.slice(1).map((region) => region.from))
    return breakIntoSystems(measured, fifths, pageWidth, breaks).map((system) => {
      const slice = measured.slice(system.from, system.to)
      const stack = layers ? layers.map((layer) => layer.slice(system.from, system.to)) : [slice]
      const rows = regions?.find(
        (region) => system.from >= region.from && system.from < region.to,
      )?.rows
      // Each line has the room between its staves that its own bars ask for,
      // as each line of a printed page does. It does not move once drawn.
      const layout = layoutOf(stack, rows, marks)
      const start = headerEnd(fifths, system.from === 0)
      const placed = place(slice, start, system.stretch)
      const height = layout.bottom - layout.top
      const top = y
      y += height + spacing
      return {
        ...system,
        placed,
        // Each pair of staves on the same line, with its own notes and beams.
        // A line at a time: a beam does not cross a system break.
        pairs: (layers
          ? stack.map((layer) => place(layer, start, system.stretch, leadIn(slice[0])))
          : [placed]
        )
          .map((entries, index) => ({
            entries,
            beaming: beamsIn(entries, layout.layers[index]!.spread),
            place: layout.layers[index]!,
          }))
          .filter(({ place }) => place.rows.treble || place.rows.bass),
        layout,
        top,
        height,
        origin: top - layout.top,
      }
    })
  }, [measured, layers, regions, marks, fifths, pageWidth, spacing])

  // Across the whole page rather than a line at a time: the chords near the
  // playhead run over a line break, and a pitch written either side of one is
  // still written twice.
  const watched = React.useMemo(
    () => watchedIn(measured, (index) => isLive(roleFor(index)), here),
    [measured, roleFor, here],
  )

  const last = systems.at(-1)
  const pageHeight = last ? last.top + last.height + spacing / 2 : PLAIN_SYSTEM
  const current = systems.find((system) => system.placed.some((entry) => entry.index === here))

  // Which systems are drawn: the ones in the window, and a window's worth
  // either side. Counted in half-windows of scroll, so the drawing changes
  // when the page has moved half a screen and not on every pixel of a drag.
  const [page, setPage] = React.useState(0)
  const stride = Math.max(1, size.height / 2)
  const shown = React.useMemo(() => {
    if (size.height <= 0) return systems
    const from = (page * stride - size.height) / scale
    const to = ((page + 1) * stride + size.height * 2) / scale
    return systems.filter((system) => system.top + system.height >= from && system.top <= to)
  }, [systems, page, stride, size.height, scale])

  /*
   * Turn the page, and only then.
   *
   * While the line being played is on screen nothing moves, which is the whole
   * point of this view. When it is not, it goes to the top: that is the choice
   * that leaves the most unplayed music in front of the reader, and a reader
   * who cannot see what is coming is not sight-reading.
   */
  React.useEffect(() => {
    const box = scrollRef.current
    if (!box || !current || size.height === 0) return
    const top = current.top * scale
    const bottom = (current.top + current.height) * scale
    if (top < box.scrollTop || bottom > box.scrollTop + size.height)
      box.scrollTop = Math.max(0, top - (spacing * scale) / 2)
  }, [current, size.height, scale, spacing])

  return (
    <div ref={frameRef} className="staff-fit">
      <div
        ref={scrollRef}
        className="staff-sheet"
        onScroll={(event) => setPage(Math.floor(event.currentTarget.scrollTop / stride))}
      >
        <svg
          viewBox={`0 0 ${Math.max(pageWidth, 1)} ${pageHeight}`}
          width={size.width || undefined}
          height={Math.round(pageHeight * scale) || undefined}
          preserveAspectRatio="xMinYMin meet"
          className="staff"
          role="img"
          aria-label={label}
        >
          {shown.map((system) => (
            <SystemRow
              key={system.from}
              system={system}
              // By the chords it holds, which is what a role is asked of.
              phase={phaseOf(
                roleFor,
                system.placed[0]?.index ?? 0,
                (system.placed.at(-1)?.index ?? 0) + 1,
              )}
              marks={marks}
              pageWidth={pageWidth}
              fifths={fifths}
              beats={beats}
              beatType={beatType}
              final={system.to === measured.length}
              roleFor={roleFor}
              watched={watched}
              here={here}
            />
          ))}
        </svg>
      </div>
    </div>
  )
}

interface RowProps {
  system: {
    readonly from: number
    readonly to: number
    readonly origin: number
    /** Where this line's staves stand. */
    readonly layout: SystemLayout
    /** The line as a whole: every chord, for what is decided once for all its staves. */
    readonly placed: readonly Placed[]
    /** Each pair of staves it has: the same chords, with that pair's notes and beams. */
    readonly pairs: readonly {
      readonly entries: readonly Placed[]
      readonly beaming: ReturnType<typeof beamsIn>
      readonly place: SystemLayout['layers'][number]
    }[]
  }
  phase: Phase
  marks?: BarMarks
  pageWidth: number
  fifths: number
  beats: number
  beatType: number
  final: boolean
  roleFor: (index: number) => Role
  watched: readonly Watched[]
  here: number
}

/**
 * One system of the page.
 *
 * Drawn again only when something it shows has changed. A system the player
 * has finished, or has not reached, is the same picture whichever chord they
 * are on — see `phaseOf` — so where they are is compared only for the system
 * they are in.
 */
const SystemRow = React.memo(
  function SystemRow({
    system,
    marks,
    pageWidth,
    fifths,
    beats,
    beatType,
    final,
    roleFor,
    watched,
    here,
  }: RowProps) {
    const lines = barLinesIn(system.placed, marks)
    const first = system.placed[0]
    const end = pageWidth - PAPER_MARGIN
    // Where the first bar's own marks go: just in front of its first ink.
    const opening = first ? first.x - first.extent.left - STEP * 3 : 0
    return (
      <SystemContext.Provider value={system.layout.staves}>
        <g transform={`translate(0 ${system.origin})`}>
          {system.pairs.map(({ place }, index) => (
            <StaffLayer key={index} place={place}>
              <PaperCards width={pageWidth} />
            </StaffLayer>
          ))}
          <SystemBrace braces={system.layout.braces} />
          {system.pairs.map(({ entries, place }, index) => (
            <StaffLayer key={index} place={place}>
              {/* Each line opens in the clefs its first chord is read in. */}
              <GutterStaves clefs={entries[0]?.clefs} />
              <StaffLines from={GUTTER} to={pageWidth - PAPER_MARGIN} />
              {/* The key is restated on every line, the way printed music does
                it; the metre is stated once and then assumed. */}
              <Signatures
                fifths={fifths}
                beats={beats}
                beatType={beatType}
                withTime={system.from === 0}
                clefs={entries[0]?.clefs}
              />
            </StaffLayer>
          ))}
          {/* Every line of music closes on a bar line, and the last on the final
            one — or on a repeat sign, where the bar it ends on leads back.
            Each after the first says which bar it starts on. */}
          <SystemEnd
            x={end}
            final={final}
            repeat={marks?.get(system.placed.at(-1)?.bar ?? -1)?.repeat?.times !== undefined}
          />
          {first && marks?.get(first.bar)?.repeat?.start && <RepeatSign x={opening} opens />}
          <Voltas voltas={voltasIn(system.placed, lines, marks, opening, end)} />
          {system.from > 0 && (
            <text
              x={STAFF_START}
              y={system.layout.staves[0]! - STEP * 4}
              className="staff__bar-number"
            >
              {system.placed[0]?.bar}
            </text>
          )}
          <BarLines lines={lines} />
          {PLAYHEAD_SHOWN && system.placed.some((entry) => entry.index === here) && (
            <Playhead x={system.placed.find((entry) => entry.index === here)!.x} />
          )}
          {system.pairs.map(({ entries, beaming, place }, index) => (
            <StaffLayer key={index} place={place}>
              <BarRests rests={barRestsIn(entries, lines, opening, end)} />
              <Beams beams={beaming.beams} roleFor={roleFor} />
              {entries.map(
                (entry) =>
                  // A chord with nothing on this pair of staves is not drawn on it.
                  (entry.notes.length > 0 || entry.restsAt || entry.clefChange) && (
                    <StepAt
                      key={entry.index}
                      placed={entry}
                      role={roleFor(entry.index)}
                      fifths={fifths}
                      watched={watched}
                      position={here}
                      stems={beaming.stems.get(entry.index)}
                      opensLine={entry === entries[0]}
                    />
                  ),
              )}
            </StaffLayer>
          ))}
        </g>
      </SystemContext.Provider>
    )
  },
  (before, after) =>
    before.system === after.system &&
    before.marks === after.marks &&
    before.phase === after.phase &&
    before.pageWidth === after.pageWidth &&
    before.fifths === after.fifths &&
    before.beats === after.beats &&
    before.beatType === after.beatType &&
    before.final === after.final &&
    (after.phase !== 'live' ||
      (before.roleFor === after.roleFor &&
        before.watched === after.watched &&
        before.here === after.here)),
)

/** Watched if it is near the playhead, drawn once and left alone if it is not. */
function StepAt({
  placed,
  role,
  fifths,
  watched,
  position,
  stems,
  opensLine,
}: {
  placed: Placed
  role: Role
  fifths: number
  watched: readonly Watched[]
  position: number
  stems?: StepStems
  opensLine: boolean
}) {
  return isLive(role) ? (
    <LiveStep
      placed={placed}
      role={role}
      fifths={fifths}
      watched={watched}
      position={position}
      stems={stems}
      opensLine={opensLine}
    />
  ) : (
    <Step placed={placed} role={role} fifths={fifths} lit="" stems={stems} opensLine={opensLine} />
  )
}
