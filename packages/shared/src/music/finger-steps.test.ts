import { describe, expect, it } from 'vitest'
import { fingerSteps, type StepHints } from './finger-steps.js'
import { chordCost, holdable, reach } from './hand-model.js'

const grip = (steps: number[][], hand: 'right' | 'left' = 'right', hints: StepHints = {}) =>
  fingerSteps(steps, hand, hints).map((step) => (step ? step.fingers.join('') : null))

describe('holding a chord', () => {
  it('checks every pair of fingers, not just the neighbours', () => {
    // 1-2 and 2-3 can each be comfortable while 1-3 is impossible, which is
    // why the check cannot walk the chord in order and stop there.
    expect(holdable([60, 64, 67], [1, 3, 5], 'right')).toBe(true)
    expect(holdable([60, 72, 84], [1, 3, 5], 'right')).toBe(false)
  })

  it('will not put one finger on two keys', () => {
    expect(holdable([60, 64], [3, 3], 'right')).toBe(false)
  })

  it('reads the left hand upside down', () => {
    // The little finger takes the lowest note, so the same grip is the same
    // shape with the fingers in the other order.
    expect(holdable([48, 52, 55], [5, 3, 1], 'left')).toBe(true)
    expect(holdable([48, 52, 55], [1, 3, 5], 'left')).toBe(false)
  })

  it('charges nothing for a grip that is relaxed at every pair', () => {
    // A C major triad on 1 3 5 stretches nothing; only the little finger costs
    // anything, and that is the weak-finger rule rather than the span.
    expect(chordCost([60, 64, 67], [1, 3, 5], 'right')).toBe(1)
  })
})

/**
 * The published triad fingerings, which the hand model cannot reach on its own.
 *
 * `1 3 5` and `1 2 4` cost a C major triad exactly the same — relaxed at every
 * pair, one weak finger each — so physics leaves the choice open and the book
 * settles it. That is the whole reason for consulting one.
 */
describe('chords the method books print', () => {
  it('fingers a triad by its inversion, in both hands', () => {
    expect(grip([[60, 64, 67]])).toEqual(['135']) // root
    expect(grip([[64, 67, 72]])).toEqual(['125']) // 1st
    expect(grip([[67, 72, 76]])).toEqual(['135']) // 2nd
    expect(grip([[48, 52, 55]], 'left')).toEqual(['531'])
    expect(grip([[52, 55, 60]], 'left')).toEqual(['531'])
    expect(grip([[55, 60, 64]], 'left')).toEqual(['521'])
  })

  it('does not care which triad it is', () => {
    // Page 88 runs major, minor, diminished and augmented on the same root and
    // fingers all four alike.
    const qualities: [string, number, number][] = [
      ['major', 4, 7],
      ['minor', 3, 7],
      ['diminished', 3, 6],
      ['augmented', 4, 8],
    ]
    for (const [name, third, fifth] of qualities) {
      expect(grip([[60, 60 + third, 60 + fifth]]), name).toEqual(['135'])
      expect(grip([[48, 48 + third, 48 + fifth]], 'left'), name).toEqual(['531'])
    }
  })

  it('takes an octave on the thumb and the little finger', () => {
    expect(grip([[60, 72]])).toEqual(['15'])
    expect(grip([[48, 60]], 'left')).toEqual(['51'])
  })
})

describe('a part that is not all chords or all melody', () => {
  it('is the melodic model exactly where every step is one note', () => {
    // The one part of this that was independently validated, kept from
    // drifting: a two-octave C major scale still comes out as the book's.
    const scale = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84]
    expect(grip(scale.map((n) => [n])).join('')).toBe('123123412312345')
  })

  it('threads a melody between chords without breaking the run', () => {
    const mixed = [[60, 64, 67], [69], [71], [60, 64, 67], [72]]
    expect(grip(mixed).every((f) => f !== null)).toBe(true)
  })

  it('fingers a step no hand closes on as one that arrives in pieces, and carries on through it', () => {
    // It used to be left blank. It is still played — leapt, or spread — and a
    // player still wants to know what with.
    const withGap = [[60], [62], [36, 84], [72], [74]]
    const result = fingerSteps(withGap, 'right')
    expect(result.every((step) => step !== null)).toBe(true)
    expect(result[2]).toEqual({ fingers: [1, 5], rolled: true })
    expect(result[1]!.rolled).toBe(false)
  })

  it('moves the hand where the notes leave no fingering that stays in position', () => {
    // Thumb, little finger, and then nothing: the little finger cannot be the
    // lower note of a rising octave. Forbidding the move left the whole
    // stretch unfingered, which is how one bar of broken octaves blanked the
    // nine hundred notes it sat among.
    const octaves = grip([[48], [60], [72], [84], [72], [60], [48]])
    expect(octaves.every((finger) => finger !== null)).toBe(true)
    // The thumb at the bottom of each octave and an outer finger at the top.
    expect(octaves.filter((_, index) => index % 2 === 0)).toEqual(['1', '1', '1', '1'])
    expect(octaves.filter((_, index) => index % 2 === 1).every((f) => f === '4' || f === '5')).toBe(
      true,
    )
    // The left hand takes its octave 5 1 and then jumps for the tune.
    expect(grip([[36], [48], [60], [62], [64], [65], [67]], 'left').join('')).toBe('5154321')
  })

  it('lets go of a bass note to take the chord over it as a chord', () => {
    // A waltz bass. The octave from the low C is in reach of 5 and 1, and
    // nobody plays it so and then crosses over the thumb for the rest.
    const waltz = [[36], [55], [60], [64], [41], [57], [60], [65]]
    expect(grip(waltz, 'left').join('')).toBe('55215321')
  })

  it('lands a leap on the finger that takes the hand least far', () => {
    // Up two octaves to one note and back: the little finger, not the thumb.
    expect(grip([[60], [62], [64], [84], [64], [62], [60]]).join('')).toBe('1235321')
  })

  it('does not move the hand where it could have stayed', () => {
    // Between neighbouring notes a move costs more than any fingering in
    // position, so an ordinary line is fingered exactly as it was before the
    // move was allowed.
    expect(grip([[60], [62], [64], [65], [67], [69], [71], [72]]).join('')).toBe('12312345')
    expect(grip([[60], [62], [64], [65], [67], [65], [64], [62], [60]]).join('')).toBe('123454321')
  })

  it('keeps a repeated note on its finger', () => {
    const fingers = grip([[60], [60], [60], [62], [64]])
    expect(new Set(fingers.slice(0, 3)).size).toBe(1)
  })

  it('never puts one finger on two notes of the same step', () => {
    const chords = [
      [60, 64, 67],
      [62, 65, 69],
      [64, 67, 71],
      [65, 69, 72],
    ]
    for (const step of fingerSteps(chords, 'right')) {
      const fingers = step?.fingers
      expect(fingers).not.toBeNull()
      expect(new Set(fingers!).size).toBe(fingers!.length)
    }
  })
})

describe('chords wider than the hand', () => {
  it('rolls from the outer note rather than refusing', () => {
    // G2 G3 B3 — a bass note a tenth under a grip the hand holds easily. It is
    // ordinary piano writing, a printed edition fingers it without comment, and
    // leaving it blank was the single largest gap in a real import.
    expect(reach([43, 55, 59], [5, 2, 1], 'left')).toBe('rolled')
    expect(grip([[43, 55, 59]], 'left')).toEqual(['521'])
  })

  it('holds what it can hold, and says which is which', () => {
    expect(reach([48, 52, 55], [5, 3, 1], 'left')).toBe('held')
    expect(reach([43, 50, 53, 55, 59], [5, 4, 3, 2, 1], 'left')).toBe('rolled')
  })

  it('fingers a chord no hand holds in the order the hand lies, and says it is spread', () => {
    // A roll is one note struck away from a grip, and this is not that: the
    // grip itself is out of reach. `reach` still says so. It is fingered all
    // the same, with the fingers that leave least beyond reach.
    expect(reach([36, 60, 84], [5, 3, 1], 'left')).toBe('no')
    const [wide] = fingerSteps([[36, 60, 84]], 'left')
    expect(wide!.rolled).toBe(true)
    // Little finger at the bottom, thumb at the top, and one between.
    expect([wide!.fingers[0], wide!.fingers[2]]).toEqual([5, 1])
    expect(new Set(wide!.fingers).size).toBe(3)
    // Two notes a nineteenth apart: the little finger and the thumb.
    expect(fingerSteps([[36, 55]], 'left')).toEqual([{ fingers: [5, 1], rolled: true }])
  })

  it('lays the hand across more keys than it has fingers', () => {
    const [cluster] = fingerSteps([[60, 62, 64, 65, 67, 69]], 'right')
    expect(cluster!.fingers).toEqual([1, 2, 3, 3, 4, 5])
    expect(cluster!.rolled).toBe(true)
  })
})

describe('what the search is told besides the notes', () => {
  const scale = [[60], [62], [64], [65], [67], [69], [71], [72]]

  it('fingers a step as the score prints it, and everything round it to suit', () => {
    // An editor's 1 on G: the thumb passes there, not on F.
    const given = scale.map((_, index) => (index === 4 ? [1 as const] : undefined))
    const fingers = grip(scale, 'right', { given })
    expect(fingers[4]).toBe('1')
    // What leads up to it no longer passes the thumb on F.
    expect(fingers.slice(0, 4).join('')).toBe('1234')
  })

  it('keeps a printed finger on one note of a chord and chooses the others', () => {
    // C E G with the score's 2 on E: 1 2 5 and not the 1 3 5 it would choose.
    const [chord] = fingerSteps([[60, 64, 67]], 'right', { given: [[undefined, 2, undefined]] })
    expect(chord!.fingers[1]).toBe(2)
    expect(new Set(chord!.fingers).size).toBe(3)
  })

  it('keeps what the score prints even where it would never have offered it', () => {
    // Two notes under the thumb, which a held chord's fingers cannot be: the
    // editor's, and it stands.
    const [chord] = fingerSteps([[60, 62, 67]], 'right', { given: [[1, 1, undefined]] })
    expect(chord!.fingers.slice(0, 2)).toEqual([1, 1])
    expect(chord!.fingers[2]).toBeGreaterThan(1)
  })

  it('leans a single note toward the finger a scale gives it', () => {
    // Left hand up G major, by a system that starts it on the 3rd finger.
    const run = [[43], [45], [47], [48], [50], [52], [54], [55]]
    const wanted = [3, 2, 1, 3, 2, 1, 4, 3] as const
    expect(grip(run, 'left').join('')).toBe('54321321')
    expect(grip(run, 'left', { preferred: [...wanted] }).join('')).toBe('32132143')
  })

  it('does not charge an arpeggio fingering as a hand out of position', () => {
    // The thumb under the 3rd finger across a fourth: out of reach by the span
    // table, and what every scale book prints for C major.
    const arpeggio = [[60], [64], [67], [72], [76], [79], [84]]
    const wanted = [undefined, 2, 3, 1, 2, 3, undefined] as const
    expect(grip(arpeggio, 'right', { preferred: [...wanted] }).join('')).toBe('1231235')
  })
})

describe('the seventh chords a cadence uses', () => {
  it('fingers the three-note dominant sevenths the way the source does', () => {
    // Both come out of the cadence pages, and both are fingerings the span
    // table would not have chosen: 1 2 5 is easier than 1 2 4 by every measure
    // in the model, and the source prints 1 2 4 because of where the chord is
    // going.
    expect(grip([[62, 65, 71]])).toEqual(['124']) // D F B — V7 in second position
    expect(grip([[59, 65, 67]])).toEqual(['145']) // B F G — V7 in first position
  })
})
