import * as React from 'react'
import { Play } from 'lucide-react'
import type { StepCrossing } from '@motius/shared'
import { IconButton } from '@/ui/Button'

/*
 * A crossing, drawn: a few white keys, the hand over them from above as the
 * finger chart draws hands (`ui/FingerChart.tsx`) — a palm, and fingers 1 to
 * 3 with their numbers on tips in the hand's color — and the finger that
 * crosses moving to its key, again and again. The thumb goes under the palm,
 * drawn beneath it; a finger goes over, lifted above it. A dashed arrow and a
 * ring on the key say the same without the motion.
 *
 * The motion is the lesson, so it is played in script (the Web Animations
 * API), not by the stylesheet's reduced-motion rule. With Reduce Motion on it
 * waits for Play: pressing it is the asking the setting is there for, as
 * choosing a background film is (`StageBackdrop`).
 */

/** One pass of the movement: still, across, landed, gone. */
const DURATION_MS = 3200
const LIFT = { 'thumb-under': -18, 'finger-over': -30 } as const

/** One white key's width, in the drawing's units. */
const KEY = 44
const TIP_Y = 60
const PALM_TOP = 4
const PALM_BOTTOM = 38
const KEYS_TOP = 44
const KEYS_BOTTOM = 106

const centerOf = (key: number) => key * KEY + KEY / 2

export function CrossingAnimation({ crossing }: { crossing: StepCrossing }) {
  const { keys, fingers, finger: mover, to, kind, hand } = crossing
  const width = keys.length * KEY
  const start = fingers.find((each) => each.finger === mover)!.key
  const others = fingers.filter((each) => each.finger !== mover)
  const columns = fingers.map((each) => centerOf(each.key))
  const palmLeft = Math.min(...columns) - 18
  const palmRight = Math.max(...columns) + 18
  const from = centerOf(start)
  const target = centerOf(to)
  // The arrow's bend: up into the palm for the thumb going under, high over
  // the hand for a finger going over.
  const bend = kind === 'thumb-under' ? PALM_BOTTOM - 8 : PALM_TOP - 12
  const under = kind === 'thumb-under'

  const fingerAt = (x: number, number: number) => (
    <>
      <line className="crossing__finger" x1={x} y1={PALM_BOTTOM - 6} x2={x} y2={TIP_Y} />
      <circle className="crossing__tip" cx={x} cy={TIP_Y} r={13} />
      <text className="crossing__number" x={x} y={TIP_Y} fontSize={14}>
        {number}
      </text>
    </>
  )
  const reduced = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const [playing, setPlaying] = React.useState(() => !reduced())
  const moverRef = React.useRef<SVGGElement>(null)
  const dx = target - from
  React.useEffect(() => {
    const element = moverRef.current
    if (!playing || !element || typeof element.animate !== 'function') return
    const at = (x: number, y: number) => `translate(${x}px, ${y}px)`
    const animation = element.animate(
      [
        { transform: at(0, 0), opacity: 0, offset: 0 },
        { transform: at(0, 0), opacity: 1, offset: 0.08 },
        { transform: at(0, 0), opacity: 1, offset: 0.22 },
        { transform: at(dx / 2, LIFT[kind]), opacity: under ? 0.55 : 1, offset: 0.5 },
        { transform: at(dx, 0), opacity: 1, offset: 0.74 },
        { transform: at(dx, 0), opacity: 1, offset: 0.92 },
        { transform: at(dx, 0), opacity: 0, offset: 1 },
      ],
      { duration: DURATION_MS, iterations: Infinity, easing: 'ease-in-out' },
    )
    return () => animation.cancel()
  }, [playing, dx, kind, under])

  const moving = (
    <g ref={moverRef} className="crossing__mover">
      {fingerAt(from, mover)}
    </g>
  )

  return (
    <div className="crossing">
      <svg
        className="crossing__drawing"
        data-hand={hand}
        viewBox={`0 -10 ${width} ${KEYS_BOTTOM + 12}`}
        role="img"
        aria-label={
          under
            ? `The thumb moves under the hand to ${keys[to]}.`
            : `Finger ${mover} moves over the thumb to ${keys[to]}.`
        }
      >
        <defs>
          <marker
            id="crossing-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0 0L10 5L0 10z" className="crossing__arrowhead" />
          </marker>
        </defs>
        {keys.map((letter, index) => (
          <g key={index}>
            <rect
              className="crossing__key"
              data-target={index === to}
              x={index * KEY + 1}
              y={KEYS_TOP}
              width={KEY - 2}
              height={KEYS_BOTTOM - KEYS_TOP}
              rx={4}
            />
            <text
              className="crossing__letter"
              x={centerOf(index)}
              y={KEYS_BOTTOM - 12}
              fontSize={13}
            >
              {letter}
            </text>
          </g>
        ))}
        <path
          className="crossing__path"
          d={`M${from} ${TIP_Y - 14} Q${(from + target) / 2} ${bend} ${target} ${TIP_Y - 14}`}
          markerEnd="url(#crossing-arrow)"
        />
        <circle className="crossing__landing" cx={target} cy={TIP_Y} r={16} />
        {/* Under: the thumb is drawn first, so the palm covers it as it passes. */}
        {under && moving}
        <rect
          className="crossing__palm"
          x={palmLeft}
          y={PALM_TOP}
          width={palmRight - palmLeft}
          height={PALM_BOTTOM - PALM_TOP}
          rx={20}
        />
        {others.map((each) => (
          <g key={each.finger}>{fingerAt(centerOf(each.key), each.finger)}</g>
        ))}
        {!under && moving}
      </svg>
      {!playing && (
        <IconButton
          className="crossing__play"
          label="Play the movement"
          icon={<Play />}
          size="sm"
          variant="outlined"
          onClick={() => setPlaying(true)}
        />
      )}
    </div>
  )
}
