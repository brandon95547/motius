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

  it('plays the whole melody: patterns 1, 2, 1 and 4, four times each', () => {
    const lasts = buildLessonExercise('whole-melody')
      .steps.filter((_, index) => index % 4 === 3)
      .map((step) => step.label)
    expect(lasts).toEqual([...'EEEE', ...'DDDD', ...'EEEE', ...'FFFF'])
  })
})
