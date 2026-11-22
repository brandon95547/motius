import * as React from 'react'
import {
  ACCIDENTAL_SIGNS,
  keySignature,
  type Accidental,
  type Staff,
  type StaffPlacement,
  type WrittenValue,
} from '@motius/shared'
import { carried, OnStaff, shiftOf, STEP, useRows, useSpread, yOn } from './staff-frame'
import { clefShift, HEAD_RX, HEAD_RY, layout, REST_HALF, staffOf } from './chord-layout'
import type { DrawnNote, StemOverride, StepStems, TieArc, VoicePart } from './notation'

/**
 * Notes, drawn the way notes are drawn.
 *
 * One renderer for every staff in the app, because a note should not look
 * different depending on which tab you found it in.
 *
 * What makes a notehead read as notation rather than as a dot is mostly the
 * stem: which side it leaves from, which way it goes, and that a chord has one
 * rather than one each. The rest is the difference between a filled head and a
 * hollow one, the flags, and the dot.
 */

/** How far a tie that runs off the end of a line, or arrives from the line before, is drawn. */
const TIE_STUB = STEP * 5

/**
 * A tie: a thin crescent from one notehead to the next, clear of both.
 *
 * Curving away from the stem, the way one is engraved — and, where a staff has
 * two voices, away from the other voice, which is the same side as the stem.
 */
function tiePath(from: number, to: number, y: number, above: boolean): string {
  const side = above ? -1 : 1
  const base = y + side * STEP * 0.95
  const bow = side * Math.min(STEP * 1.5, STEP * 0.7 + (to - from) * 0.05)
  const middle = (from + to) / 2
  return (
    `M ${from} ${base} Q ${middle} ${base + bow * 2} ${to} ${base} ` +
    `Q ${middle} ${base + bow * 2 - side * STEP * 0.42} ${from} ${base} Z`
  )
}

/** One staff's worth of a chord, drawn where `layout` says it goes. */
function StaffGroup({
  x,
  notes,
  value,
  fifths,
  stem,
  direction,
  ties,
  tiesOut,
}: {
  x: number
  notes: readonly DrawnNote[]
  value: WrittenValue
  fifths: number
  stem?: StemOverride
  direction?: 'up' | 'down'
  /** The ties arriving at this step's held notes. */
  ties?: readonly TieArc[]
  /** The notes whose tie runs on to another line. */
  tiesOut?: readonly number[]
}) {
  const box = layout(x, notes, value, fifths, stem, direction)
  if (!box) return null
  const { placed, staff, up, sounding } = box
  // Away from the stem; with two voices, away from the other voice instead.
  const above = direction ? direction === 'up' : !up
  const arcs = placed.flatMap((entry, index) => {
    const cy = yOn(entry.placement.steps, staff)
    const head = box.headX[index]!
    const drawn: string[] = []
    const arriving = entry.held ? ties?.find((tie) => tie.note === entry.note) : undefined
    if (arriving) {
      const to = head - HEAD_RX - STEP * 0.3
      const from = arriving.fromX === null ? to - TIE_STUB : arriving.fromX + HEAD_RX + STEP * 0.3
      if (to - from > STEP) drawn.push(tiePath(from, to, cy, above))
    }
    if (tiesOut?.includes(entry.note)) {
      const from = (value.dotted ? box.dotX + STEP * 0.6 : head + HEAD_RX) + STEP * 0.3
      drawn.push(tiePath(from, from + TIE_STUB, cy, above))
    }
    return drawn
  })

  const top = Math.min(...placed.map((entry) => yOn(entry.placement.steps, staff)))
  const bottom = Math.max(...placed.map((entry) => yOn(entry.placement.steps, staff)))

  return (
    <OnStaff staff={staff}>
      {arcs.map((d) => (
        <path key={d} d={d} className="staff__tie" />
      ))}
      {box.rolled && <Arpeggio x={box.arpeggioX} from={top - HEAD_RY} to={bottom + HEAD_RY} />}
      {[...box.ledgers].map(([steps, line]) => (
        <line
          key={steps}
          x1={line.from}
          y1={yOn(steps, staff)}
          x2={line.to}
          y2={yOn(steps, staff)}
          className="staff__ledger"
          data-sounding={line.sounding ? 'true' : undefined}
        />
      ))}
      {value.stemmed && (
        <line
          x1={box.stemX}
          y1={box.stemStart}
          x2={box.stemX}
          y2={box.stemEnd}
          className="staff__stem"
          data-sounding={sounding ? 'true' : undefined}
        />
      )}
      {/* A beamed note has no flags: the beam is its flags, joined up. */}
      {value.stemmed && value.flags > 0 && !stem && (
        <Flags x={box.stemX} yEnd={box.stemEnd} up={up} count={value.flags} sounding={sounding} />
      )}

      {placed.map((entry, index) => (
        <Head
          key={entry.note}
          x={box.headX[index]!}
          placement={entry.placement}
          value={value}
          accidental={box.signs.get(entry.note) ?? null}
          dotX={box.dotX}
          finger={entry.finger}
          fingerAt={{ x: box.fingerX, y: box.fingerY[index]! }}
          sounding={entry.sounding ?? false}
          held={entry.held ?? false}
        />
      ))}
    </OnStaff>
  )
}

function Head({
  x,
  placement,
  value,
  accidental,
  dotX,
  finger,
  fingerAt,
  sounding,
  held,
}: {
  x: number
  placement: StaffPlacement
  value: WrittenValue
  /** Which sign to print and where its right edge goes, or null for none. */
  accidental: { x: number; sign: Accidental } | null
  dotX: number
  finger?: number
  fingerAt: { x: number; y: number }
  sounding: boolean
  held?: boolean
}) {
  const staff = placement.staff
  const cy = yOn(placement.steps, staff)

  return (
    <g
      className={`staff__note${value.filled ? '' : ' staff__note--hollow'}`}
      data-sounding={sounding ? 'true' : undefined}
      data-held={held ? 'true' : undefined}
    >
      <ellipse cx={x} cy={cy} rx={HEAD_RX} ry={HEAD_RY} transform={`rotate(-18 ${x} ${cy})`} />
      {value.dotted && (
        // In the space beside the note, never on a line: a dot on a line is
        // invisible.
        <circle
          cx={dotX}
          cy={yOn(placement.steps % 2 === 0 ? placement.steps + 1 : placement.steps, staff)}
          r={STEP * 0.42}
          className="staff__dot"
        />
      )}
      {accidental !== null && (
        <text x={accidental.x} y={cy + STEP * 0.9} textAnchor="end" className="staff__accidental">
          {ACCIDENTAL_SIGNS[accidental.sign]}
        </text>
      )}
      {finger !== undefined && (
        <text x={fingerAt.x} y={fingerAt.y} className="staff__finger">
          {finger}
        </text>
      )}
    </g>
  )
}

/**
 * The sign for a chord that is spread rather than struck.
 *
 * A wavy vertical line beside the chord, which is what the notation is and what
 * a reader already knows how to read. Drawn from one wave per staff space so it
 * grows with the chord rather than being stretched to fit it.
 */
function Arpeggio({ x, from, to }: { x: number; from: number; to: number }) {
  const wave = STEP * 2
  const count = Math.max(2, Math.round((to - from) / wave))
  let path = `M ${x} ${from}`
  for (let i = 0; i < count; i++) {
    // Alternating quarter-circles: out one side, back the other.
    const side = i % 2 === 0 ? STEP * 1.1 : -STEP * 1.1
    path += ` q ${side} ${wave / 2} 0 ${wave}`
  }
  return <path d={path} className="staff__arpeggio" />
}

/** Flags, curling away from the notehead and stacking downward. */
function Flags({
  x,
  yEnd,
  up,
  count,
  sounding,
}: {
  x: number
  yEnd: number
  up: boolean
  count: number
  sounding?: boolean
}) {
  const step = up ? STEP * 1.6 : -STEP * 1.6
  const reach = STEP * 2.6
  const drop = up ? STEP * 3.4 : -STEP * 3.4

  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const top = yEnd + i * step
        return (
          <path
            key={i}
            d={`M ${x} ${top} q ${reach} ${drop * 0.35} ${reach * 0.75} ${drop} q ${-reach * 0.2} ${-drop * 0.55} ${-reach * 0.75} ${-drop * 0.85} z`}
            className="staff__flag"
            data-sounding={sounding ? 'true' : undefined}
          />
        )
      })}
    </>
  )
}

/**
 * Everything sounding at one moment, on both staves.
 *
 * Split by staff first, because each has its own middle line and therefore its
 * own stem direction — a chord spanning both hands has two stems, one per
 * staff, which is exactly how it is written.
 */
export function Chord({
  x,
  notes,
  value,
  fifths = 0,
  stems,
  parts,
  ties,
  tiesOut,
}: {
  x: number
  notes: readonly DrawnNote[]
  /**
   * How long these are written as — one value, or one per staff.
   *
   * Per staff matters more than it sounds. The two hands keep their own rhythm:
   * a bar-long chord under a run of quavers is a semibreve under quavers, and
   * making both share the melody's value writes the chord as a crotchet and
   * puts a stem on something that should not have one.
   */
  value: WrittenValue | { readonly treble: WrittenValue; readonly bass: WrittenValue }
  fifths?: number
  /** The stems a beam has decided, for the staves that have one. */
  stems?: StepStems
  /**
   * The step's voices, where a staff has more than one: each drawn as a chord
   * of its own, with its own length and its stem pointing away from the other.
   */
  parts?: readonly VoicePart[]
  /** The ties arriving at this step's held notes, and the notes whose tie runs off the line. */
  ties?: readonly TieArc[]
  tiesOut?: readonly number[]
}) {
  if (parts) {
    return (
      <>
        {parts.map((part, index) => (
          <StaffGroup
            key={index}
            x={x + part.dx}
            notes={part.notes}
            value={part.value}
            fifths={fifths}
            // Each voice has its own beams: the lower voice's are under the
            // staff's second line.
            stem={stems?.[part.stem === 'down' ? (`${part.staff}2` as const) : part.staff]}
            direction={part.stem}
            ties={ties}
            tiesOut={tiesOut}
          />
        ))}
      </>
    )
  }

  const treble = notes.filter((note) => staffOf(note) === 'treble')
  const bass = notes.filter((note) => staffOf(note) === 'bass')
  const per = 'treble' in value ? value : { treble: value, bass: value }

  return (
    <>
      <StaffGroup
        x={x}
        notes={treble}
        value={per.treble}
        fifths={fifths}
        stem={stems?.treble}
        ties={ties}
        tiesOut={tiesOut}
      />
      <StaffGroup
        x={x}
        notes={bass}
        value={per.bass}
        fifths={fifths}
        stem={stems?.bass}
        ties={ties}
        tiesOut={tiesOut}
      />
    </>
  )
}

/**
 * A rest, drawn on its staff at `x`.
 *
 * Drawn rather than set from a music font, like the noteheads: the fonts that
 * carry these glyphs are not on every machine, and a missing rest is a silence
 * the page forgot to mention. A whole rest hangs from the fourth line and a
 * half rest sits on the third, which is the only thing that tells them apart;
 * a rest for a whole bar is the hanging one in every metre.
 */
export function Rest({
  x,
  staff,
  value,
  dots = 0,
}: {
  x: number
  staff: Staff
  value: WrittenValue['value']
  dots?: number
}) {
  const spread = useSpread()
  // The middle line of the staff, and the height of one space.
  const middle = yOn(staff === 'treble' ? 6 : -6, staff)
  const space = STEP * 2
  const dot = (cx: number, cy: number) => (
    <circle cx={cx} cy={cy} r={STEP * 0.42} className="staff__dot" />
  )
  /** One hook of a quaver rest: a dot, and a curl from it to the stem. */
  const hook = (cy: number, key: number) => (
    <g key={key}>
      {dot(x - STEP * 0.55, cy)}
      <path
        d={`M ${x - STEP * 0.55} ${cy + STEP * 0.35} Q ${x + STEP * 0.5} ${cy + STEP * 0.5} ${x + STEP * 1.05} ${cy - STEP * 0.45}`}
        className="staff__rest-line"
      />
    </g>
  )

  let glyph: React.ReactNode
  let dotX = x + REST_HALF + STEP * 0.5
  if (value === 'whole' || value === 'half') {
    // The same block, hanging from one line or sitting on the next.
    const top = value === 'whole' ? middle - space : middle - space / 2
    glyph = (
      <rect
        x={x - REST_HALF}
        y={top}
        width={REST_HALF * 2}
        height={space / 2}
        className="staff__rest"
      />
    )
  } else if (value === 'quarter') {
    // Down the staff in three strokes and a curl back under.
    glyph = (
      <path
        d={
          `M ${x - STEP * 0.5} ${middle - space * 1.45} L ${x + STEP * 0.7} ${middle - space * 0.6} ` +
          `L ${x - STEP * 0.7} ${middle + space * 0.15} L ${x + STEP * 0.6} ${middle + space * 0.8} ` +
          `Q ${x - STEP * 1.5} ${middle + space * 0.55} ${x - STEP * 0.1} ${middle + space * 1.45}`
        }
        className="staff__rest-line staff__rest-line--heavy"
      />
    )
    dotX = x + STEP * 1.4
  } else {
    // A quaver rest and its shorter kin: a stem leaning back, with a hook for
    // every flag the note of that length would carry.
    const hooks = value === 'eighth' ? 1 : value === 'sixteenth' ? 2 : 3
    const top = middle - space * (hooks > 2 ? 1 : 0.5)
    glyph = (
      <>
        <path
          d={`M ${x + STEP * 1.05} ${top - STEP * 0.45} L ${x - STEP * 0.2} ${top + space * (hooks + 0.6)}`}
          className="staff__rest-line"
        />
        {Array.from({ length: hooks }, (_, index) => hook(top + index * space, index))}
      </>
    )
    dotX = x + STEP * 1.9
  }

  return (
    <g className="staff__rest-mark" transform={carried(staff, spread)}>
      {glyph}
      {Array.from({ length: dots }, (_, index) => (
        <React.Fragment key={index}>{dot(dotX + index * STEP, middle - space / 2)}</React.Fragment>
      ))}
    </g>
  )
}

/** The key signature, drawn once after the clefs. */
export function KeySignature({
  x,
  fifths,
  clefs,
}: {
  x: number
  fifths: number
  /** The clef each staff is in here, where it is not the staff's own. */
  clefs?: Partial<Record<Staff, Staff>>
}) {
  const spread = useSpread()
  const rows = useRows()
  if (fifths === 0) return null
  const spacing = STEP * 2.4

  return (
    <g className="staff__key">
      {(['treble', 'bass'] as const)
        .filter((staff) => rows[staff])
        .flatMap((staff) =>
          // The signs go where that clef puts them, on whichever staff it is on.
          keySignature(fifths, clefs?.[staff] ?? staff).map((mark, index) => (
            <text
              key={`${staff}-${index}`}
              x={x + index * spacing}
              y={
                yOn(mark.steps + clefShift(staff, clefs?.[staff]), staff) +
                STEP * 0.9 +
                shiftOf(staff, spread)
              }
              className="staff__accidental"
            >
              {mark.sign}
            </text>
          )),
        )}
    </g>
  )
}

/**
 * The time signature, after the key.
 *
 * Two digits stacked, on both staves, with no line between them — that is how
 * it is engraved, and a slash would read as a fraction rather than a metre.
 * Both numerals come from the score. Deriving them from `beatsPerMeasure`, as
 * this used to, counts the bar in crotchets and prints the result: a bar of 7/8
 * is three and a half of them, and `3.5/4` is a metre nothing has been written
 * in.
 */
export function TimeSignature({
  x,
  beats,
  beatType,
}: {
  x: number
  beats: number
  beatType: number
}) {
  const spread = useSpread()
  const rows = useRows()
  if (!(beats > 0) || !(beatType > 0)) return null

  return (
    <g className="staff__time">
      {(['treble', 'bass'] as const)
        .filter((staff) => rows[staff])
        .map((staff) => {
          const middle = staff === 'treble' ? 6 : -6
          return (
            <g key={staff} transform={carried(staff, spread)}>
              {/* Two numerals, each filling half the staff: the upper one across
                the top two spaces and the lower across the bottom two. No line
                between them — a slash reads as a fraction, not as a metre. */}
              <text x={x} y={yOn(middle + 2, staff) + STEP * 1.5} className="staff__time-digit">
                {beats}
              </text>
              <text x={x} y={yOn(middle - 2, staff) + STEP * 1.5} className="staff__time-digit">
                {beatType}
              </text>
            </g>
          )
        })}
    </g>
  )
}
