/**
 * The chart behind Finger numbers: both hands as they rest on the keys, seen
 * from above, each fingertip numbered, and the numbers' names beneath. Loaded
 * the first time the button opens it.
 */

const FINGERS = [
  { number: 1, name: 'thumb' },
  { number: 2, name: 'index' },
  { number: 3, name: 'middle' },
  { number: 4, name: 'ring' },
  { number: 5, name: 'little finger' },
] as const

export function FingerChart() {
  return (
    <>
      <div className="finger-numbers__hands">
        <HandDrawing side="left" />
        <HandDrawing side="right" />
      </div>
      <p className="finger-numbers__key">
        {FINGERS.map(({ number, name }) => (
          <span key={number}>
            <strong>{number}</strong> {name}
          </span>
        ))}
      </p>
      <p className="finger-numbers__note">The same numbers on both hands: the thumbs are 1.</p>
    </>
  )
}

/** The drawing's width; the right hand is the left one turned over. */
const WIDTH = 120
/**
 * The left hand's fingers, as it rests on the keys palm down: the little
 * finger on the left, the thumb on the right and lower. Each is where its
 * middle is across, how high its tip reaches, and how it leans.
 */
const LEFT_HAND = [
  { number: 5, x: 26, top: 36, lean: -6 },
  { number: 4, x: 45, top: 18, lean: -2 },
  { number: 3, x: 64, top: 10, lean: 0 },
  { number: 2, x: 83, top: 20, lean: 3 },
  { number: 1, x: 97, top: 56, lean: 30 },
] as const

function HandDrawing({ side }: { side: 'left' | 'right' }) {
  const across = (x: number) => (side === 'left' ? x : WIDTH - x)
  const lean = (degrees: number) => (side === 'left' ? degrees : -degrees)
  return (
    <figure className="finger-numbers__hand">
      <svg viewBox={`0 0 ${WIDTH} 112`} aria-hidden>
        {/* The palm: 16 to 96 across on the left hand, the same turned over. */}
        <rect
          className="finger-numbers__palm"
          x={side === 'left' ? 16 : WIDTH - 96}
          y={60}
          width={80}
          height={48}
          rx={22}
        />
        {LEFT_HAND.map((finger) => {
          const x = across(finger.x)
          const pivotY = finger.number === 1 ? 92 : 74
          const angle = lean(finger.lean)
          // The tip, where the finger's lean takes it; its number stays upright.
          const radians = (angle * Math.PI) / 180
          const reach = pivotY - (finger.top + 10)
          const tipX = x + Math.sin(radians) * reach
          const tipY = pivotY - Math.cos(radians) * reach
          return (
            <g key={finger.number}>
              <rect
                className="finger-numbers__finger"
                x={x - 8}
                y={finger.top}
                width={16}
                height={pivotY - finger.top + 6}
                rx={8}
                transform={`rotate(${angle} ${x} ${pivotY})`}
              />
              <circle className="finger-numbers__tip" cx={tipX} cy={tipY} r={8} />
              {/* 11 of the drawing's units: about 15px as the chart draws it. */}
              <text className="finger-numbers__number" x={tipX} y={tipY} fontSize={11}>
                {finger.number}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption>{side === 'left' ? 'Left hand' : 'Right hand'}</figcaption>
    </figure>
  )
}
