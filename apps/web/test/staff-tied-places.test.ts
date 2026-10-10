import { describe, expect, it } from 'vitest'
import { songSteps } from '@sonara/shared'
import { importMusicXml } from '@/features/songs/import-musicxml'
import {
  alignLayers,
  barLinesIn,
  endOf,
  layersOf,
  measureScore,
  place,
} from '@/features/staff/score'
import { watchedIn } from '@/features/staff/score-parts'

/**
 * A tied note written where nothing is struck.
 *
 * A note tied over a bar line has a notehead in the new bar. Where a chord is
 * struck at that moment it is drawn with the chord. Where none is, there was
 * nowhere to draw it: the head and its tie were left out, and a last bar
 * holding nothing but tied notes — the end of Rachmaninoff's Prelude in
 * C-sharp minor — was missing from the page, bar line and all.
 */

const note = (
  step: string,
  octave: number,
  staff: number,
  duration: number,
  tie?: 'start' | 'stop' | 'both',
) =>
  `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>${duration}</duration>${
    tie === 'stop' || tie === 'both' ? '<tie type="stop"/>' : ''
  }${tie === 'start' || tie === 'both' ? '<tie type="start"/>' : ''}<voice>${staff * 4 - 3}</voice><type>${
    duration === 4 ? 'whole' : duration === 2 ? 'half' : 'quarter'
  }</type><staff>${staff}</staff></note>`
const back = (duration = 4) => `<backup><duration>${duration}</duration></backup>`
const score = (bars: string[], staves = 2) =>
  importMusicXml(
    `<score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">${bars
      .map(
        (body, index) =>
          `<measure number="${index + 1}">${
            index === 0
              ? `<attributes><divisions>1</divisions><staves>${staves}</staves><time><beats>4</beats><beat-type>4</beat-type></time>${Array.from(
                  { length: staves },
                  (_, at) =>
                    `<clef number="${at + 1}"><sign>${at < staves / 2 ? 'G' : 'F'}</sign><line>${at < staves / 2 ? 2 : 4}</line></clef>`,
                ).join('')}</attributes>`
              : ''
          }${body}</measure>`,
      )
      .join('')}</part></score-partwise>`,
    'tied',
  )!

describe('a tied note written where nothing is struck', () => {
  // Both hands hold a whole note through the last bar.
  const ending = score([
    note('E', 5, 1, 4, 'start') + back() + note('C', 3, 2, 4, 'start'),
    note('E', 5, 1, 4, 'stop') + back() + note('C', 3, 2, 4, 'stop'),
  ])
  const steps = songSteps(ending, 'both')
  const measured = measureScore(ending, steps)

  it('has a place of its own on the page, though it is not a chord to play', () => {
    // One chord is struck in the whole piece, and two places are written.
    expect(steps).toHaveLength(1)
    expect(measured).toHaveLength(2)
    const [struck, held] = measured
    expect(struck!.index).toBe(0)
    expect(struck!.step).toBe(steps[0])
    // After the first chord and before a second, had there been one.
    expect(held!.index).toBeGreaterThan(0)
    expect(held!.index).toBeLessThan(1)
    expect(held!.step.notes).toEqual([])
    expect(held!.bar).toBe(2)
    expect(held!.notes.map((each) => [each.note, each.held])).toEqual([
      [48, true],
      [76, true],
    ])
  })

  it('is joined to the head before it by a tie', () => {
    const placed = place(measured, 200)
    expect(placed[0]!.tiesOut!.map((tie) => tie.toIndex)).toEqual([
      measured[1]!.index,
      measured[1]!.index,
    ])
    expect(placed[1]!.arcs).toEqual([
      { note: 48, fromX: placed[0]!.x },
      { note: 76, fromX: placed[0]!.x },
    ])
  })

  it('gives the last bar its bar line, and ends the piece after it', () => {
    const placed = place(measured, 200)
    expect(barLinesIn(placed).map((line) => line.bar)).toEqual([2])
    expect(endOf(placed)).toBeGreaterThan(placed[1]!.x)
  })

  it('is not asked of the keys', () => {
    expect(watchedIn(measured, () => true).map((chord) => chord.index)).toEqual([0])
  })

  it('stands with the rest the other hand has at that moment', () => {
    const rest = `<note><rest/><duration>2</duration><voice>1</voice><type>half</type><staff>1</staff></note>`
    const song = score([
      note('E', 5, 1, 4) + back() + note('C', 3, 2, 4, 'start'),
      // The left hand's note is held over; the right hand waits two beats and plays.
      rest + note('D', 5, 1, 2) + back() + note('C', 3, 2, 4, 'stop'),
    ])
    const places = measureScore(song, songSteps(song, 'both'))
    expect(places).toHaveLength(3)
    const held = places[1]!
    expect(held.notes.map((each) => [each.note, each.held])).toEqual([[48, true]])
    expect(held.rests).toEqual([{ staff: 'treble', value: 'half', dots: 0, bar: 2, back: 0 }])
  })

  it('leaves a score with no such moment exactly as it was: every place a chord, in order', () => {
    const song = score([
      note('E', 5, 1, 4, 'start') + back() + note('C', 3, 2, 4),
      note('E', 5, 1, 4, 'stop') + back() + note('D', 3, 2, 4),
    ])
    const all = songSteps(song, 'both')
    const places = measureScore(song, all)
    expect(places.map((entry) => entry.index)).toEqual([0, 1])
    expect(places.map((entry) => entry.step)).toEqual(all)
  })

  it('is the same place in every pair of a score on several staves', () => {
    const song = score(
      [
        note('E', 5, 1, 4) + back() + note('C', 4, 2, 4) + back() + note('C', 2, 4, 4, 'start'),
        // Only the bottom staff has anything in the second bar, and it is tied.
        note('C', 2, 4, 4, 'stop'),
      ],
      4,
    )
    const all = songSteps(song, 'both')
    const { layers, outline } = alignLayers(
      layersOf(song.staves)!.map((pair) => measureScore(song, all, undefined, pair)),
    )
    expect(layers.map((layer) => layer.length)).toEqual([2, 2])
    expect(layers[0]![1]!.index).toBe(layers[1]![1]!.index)
    expect(layers[0]![1]!.notes).toEqual([])
    expect(layers[1]![1]!.notes.map((each) => each.note)).toEqual([36])
    expect(outline[1]!.bar).toBe(2)
  })
})
