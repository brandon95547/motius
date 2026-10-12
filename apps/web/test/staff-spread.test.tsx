import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { songSteps, writtenValue } from '@motius/shared'
import { importMusicXml } from '@/features/songs/import-musicxml'
import { frameOf, measureScore, spreadOf } from '@/features/staff/score'
import { BarLines } from '@/features/staff/score-parts'
import { SpreadContext, StaffGutter, STEP, yOn } from '@/features/staff/staff-frame'
import { Chord } from '@/features/staff/StaffNotes'

afterEach(cleanup)

/**
 * The room between the two staves.
 *
 * Each staff is its hand's, so a right hand below middle C hangs under the
 * treble staff and a left hand above it stands over the bass. When both happen
 * in one bar they were drawn through each other: Rachmaninoff's Prelude in
 * C-sharp Minor, whose right hand tolls an octave and a half under middle C
 * while the left hand's chords climb past it, was a thicket. A printed page
 * gives such a line more room between its staves, and now this does.
 */

const note = (step: string, octave: number, staff: number, voice: number) =>
  `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>4</duration><voice>${voice}</voice><type>whole</type><staff>${staff}</staff></note>`
const back = '<backup><duration>4</duration></backup>'

/** Bars of one whole note a hand: each is `[right hand, left hand]`, as `[letter, octave]`. */
const measured = (bars: [[string, number], [string, number]][]) => {
  const song = importMusicXml(
    `<score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">${bars
      .map(
        ([right, left], index) =>
          `<measure number="${index + 1}">${index === 0 ? '<attributes><divisions>1</divisions><staves>2</staves><time><beats>4</beats><beat-type>4</beat-type></time></attributes>' : ''}${note(right[0], right[1], 1, 1)}${back}${note(left[0], left[1], 2, 5)}</measure>`,
      )
      .join('')}</part></score-partwise>`,
    'spread',
  )!
  return measureScore(song, songSteps(song, 'both'))
}

describe('how far a system is opened', () => {
  it('is not opened at all for music that keeps to its staves', () => {
    expect(
      spreadOf(
        measured([
          [
            ['E', 5],
            ['C', 3],
          ],
        ]),
      ),
    ).toBe(0)
    // Nor for a little of each hand between the staves, which the plain
    // distance is there for.
    expect(
      spreadOf(
        measured([
          [
            ['A', 3],
            ['E', 4],
          ],
        ]),
      ),
    ).toBe(0)
  })

  it('opens for a right hand far below middle C over a left hand far above it', () => {
    // C3 on the treble staff, G4 on the bass staff: each a long way into the
    // room between them, in the same bar.
    const crossed = measured([
      [
        ['C', 3],
        ['G', 4],
      ],
    ])
    const spread = spreadOf(crossed)
    expect(spread).toBeGreaterThan(0)
    // Enough that the two are a staff space clear once each has moved.
    const { treble, bass } = crossed[0]!.extent.inner
    expect(treble! - spread + STEP * 2).toBeLessThanOrEqual(bass! + spread)
    // And no more than that takes.
    expect(treble! - (spread - 1) + STEP * 2).toBeGreaterThan(bass! + (spread - 1))
  })

  it('goes by the bar: the same two notes in different bars are in no one’s way', () => {
    expect(
      spreadOf(
        measured([
          [
            ['C', 3],
            ['C', 2],
          ],
          [
            ['E', 5],
            ['G', 4],
          ],
        ]),
      ),
    ).toBe(0)
  })

  it('is one distance for the whole run: the worst bar’s', () => {
    const one = spreadOf(
      measured([
        [
          ['C', 3],
          ['G', 4],
        ],
      ]),
    )
    const run = measured([
      [
        ['E', 5],
        ['C', 3],
      ],
      [
        ['C', 3],
        ['G', 4],
      ],
      [
        ['E', 5],
        ['C', 3],
      ],
    ])
    expect(spreadOf(run)).toBe(one)
  })

  it('makes the frame taller by what it opened', () => {
    const run = measured([
      [
        ['C', 3],
        ['G', 4],
      ],
    ])
    const plain = frameOf(run)
    const opened = frameOf(run, undefined, 30)
    expect(opened.top).toBe(plain.top - 30)
    expect(opened.bottom).toBe(plain.bottom + 30)
  })
})

describe('an opened system, drawn', () => {
  const svg = (spread: number, children: React.ReactNode) =>
    render(
      <SpreadContext.Provider value={spread}>
        <svg>{children}</svg>
      </SpreadContext.Provider>,
    ).container

  const c3 = { note: 48, hand: 'right' as const }
  const g4 = { note: 67, hand: 'left' as const }
  // Four beats at a beat of half a second: a whole note.
  const whole = writtenValue(2000, 500)

  it('carries each staff’s notes with their staff: the treble up, the bass down', () => {
    const moved = [
      ...svg(20, <Chord x={100} notes={[c3, g4]} value={whole} />).querySelectorAll('g[transform]'),
    ]
    expect(moved.map((group) => group.getAttribute('transform'))).toEqual([
      'translate(0 -20)',
      'translate(0 20)',
    ])
  })

  it('draws a plain system exactly as before, with nothing moved', () => {
    const plain = svg(0, <Chord x={100} notes={[c3, g4]} value={whole} />)
    expect(plain.querySelector('g[transform]')).toBeNull()
  })

  it('runs the bar lines and the brace the whole height of the system', () => {
    const lines = svg(20, <BarLines lines={[{ x: 200, bar: 2 }]} />)
    const bar = lines.querySelector('.staff__bar')!
    expect(Number(bar.getAttribute('y1'))).toBe(yOn(10, 'treble') - 20)
    expect(Number(bar.getAttribute('y2'))).toBe(yOn(-10, 'bass') + 20)
    // The bar's number stays over the treble staff.
    expect(Number(lines.querySelector('.staff__bar-number')!.getAttribute('y'))).toBe(
      yOn(14, 'treble') - 20,
    )
    const opening = svg(20, <StaffGutter />).querySelector('.staff__system-line')!
    expect(Number(opening.getAttribute('y1'))).toBe(yOn(10, 'treble') - 20)
    expect(Number(opening.getAttribute('y2'))).toBe(yOn(-10, 'bass') + 20)
  })
})
