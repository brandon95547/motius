import { describe, expect, it } from 'vitest'
import { isBlackKey } from '../midi/notes.js'
import { stepBeats } from './exercise.js'
import {
  buildFingeringExercise,
  DEFAULT_FINGERING_DRILL_SPEC,
  FINGERING_DRILLS,
  FINGERING_DRILL_DESCRIPTIONS,
  FINGERING_DRILL_LABELS,
  fingeringDrillHands,
  type FingeringDrill,
  type FingeringDrillSpec,
} from './fingering-exercise.js'

/**
 * The fingering exercises.
 *
 * Each is one movement of the hand taken out of the music. What is pinned is
 * that the movement is really in it, on the fingers the chosen system puts
 * there — an exercise for passing the thumb that passes it somewhere the scale
 * does not is practice at something else.
 */

const build = (
  drill: FingeringDrill,
  patch: Partial<FingeringDrillSpec> = {},
  fingering: 'traditional' | 'natural' = 'traditional',
) => buildFingeringExercise({ ...DEFAULT_FINGERING_DRILL_SPEC, drill, ...patch }, { fingering })

const fingers = (exercise: ReturnType<typeof build>, count = Infinity) =>
  exercise.steps
    .slice(0, count)
    .map((step) => step.fingers.map((finger) => finger.finger).join(''))
    .join(' ')
const keys = (exercise: ReturnType<typeof build>, count = Infinity) =>
  exercise.steps.slice(0, count).map((step) => step.notes[0]!)

describe('the fingering exercises', () => {
  it('has a name and a line of description for every one', () => {
    for (const drill of FINGERING_DRILLS) {
      expect(FINGERING_DRILL_LABELS[drill]).toBeTruthy()
      expect(FINGERING_DRILL_DESCRIPTIONS[drill]).toBeTruthy()
    }
  })

  it('builds every exercise in every key, for every hand it takes, in whole bars', () => {
    for (const drill of FINGERING_DRILLS)
      for (const mode of ['major', 'minor'] as const)
        for (let rootPitchClass = 0; rootPitchClass < 12; rootPitchClass++)
          for (const hand of fingeringDrillHands(drill))
            for (const system of ['traditional', 'natural'] as const) {
              const exercise = build(drill, { rootPitchClass, mode, hand }, system)
              const where = `${drill} ${rootPitchClass} ${mode} ${hand} ${system}`
              expect(exercise.steps.length, where).toBeGreaterThan(8)
              // Every note has a finger, and it is one a hand has.
              for (const step of exercise.steps) {
                expect(step.fingers).toHaveLength(step.notes.length)
                for (const { finger } of step.fingers) {
                  expect(finger, where).toBeGreaterThanOrEqual(1)
                  expect(finger, where).toBeLessThanOrEqual(5)
                }
              }
              // On the keyboard, and written in whole bars of four.
              for (const note of exercise.notes) {
                expect(note, where).toBeGreaterThanOrEqual(36)
                expect(note, where).toBeLessThanOrEqual(96)
              }
              const beats = exercise.steps.reduce((sum, step) => sum + stepBeats(step), 0)
              expect(Math.abs(beats / 4 - Math.round(beats / 4)), where).toBeLessThan(1e-6)
            }
  })

  it('puts five fingers on five keys, the left hand’s the other way up', () => {
    const right = build('five-finger')
    expect(keys(right, 9)).toEqual([60, 62, 64, 65, 67, 65, 64, 62, 60])
    expect(fingers(right, 9)).toBe('1 2 3 4 5 4 3 2 1')
    expect(fingers(build('five-finger', { hand: 'left' }), 9)).toBe('5 4 3 2 1 2 3 4 5')
    // Both hands together, an octave apart, low hand first.
    const both = build('five-finger', { hand: 'both' })
    expect(both.steps[0]!.notes).toEqual([48, 60])
    expect(both.steps[0]!.fingers.map((finger) => `${finger.hand}${finger.finger}`)).toEqual([
      'left5',
      'right1',
    ])
  })

  describe('passing the thumb', () => {
    it('goes back and forth over each crossing of the key’s own scale', () => {
      // C major, right hand: under the 3rd after E, under the 4th after B.
      const c = build('thumb-under')
      expect(keys(c, 8)).toEqual([60, 62, 64, 65, 67, 65, 64, 62])
      expect(fingers(c, 8)).toBe('1 2 3 1 2 1 3 2')
      expect(c.steps[0]!.cue).toBe('Thumb under the 3rd')
      // The thumb goes under on the way up, and the 3rd comes over on the way down.
      expect(c.steps[3]!.cue).toBe('Thumb under')
      expect(c.steps[6]!.cue).toBe('Cross over')
      // Twice round, a bar to settle on, and then the other crossing.
      expect(stepBeats(c.steps[16]!)).toBe(4)
      expect(c.steps[17]!.cue).toBe('Thumb under the 4th')
      expect(fingers(c).split(' ').slice(17, 25).join(' ')).toBe('2 3 4 1 2 1 4 3')
    })

    it('is the left hand’s crossing in the left hand: a finger over the thumb going up', () => {
      const c = build('thumb-under', { hand: 'left' })
      expect(fingers(c, 8)).toBe('3 2 1 3 2 3 1 2')
      expect(c.steps[0]!.cue).toBe('3rd over the thumb')
    })

    it('passes it where the chosen system does', () => {
      // G major, left hand. The tradition crosses over the thumb on D and G;
      // the natural system on B and E, so that the 4th finger has F♯.
      const g = { rootPitchClass: 7, hand: 'left' } as const
      const overThumbOn = (exercise: ReturnType<typeof build>) =>
        [
          ...new Set(
            exercise.steps
              .filter(
                (step, index) => index > 0 && exercise.steps[index - 1]!.fingers[0]!.finger === 1,
              )
              .filter((step) => step.cue === 'Cross over')
              .map((step) => exercise.steps[exercise.steps.indexOf(step) - 1]!.notes[0]! % 12),
          ),
        ].sort((a, b) => a - b)
      expect(overThumbOn(build('thumb-under', g))).toEqual([2, 7])
      expect(overThumbOn(build('thumb-under', g, 'natural'))).toEqual([4, 11])
    })

    it('never passes the thumb onto a black key', () => {
      for (const system of ['traditional', 'natural'] as const)
        for (const mode of ['major', 'minor'] as const)
          for (let rootPitchClass = 0; rootPitchClass < 12; rootPitchClass++)
            for (const hand of ['right', 'left'] as const) {
              const exercise = build('thumb-under', { rootPitchClass, mode, hand }, system)
              for (const step of exercise.steps)
                if (step.fingers[0]!.finger === 1)
                  expect(isBlackKey(step.notes[0]!), `${rootPitchClass} ${mode} ${hand}`).toBe(
                    false,
                  )
            }
    })

    it('is one hand at a time, whatever was last chosen', () => {
      expect(fingeringDrillHands('thumb-under')).toEqual(['right', 'left'])
      const asked = build('thumb-under', { hand: 'both' })
      expect(asked.subtitle).toContain('Right Hand')
      expect(asked.steps.every((step) => step.notes.length === 1)).toBe(true)
    })
  })

  it('crosses an arpeggio where the system’s arpeggio crosses', () => {
    // C major, right hand, traditionally: 1 2 3, and the thumb under to C.
    const traditional = build('arpeggio-crossing')
    expect(keys(traditional, 6)).toEqual([64, 67, 72, 76, 72, 67])
    expect(fingers(traditional, 6)).toBe('2 3 1 2 1 3')
    expect(traditional.steps[0]!.cue).toBe('Thumb under the 3rd')
    // The natural system has its thumb on E, under the 4th finger on C.
    const natural = build('arpeggio-crossing', {}, 'natural')
    expect(fingers(natural, 6)).toBe('2 4 1 2 1 4')
    expect(natural.steps[0]!.cue).toBe('Thumb under the 4th')
    expect(keys(natural, 3)).toEqual([67, 72, 76])
  })

  it('breaks I, IV and V as the shapes they are held in, and ends on the chord', () => {
    const c = build('broken-chord')
    // C–E–G as 1 3 5: low, high, middle, high.
    expect(keys(c, 4)).toEqual([60, 67, 64, 67])
    expect(fingers(c, 4)).toBe('1 5 3 5')
    // IV with its fifth at the bottom, then V with its third at the bottom: 1 2 5.
    expect(keys(c).slice(8, 12)).toEqual([60, 69, 65, 69])
    expect(keys(c).slice(16, 20)).toEqual([59, 67, 62, 67])
    expect(fingers(c).split(' ').slice(16, 20).join(' ')).toBe('1 5 2 5')
    expect(c.steps.map((step) => step.degree).filter((d, i, all) => d !== all[i - 1])).toEqual([
      'I',
      'IV',
      'V',
      'I',
    ])
    expect(c.steps.at(-1)!.notes).toEqual([60, 64, 67])
    // A minor: i and iv are minor, and V is major, from the harmonic form.
    const a = build('broken-chord', { rootPitchClass: 9, mode: 'minor' })
    expect(a.steps[16]!.notes[0]! % 12).toBe(8)
  })

  it('changes finger on every repeated note, 3 2 1, and calls none of it a crossing', () => {
    const c = build('repeated-notes', { hand: 'left' })
    expect(keys(c, 6)).toEqual([48, 48, 48, 50, 50, 50])
    expect(fingers(c, 6)).toBe('3 2 1 3 2 1')
    expect(c.steps.some((step) => step.cue)).toBe(false)
    expect(c.steps.some((step) => step.fingers.some((finger) => finger.cue))).toBe(false)
  })

  it('carries one figure up the scale and back, no finger passing another', () => {
    const c = build('independence')
    expect(keys(c, 8)).toEqual([60, 64, 65, 67, 69, 67, 65, 64])
    expect(fingers(c, 8)).toBe('1 2 3 4 5 4 3 2')
    // The next bar is the same figure a note higher.
    expect(keys(c).slice(8, 12)).toEqual([62, 65, 67, 69])
    // And it comes home to the tonic it left.
    expect(c.steps.at(-1)!.notes).toEqual([60])
    expect(c.steps.some((step) => step.cue)).toBe(false)
  })

  it('says which key, which hand and whose fingering it is', () => {
    const exercise = build('thumb-under', { rootPitchClass: 9, mode: 'minor' }, 'natural')
    expect(exercise.title).toBe('Passing the Thumb, A Minor')
    expect(exercise.subtitle).toBe('Right Hand · Each crossing of the scale')
    expect(exercise.facts).toContainEqual({ label: 'Fingering', value: 'Natural' })
    expect(exercise.facts).toContainEqual({ label: 'Key', value: 'A Minor (harmonic)' })
    expect(exercise.kind).toBe('exercise')
    // A different exercise under the other system, to anything that keys on it.
    expect(exercise.id).not.toBe(build('thumb-under', { rootPitchClass: 9, mode: 'minor' }).id)
  })
})
