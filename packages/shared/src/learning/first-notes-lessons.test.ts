import { describe, expect, it } from 'vitest'
import { buildLessonExercise } from './lesson-builders.js'

/**
 * First Notes, as it starts: the hands on C, the right thumb on middle C and
 * the left pinky on the C below, each playing the five keys under it, one at
 * a time (bars and positions are checked with every song lesson,
 * `hand-position-lessons.test.ts`).
 */
describe('First Notes', () => {
  it('plays C to G in the right hand from middle C, then in the left from the C below', () => {
    const steps = buildLessonExercise('hands-on-c').steps
    expect(
      steps.map((step) => `${step.fingers[0]!.hand[0]}${step.label}${step.fingers[0]!.finger}`),
    ).toEqual(['rC1', 'rD2', 'rE3', 'rF4', 'rG5', 'lC5', 'lD4', 'lE3', 'lF2', 'lG1'])
    expect(steps.map((step) => step.notes)).toEqual(
      [60, 62, 64, 65, 67, 48, 50, 52, 53, 55].map((note) => [note]),
    )
  })

  it('steps C, D, E and skips C, E, G in the right hand, then skips them in the left', () => {
    const steps = buildLessonExercise('steps-and-skips').steps
    expect(
      steps.map((step) => `${step.fingers[0]!.hand[0]}${step.label}${step.fingers[0]!.finger}`),
    ).toEqual([
      ...['rC1', 'rD2', 'rE3', 'rD2', 'rC1'],
      ...['rC1', 'rE3', 'rG5', 'rE3', 'rC1'],
      ...['lC5', 'lE3', 'lG1', 'lE3', 'lC5'],
    ])
  })

  it('mixes them: up in steps and down in skips, then the opposite, in each hand', () => {
    const steps = buildLessonExercise('mixing-steps-and-skips').steps
    expect(
      steps.map((step) => `${step.fingers[0]!.hand[0]}${step.label}${step.fingers[0]!.finger}`),
    ).toEqual([
      ...['rC1', 'rD2', 'rE3', 'rF4', 'rG5', 'rE3', 'rC1'],
      ...['rC1', 'rE3', 'rG5', 'rF4', 'rE3', 'rD2', 'rC1'],
      ...['lC5', 'lD4', 'lE3', 'lF2', 'lG1', 'lE3', 'lC5'],
      ...['lC5', 'lE3', 'lG1', 'lF2', 'lE3', 'lD4', 'lC5'],
    ])
  })

  it('moves the skips pattern up a key at a time in the right hand, then down in the left', () => {
    const steps = buildLessonExercise('moving-the-pattern').steps
    const played = steps.map(
      (step) => `${step.fingers[0]!.hand[0]}${step.label}${step.fingers[0]!.finger}`,
    )
    expect(played.slice(0, 10)).toEqual([
      ...['rC1', 'rE3', 'rG5', 'rE3', 'rC1'],
      ...['rD1', 'rF3', 'rA5', 'rF3', 'rD1'],
    ])
    expect(played.slice(20, 25)).toEqual(['rG1', 'rB3', 'rD5', 'rB3', 'rG1'])
    expect(played.slice(25, 30)).toEqual(['lG1', 'lE3', 'lC5', 'lE3', 'lG1'])
    expect(played.slice(45)).toEqual(['lC1', 'lA3', 'lF5', 'lA3', 'lC1'])
    // The left hand ends on the F below the C below middle C.
    expect(steps.at(-3)!.notes).toEqual([41])
  })

  it('plays the first song: left C, left G, right C, right E, one key at a time, four times', () => {
    const steps = buildLessonExercise('pattern-1').steps
    const round = ['lC5', 'lG1', 'rC1', 'rE3']
    expect(
      steps.map((step) => `${step.fingers[0]!.hand[0]}${step.label}${step.fingers[0]!.finger}`),
    ).toEqual([...round, ...round, ...round, ...round])
    expect(steps.every((step) => step.notes.length === 1)).toBe(true)
  })

  it.each([
    ['pattern-2', 'rD2'],
    ['pattern-4', 'rF4'],
  ] as const)('plays %s as pattern 1 with a different last key, %s', (id, last) => {
    const steps = buildLessonExercise(id).steps
    const round = ['lC5', 'lG1', 'rC1', last]
    expect(
      steps.map((step) => `${step.fingers[0]!.hand[0]}${step.label}${step.fingers[0]!.finger}`),
    ).toEqual([...round, ...round, ...round, ...round])
  })

  it('plays pattern 1 four times, then pattern 2 four times', () => {
    const steps = buildLessonExercise('patterns-1-and-2').steps
    const one = ['lC5', 'lG1', 'rC1', 'rE3']
    const two = ['lC5', 'lG1', 'rC1', 'rD2']
    expect(
      steps.map((step) => `${step.fingers[0]!.hand[0]}${step.label}${step.fingers[0]!.finger}`),
    ).toEqual([...one, ...one, ...one, ...one, ...two, ...two, ...two, ...two])
  })

  it('plays the whole melody: patterns 1, 2, 1 and 4, twice each', () => {
    const lasts = buildLessonExercise('whole-melody')
      .steps.filter((_, index) => index % 4 === 3)
      .map((step) => step.label)
    expect(lasts).toEqual([...'EE', ...'DD', ...'EE', ...'FF'])
  })
})
