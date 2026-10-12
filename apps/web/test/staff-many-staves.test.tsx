import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { songSteps, type Song } from '@motius/shared'
import { importMusicXml } from '@/features/songs/import-musicxml'
import {
  alignLayers,
  breakIntoSystems,
  frameOf,
  layersOf,
  layoutOf,
  measureScore,
  place,
  regionsOf,
  spreadOf,
} from '@/features/staff/score'
import { BarLines, RepeatSign, Voltas } from '@/features/staff/score-parts'
import {
  PaperCards,
  STAFF_BANDS,
  STAFF_HEIGHT,
  StaffLayer,
  StaffLines,
  STEP,
  SystemBrace,
  SystemContext,
} from '@/features/staff/staff-frame'
import { KeySignature, staffOf, TimeSignature } from '@/features/staff/StaffNotes'

afterEach(cleanup)

/**
 * A piano on three staves, or four.
 *
 * Two staves hold most piano music and not all of it. The end of
 * Rachmaninoff's Prelude in C-sharp minor is printed on four, two to a hand:
 * the chords on one and the bell notes under them on another. Motius read such
 * a page and put every note of a hand on that hand's one staff, chords and bell
 * notes through each other. A score now keeps the staves it was written on.
 */

const note = (
  step: string,
  octave: number,
  staff: number,
  voice = (staff - 1) * 4 + 1,
  duration = 4,
) =>
  `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>${duration}</duration><voice>${voice}</voice><type>${duration === 4 ? 'whole' : 'half'}</type><staff>${staff}</staff></note>`
const back = '<backup><duration>4</duration></backup>'
const opening = (clefs: readonly ('G' | 'F')[]) =>
  `<attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><staves>${clefs.length}</staves>${clefs
    .map(
      (sign, index) =>
        `<clef number="${index + 1}"><sign>${sign}</sign><line>${sign === 'G' ? 2 : 4}</line></clef>`,
    )
    .join('')}</attributes>`
const score = (bars: string[]) =>
  importMusicXml(
    `<score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">${bars
      .map((body, index) => `<measure number="${index + 1}">${body}</measure>`)
      .join('')}</part></score-partwise>`,
    'staves',
  )!
/** A bar with a whole note on each of the staves named, top to bottom. */
const bar = (...on: [staff: number, step: string, octave: number][]) =>
  on.map(([staff, step, octave]) => note(step, octave, staff)).join(back)

const FOUR = ['G', 'G', 'F', 'F'] as const
const measuredIn = (song: Song) => {
  const steps = songSteps(song, 'both')
  const pairs = layersOf(song.staves)!
  return {
    steps,
    pairs,
    ...alignLayers(pairs.map((pair) => measureScore(song, steps, undefined, pair))),
  }
}

describe('reading a piano written on more than two staves', () => {
  it('keeps each note on the staff the score put it on, and reads the hand from the staff', () => {
    const song = score([opening(FOUR) + bar([1, 'E', 5], [2, 'C', 4], [3, 'G', 3], [4, 'C', 2])])
    expect(song.staves).toBe(4)
    expect(song.notes.map((each) => [each.note, each.staff, each.hand])).toEqual([
      [36, 4, 'left'],
      [55, 3, 'left'],
      [60, 2, 'right'],
      [76, 1, 'right'],
    ])
  })

  it('says the hand is only a reading on the staves between the top and the bottom', () => {
    // The top staff is the right hand's and the bottom the left's, as on any
    // piano page. Whose the staves between are is a custom, not a statement.
    const four = score([opening(FOUR) + bar([1, 'E', 5], [2, 'C', 4], [3, 'G', 3], [4, 'C', 2])])
    expect(four.notes.map((each) => [each.staff, each.handSuggested ?? false])).toEqual([
      [4, false],
      [3, true],
      [2, true],
      [1, false],
    ])
    expect(four.handsSuggested).toBe(2)
    const three = score([opening(['G', 'G', 'F']) + bar([1, 'E', 5], [2, 'C', 4], [3, 'C', 2])])
    expect(three.notes.map((each) => [each.staff, each.handSuggested ?? false])).toEqual([
      [3, false],
      [2, true],
      [1, false],
    ])
  })

  it('says what clef every staff opens in, and each change with its staff', () => {
    const song = score([
      opening(FOUR) + bar([1, 'E', 5], [2, 'C', 4], [3, 'G', 3], [4, 'C', 2]),
      '<attributes><clef number="3"><sign>G</sign><line>2</line></clef></attributes>' +
        bar([1, 'E', 5], [3, 'G', 4]),
    ])
    expect(song.clefs!.map((each) => [each.staff, each.hand, each.clef, each.startQ])).toEqual([
      [1, 'right', 'treble', 0],
      [2, 'right', 'treble', 0],
      [3, 'left', 'bass', 0],
      [4, 'left', 'bass', 0],
      [3, 'left', 'treble', 4],
    ])
  })

  it('gives the middle staff of three to the hand its clef suggests', () => {
    const chord = bar([1, 'E', 5], [2, 'C', 4], [3, 'C', 2])
    const upper = score([opening(['G', 'G', 'F']) + chord])
    expect(upper.staves).toBe(3)
    expect(upper.notes.find((each) => each.staff === 2)!.hand).toBe('right')
    const lower = score([opening(['G', 'F', 'F']) + chord])
    expect(lower.notes.find((each) => each.staff === 2)!.hand).toBe('left')
    expect(lower.notes.find((each) => each.staff === 1)!.hand).toBe('right')
    expect(lower.notes.find((each) => each.staff === 3)!.hand).toBe('left')
  })

  it('keeps the rests of every staff, each on its own', () => {
    const rest = (staff: number) =>
      `<note><rest measure="yes"/><duration>4</duration><voice>${staff * 4}</voice><staff>${staff}</staff></note>`
    const song = score([opening(FOUR) + note('E', 5, 1) + back + rest(2) + back + rest(3)])
    expect(song.rests!.map((each) => [each.staff, each.hand])).toEqual([
      [2, 'right'],
      [3, 'left'],
    ])
  })

  it('says nothing new about a piano on its usual two', () => {
    const song = score([opening(['G', 'F']) + bar([1, 'E', 5], [2, 'C', 3])])
    expect(song.staves).toBeUndefined()
    expect(song.clefs).toBeUndefined()
    expect(song.notes.every((each) => each.staff === undefined)).toBe(true)
    expect(layersOf(song.staves)).toBeUndefined()
  })
})

describe('the pairs a score’s staves are drawn in', () => {
  it('takes them two at a time from the top, with the odd one last', () => {
    expect(layersOf(4)).toEqual([
      { treble: 1, bass: 2 },
      { treble: 3, bass: 4 },
    ])
    expect(layersOf(3)).toEqual([{ treble: 1, bass: 2 }, { bass: 3 }])
    expect(layersOf(2)).toBeUndefined()
    expect(layersOf(undefined)).toBeUndefined()
  })

  it('measures every chord in each pair, with that pair’s notes on its two staves', () => {
    const song = score([
      opening(FOUR) + bar([1, 'E', 5], [2, 'C', 4], [3, 'G', 3], [4, 'C', 2]),
      // Only the right hand's lower staff plays in the second bar.
      bar([2, 'D', 4]),
    ])
    const { layers, steps } = measuredIn(song)
    expect(layers.map((layer) => layer.length)).toEqual([steps.length, steps.length])
    const rows = (layer: number, at: number) =>
      layers[layer]![at]!.notes.map((each) => [each.note, staffOf(each)])
    expect(rows(0, 0)).toEqual([
      [60, 'bass'],
      [76, 'treble'],
    ])
    expect(rows(1, 0)).toEqual([
      [36, 'bass'],
      [55, 'treble'],
    ])
    // A chord with nothing on a pair is an empty place in it, at the same
    // index, still standing for the whole chord the keys are watched for.
    expect(rows(0, 1)).toEqual([[62, 'bass']])
    expect(rows(1, 1)).toEqual([])
    expect(layers[1]![1]!.step).toBe(steps[1])
  })

  it('reads each staff in its own clef: a second treble staff is still a treble staff', () => {
    const song = score([opening(FOUR) + bar([1, 'E', 5], [2, 'C', 4], [3, 'G', 3], [4, 'C', 2])])
    const { layers } = measuredIn(song)
    // The right hand's lower staff is the lower of its pair, in the treble clef.
    expect(layers[0]![0]!.clefs).toEqual({ treble: 'treble', bass: 'treble' })
    expect(layers[0]![0]!.notes.find((each) => each.note === 60)!.clef).toBe('treble')
    // And the left hand's upper staff the upper of its pair, in the bass.
    expect(layers[1]![0]!.clefs).toEqual({ treble: 'bass', bass: 'bass' })
    expect(layers[1]![0]!.notes.find((each) => each.note === 55)!.clef).toBe('bass')
  })

  it('sets the pairs under one another: every chord at one place down all of them', () => {
    const sharp = (step: string, octave: number, staff: number) =>
      note(step, octave, staff).replace('</step>', '</step><alter>1</alter>')
    const song = score([
      opening(FOUR) + bar([1, 'E', 5], [3, 'G', 3]),
      // A sharp in the left hand's pair wants room the right hand's does not.
      note('E', 5, 1) + back + sharp('F', 3, 3),
    ])
    const { layers, outline } = measuredIn(song)
    expect(layers[0]!.map((entry) => entry.gap)).toEqual(layers[1]!.map((entry) => entry.gap))
    expect(outline.map((entry) => entry.gap)).toEqual(layers[0]!.map((entry) => entry.gap))
    const lone = measureScore(song, songSteps(song, 'both'), undefined, layersOf(4)![0])
    expect(outline[1]!.gap).toBeGreaterThanOrEqual(lone[1]!.gap)
    const start = 200
    expect(place(layers[0]!, start).map((entry) => entry.x)).toEqual(
      place(layers[1]!, start).map((entry) => entry.x),
    )
  })
})

describe('where the staves of a system stand', () => {
  const plain = score([opening(['G', 'F']) + bar([1, 'E', 5], [2, 'C', 3])])
  const two = measureScore(plain, songSteps(plain, 'both'))

  it('leaves a piano’s usual two exactly where they were', () => {
    const layout = layoutOf([two])
    expect(spreadOf(two)).toBe(0)
    expect(layout.layers).toEqual([{ offset: 0, spread: 0, rows: { treble: true, bass: true } }])
    expect(layout.staves).toEqual([STAFF_BANDS.treble.top, STAFF_BANDS.bass.top])
    expect({ top: layout.top, bottom: layout.bottom }).toEqual(frameOf(two))
  })

  it('stands four staves the same distance apart as two, when nothing is in the way', () => {
    const song = score([opening(FOUR) + bar([1, 'E', 5], [2, 'B', 4], [3, 'D', 3], [4, 'C', 3])])
    const { layers } = measuredIn(song)
    const layout = layoutOf(layers)
    const apart = STAFF_BANDS.bass.top - STAFF_BANDS.treble.top
    expect(layout.staves).toEqual([0, 1, 2, 3].map((at) => STAFF_BANDS.treble.top + at * apart))
    expect(layout.layers.map((each) => [each.offset, each.spread])).toEqual([
      [0, 0],
      [apart * 2, 0],
    ])
    // As much room over the top staff and under the bottom one as a system of two has.
    expect(layout.top).toBe(frameOf(two).top)
    expect(layout.bottom - (layout.staves[3]! + STAFF_HEIGHT)).toBe(
      frameOf(two).bottom - STAFF_BANDS.bass.bottom,
    )
  })

  it('opens the room between two staves whose notes meet, and no other', () => {
    const song = score([
      // The second staff far below itself, the third far above: they meet.
      opening(FOUR) + bar([1, 'E', 5], [2, 'C', 3], [3, 'C', 5], [4, 'C', 3]),
    ])
    const { layers } = measuredIn(song)
    const { staves } = layoutOf(layers)
    const apart = STAFF_BANDS.bass.top - STAFF_BANDS.treble.top
    expect(staves[1]! - staves[0]!).toBe(apart)
    expect(staves[2]! - staves[1]!).toBeGreaterThan(apart)
    expect(staves[3]! - staves[2]!).toBe(apart)
  })

  it('opens a pair as it would open alone', () => {
    const song = score([
      // The right hand's two staves reach for each other; the left hand's keep apart.
      opening(FOUR) + bar([1, 'C', 3], [2, 'C', 6], [3, 'D', 3], [4, 'C', 3]),
    ])
    const { layers } = measuredIn(song)
    const layout = layoutOf(layers)
    const spread = spreadOf(layers[0]!)
    expect(spread).toBeGreaterThan(0)
    expect(layout.layers[0]).toMatchObject({ offset: spread, spread })
    expect(layout.staves[1]! - layout.staves[0]!).toBe(
      STAFF_BANDS.bass.top - STAFF_BANDS.treble.top + spread * 2,
    )
  })

  it('closes up over a staff that is left out', () => {
    const song = score([opening(FOUR) + bar([1, 'E', 5], [4, 'C', 3])])
    const { layers } = measuredIn(song)
    const layout = layoutOf(layers, [
      { treble: true, bass: false },
      { treble: false, bass: true },
    ])
    const apart = STAFF_BANDS.bass.top - STAFF_BANDS.treble.top
    // The outer two, as near as a piano's usual two.
    expect(layout.staves).toEqual([STAFF_BANDS.treble.top, STAFF_BANDS.treble.top + apart])
    expect(layout.layers.map((each) => each.offset)).toEqual([0, 0])
    expect({ top: layout.top, bottom: layout.bottom }).toEqual(frameOf(two))
  })
})

describe('the braces of a system', () => {
  const braces = (clefs: readonly ('G' | 'F')[], rows?: Parameters<typeof layoutOf>[1]) => {
    const song = score([
      opening(clefs) + bar(...clefs.map((_, at): [number, string, number] => [at + 1, 'C', 4])),
    ])
    return layoutOf(measuredIn(song).layers, rows).braces
  }

  it('gives each hand’s pair its own, on a page with two staves to a hand', () => {
    const apart = STAFF_BANDS.bass.top - STAFF_BANDS.treble.top
    const top = STAFF_BANDS.treble.top
    expect(braces(FOUR)).toEqual([
      { top, bottom: top + apart + STAFF_HEIGHT },
      { top: top + apart * 2, bottom: top + apart * 3 + STAFF_HEIGHT },
    ])
  })

  it('is one down the whole system for three staves, and for a pair with a staff left out', () => {
    expect(
      braces(
        ['G', 'G', 'F'],
        [
          { treble: true, bass: true },
          { treble: false, bass: true },
        ],
      ),
    ).toBeUndefined()
    expect(
      braces(FOUR, [
        { treble: true, bass: false },
        { treble: false, bass: true },
      ]),
    ).toBeUndefined()
  })

  it('is one for a piano’s usual two staves', () => {
    const song = score([opening(['G', 'F']) + bar([1, 'E', 5], [2, 'C', 3])])
    expect(layoutOf([measureScore(song, songSteps(song, 'both'))]).braces).toBeUndefined()
  })
})

describe('which staves each stretch of a piece is drawn on', () => {
  const outer = bar([1, 'E', 5], [4, 'C', 3])
  const all = bar([1, 'E', 5], [2, 'C', 4], [3, 'G', 3], [4, 'C', 2])
  const regions = (bars: string[]) => {
    const song = score([opening(FOUR) + bars[0]!, ...bars.slice(1)])
    const steps = songSteps(song, 'both')
    return regionsOf(song, steps, layersOf(4)!).map((region) => ({
      bars: [region.from + 1, region.to],
      rows: region.rows
        .map((rows) => `${rows.treble ? 'T' : '-'}${rows.bass ? 'B' : '-'}`)
        .join(' '),
    }))
  }

  it('leaves a staff out through a long silence, and brings it back when it has notes', () => {
    expect(regions([...Array<string>(10).fill(outer), ...Array<string>(4).fill(all)])).toEqual([
      { bars: [1, 10], rows: 'T- -B' },
      { bars: [11, 14], rows: 'TB TB' },
    ])
  })

  it('keeps a staff through a short one: the page does not rearrange itself for a few bars’ rest', () => {
    expect(regions([...Array<string>(4).fill(all), ...Array<string>(5).fill(outer), all])).toEqual([
      { bars: [1, 10], rows: 'TB TB' },
    ])
  })

  it('never draws fewer than two: a hand that rests keeps its staff', () => {
    const top = bar([1, 'E', 5])
    expect(regions([...Array<string>(9).fill(top), ...Array<string>(3).fill(outer)])).toEqual([
      { bars: [1, 12], rows: 'T- -B' },
    ])
  })

  it('reads it from the whole piece, whichever hand is being practised', () => {
    const song = score([
      opening(FOUR) + outer,
      ...Array<string>(9).fill(outer),
      ...Array<string>(4).fill(all),
    ])
    const right = songSteps(song, 'right')
    expect(regionsOf(song, right, layersOf(4)!).map((region) => region.rows)).toEqual([
      [
        { treble: true, bass: false },
        { treble: false, bass: true },
      ],
      [
        { treble: true, bass: true },
        { treble: true, bass: true },
      ],
    ])
  })

  it('shares the bars before a change of staves between the last two lines', () => {
    // Bars of eight quarter-chords, then one bar of a single chord, and then
    // the page goes onto four staves.
    const busy =
      Array.from({ length: 4 }, () => note('E', 5, 1, 1, 1)).join('') + back + note('C', 3, 4)
    const song = score([
      opening(FOUR) + busy,
      busy,
      busy,
      busy,
      outer,
      ...Array<string>(8).fill(all),
    ])
    const { outline } = measuredIn(song)
    const change = outline.findIndex((entry) => entry.bar === 6)
    const fifth = outline.findIndex((entry) => entry.bar === 5)
    // A page just wide enough for the four busy bars, and not for a fifth.
    let width = 400
    while (breakIntoSystems(outline, 0, width, new Set([fifth]))[0]!.to < fifth) width += 2

    const systems = breakIntoSystems(outline, 0, width, new Set([change]))
    const bars = systems
      .filter((system) => system.to <= change)
      .map((system) => [outline[system.from]!.bar, outline[system.to - 1]!.bar])
    // Not four bars and then one alone, with the page about to change: the
    // short bar has company.
    expect(bars).toHaveLength(2)
    expect(bars[1]![1]).toBe(5)
    expect(bars[1]![0]).toBeLessThan(5)
    expect(bars[0]).toEqual([1, bars[1]![0]! - 1])
  })

  it('starts a new line where the staves change, with room left on the old one or not', () => {
    const song = score([
      opening(FOUR) + outer,
      ...Array<string>(9).fill(outer),
      ...Array<string>(4).fill(all),
    ])
    const { outline } = measuredIn(song)
    const wide = 100_000
    expect(breakIntoSystems(outline, 0, wide)).toHaveLength(1)
    expect(
      breakIntoSystems(outline, 0, wide, new Set([10])).map(({ from, to }) => [from, to]),
    ).toEqual([
      [0, 10],
      [10, 14],
    ])
  })
})

describe('a system of several staves, drawn', () => {
  const tops = [-80, 40, 200, 320]
  const system = (children: React.ReactNode) =>
    render(
      <SystemContext.Provider value={tops}>
        <svg>{children}</svg>
      </SystemContext.Provider>,
    ).container

  it('runs the bar lines and the brace from the top staff to the bottom one', () => {
    const lines = system(<BarLines lines={[{ x: 200, bar: 2 }]} />)
    const line = lines.querySelector('.staff__bar')!
    expect(Number(line.getAttribute('y1'))).toBe(-80)
    expect(Number(line.getAttribute('y2'))).toBe(320 + STAFF_HEIGHT)
    expect(Number(lines.querySelector('.staff__bar-number')!.getAttribute('y'))).toBe(
      -80 - STEP * 4,
    )
    const opening = system(<SystemBrace />).querySelector('.staff__system-line')!
    expect(Number(opening.getAttribute('y1'))).toBe(-80)
    expect(Number(opening.getAttribute('y2'))).toBe(320 + STAFF_HEIGHT)
  })

  it('dots a repeat sign on every staff', () => {
    const dots = [...system(<RepeatSign x={300} closes />).querySelectorAll('.staff__dot')]
    expect(dots.map((dot) => Number(dot.getAttribute('cy')))).toEqual(
      tops.flatMap((top) => [top + STEP * 3, top + STEP * 5]),
    )
  })

  it('keeps an ending bracket over the top staff, wherever that is', () => {
    const lifted = render(
      <SystemContext.Provider value={[-130, 90]}>
        <svg>
          <Voltas voltas={[{ from: 100, to: 300, label: '1.', closed: true }]} />
        </svg>
      </SystemContext.Provider>,
    ).container
    expect(lifted.querySelector('g[transform]')!.getAttribute('transform')).toBe('translate(0 -50)')
  })

  it('moves a pair to where it stands, and draws only the staves it has', () => {
    const pair = render(
      <svg>
        <StaffLayer place={{ offset: 240, spread: 0, rows: { treble: false, bass: true } }}>
          <PaperCards width={600} />
          <StaffLines from={120} to={580} />
          <KeySignature x={130} fifths={2} />
          <TimeSignature x={170} beats={4} beatType={4} />
        </StaffLayer>
      </svg>,
    ).container
    expect(pair.querySelector('svg > g')!.getAttribute('transform')).toBe('translate(0 240)')
    expect(pair.querySelectorAll('.staff__paper')).toHaveLength(1)
    expect(pair.querySelectorAll('.staff__line')).toHaveLength(5)
    // Two sharps and two numerals, once: on the one staff there is.
    expect(pair.querySelectorAll('.staff__accidental')).toHaveLength(2)
    expect(pair.querySelectorAll('.staff__time-digit')).toHaveLength(2)
  })

  it('is no group at all for a pair that has not moved: a plain system is drawn as it was', () => {
    const pair = render(
      <svg>
        <StaffLayer place={{ offset: 0, spread: 0, rows: { treble: true, bass: true } }}>
          <StaffLines from={120} to={580} />
        </StaffLayer>
      </svg>,
    ).container
    expect(pair.querySelector('g[transform]')).toBeNull()
    expect(pair.querySelectorAll('.staff__line')).toHaveLength(10)
  })
})
