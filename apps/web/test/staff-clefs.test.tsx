import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { keySignature, songSteps } from '@sonara/shared'
import { importMusicXml } from '@/features/songs/import-musicxml'
import { clefsAt, measureScore, place } from '@/features/staff/score'
import { Step } from '@/features/staff/score-parts'
import { CLEF_CHANGE_WIDTH, STEP, yOn } from '@/features/staff/staff-frame'
import { clefShift, KeySignature, placementOf } from '@/features/staff/StaffNotes'

afterEach(cleanup)

/**
 * A staff in another clef.
 *
 * A right hand that goes down into the bass is written in the bass clef while
 * it is there: Liszt's Nuages gris opens with both staves in it. Sonara drew
 * every right-hand note on a treble staff whatever the page said, and that
 * opening hung four ledger lines under the staff. The clef is now the score's.
 */

const note = (step: string, octave: number, staff: number, voice: number, duration = 4) =>
  `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>${duration}</duration><voice>${voice}</voice><type>${duration === 4 ? 'whole' : 'half'}</type><staff>${staff}</staff></note>`
const clef = (staff: number, sign: 'G' | 'F') =>
  `<attributes><clef number="${staff}"><sign>${sign}</sign><line>${sign === 'G' ? 2 : 4}</line></clef></attributes>`
const back = '<backup><duration>4</duration></backup>'
const opening = (clefs: string, fifths = 0) =>
  `<attributes><divisions>1</divisions><key><fifths>${fifths}</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves>${clefs}</attributes>`
const score = (bars: string[]) =>
  importMusicXml(
    `<score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">${bars
      .map((body, index) => `<measure number="${index + 1}">${body}</measure>`)
      .join('')}</part></score-partwise>`,
    'clefs',
  )!
const USUAL =
  '<clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef>'
const BOTH_BASS =
  '<clef number="1"><sign>F</sign><line>4</line></clef><clef number="2"><sign>F</sign><line>4</line></clef>'

describe('the clefs a score is read in', () => {
  it('says nothing of a score in the usual two throughout', () => {
    const song = score([opening(USUAL) + note('E', 5, 1, 1) + back + note('C', 3, 2, 5)])
    expect(song.clefs).toBeUndefined()
  })

  it('keeps each change, with the staff it is on and when', () => {
    const song = score([
      opening(BOTH_BASS) + note('D', 3, 1, 1) + back + note('C', 2, 2, 5),
      // Half a bar in, the right hand goes back up to the treble.
      note('G', 3, 1, 1, 2) + clef(1, 'G') + note('B', 4, 1, 1, 2) + back + note('C', 2, 2, 5),
    ])
    expect(song.clefs!.map(({ hand, startQ, clef: sign }) => [hand, startQ, sign])).toEqual([
      ['right', 0, 'bass'],
      ['right', 6, 'treble'],
    ])
    expect(clefsAt(song.clefs, 0)).toEqual({ treble: 'bass', bass: 'bass' })
    expect(clefsAt(song.clefs, song.clefs![1]!.startMs)).toEqual({ treble: 'treble', bass: 'bass' })
  })
})

describe('where a note is written under another clef', () => {
  it('is twelve steps up the upper staff in the bass clef, and twelve down the lower in the treble', () => {
    expect(clefShift('treble', 'bass')).toBe(12)
    expect(clefShift('bass', 'treble')).toBe(-12)
    expect(clefShift('treble', 'treble')).toBe(0)
    expect(clefShift('bass', undefined)).toBe(0)

    // D below middle C in the right hand: six steps under middle C, which is
    // four ledger lines under a treble staff — and the middle line of a bass
    // clef's, where the page has it.
    const d3 = { note: 50, hand: 'right' as const }
    expect(placementOf(d3).steps).toBe(-6)
    expect(placementOf({ ...d3, clef: 'bass' }).steps).toBe(6)
    // It is still D3.
    expect(placementOf({ ...d3, clef: 'bass' })).toMatchObject({ letter: 'D', octave: 3 })
  })

  it('tells each note the clef its staff is in, and marks the chord a clef changes at', () => {
    const song = score([
      opening(BOTH_BASS) + note('D', 3, 1, 1) + back + note('C', 2, 2, 5),
      note('G', 3, 1, 1, 2) + clef(1, 'G') + note('B', 4, 1, 1, 2) + back + note('C', 2, 2, 5),
    ])
    const measured = measureScore(song, songSteps(song, 'both'))
    const right = (index: number) => measured[index]!.notes.find((drawn) => drawn.hand === 'right')
    // The piece opens in the bass clef: the notes are read in it, and nothing
    // has changed.
    expect(right(0)!.clef).toBe('bass')
    expect(measured[0]!.clefChange).toBeUndefined()
    expect(right(1)!.clef).toBe('bass')
    // The B is in the treble clef again, which is the upper staff's own.
    expect(right(2)!.clef).toBeUndefined()
    expect(measured[2]!.clefChange).toMatchObject({ treble: 'treble' })
    expect(measured[2]!.clefChange!.bass).toBeUndefined()
    // And the small clef has room of its own in front of the chord.
    expect(measured[2]!.extent.left).toBeGreaterThanOrEqual(CLEF_CHANGE_WIDTH)
    // The left hand was in its own clef all along.
    expect(measured[0]!.notes.find((drawn) => drawn.hand === 'left')!.clef).toBeUndefined()
  })
})

describe('a change of clef, drawn', () => {
  const song = score([
    opening(BOTH_BASS, -2) + note('D', 3, 1, 1) + back + note('C', 2, 2, 5),
    note('G', 3, 1, 1, 2) + clef(1, 'G') + note('B', 4, 1, 1, 2) + back + note('C', 2, 2, 5),
  ])
  const placed = place(measureScore(song, songSteps(song, 'both')), 200)
  const draw = (children: React.ReactNode) => render(<svg>{children}</svg>).container

  it('sets a small clef just in front of the first chord read in it', () => {
    const changed = draw(<Step placed={placed[2]!} role="ahead" fifths={-2} lit="" />)
    const sign = changed.querySelector('.staff__clef-change text')!
    expect(sign).not.toBeNull()
    expect(Number(sign.getAttribute('x'))).toBeLessThan(placed[2]!.x)
    // Not where nothing changed.
    expect(
      draw(<Step placed={placed[1]!} role="ahead" fifths={-2} lit="" />).querySelector(
        '.staff__clef-change',
      ),
    ).toBeNull()
  })

  it('leaves it to the head of the line where the change is the line’s first chord', () => {
    const first = draw(<Step placed={placed[2]!} role="ahead" fifths={-2} lit="" opensLine />)
    expect(first.querySelector('.staff__clef-change')).toBeNull()
  })

  it('writes the key where that clef puts it', () => {
    const ys = (clefs?: { treble: 'treble' | 'bass'; bass: 'treble' | 'bass' }) =>
      [...draw(<KeySignature x={100} fifths={-2} clefs={clefs} />).querySelectorAll('text')].map(
        (sign) => Number(sign.getAttribute('y')),
      )
    const usual = ys()
    const bothBass = ys({ treble: 'bass', bass: 'bass' })
    // The lower staff's flats have not moved; the upper staff's are now the
    // bass clef's, drawn on the upper staff.
    expect(bothBass.slice(2)).toEqual(usual.slice(2))
    expect(bothBass.slice(0, 2)).toEqual(
      keySignature(-2, 'bass').map((mark) => yOn(mark.steps + 12, 'treble') + STEP * 0.9),
    )
    expect(bothBass.slice(0, 2)).not.toEqual(usual.slice(0, 2))
  })
})
