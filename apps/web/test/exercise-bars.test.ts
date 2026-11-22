import { describe, expect, it } from 'vitest'
import { lessonExercise } from '@motius/shared'
import { exerciseMeasures, exerciseRests } from '@/features/staff/exercise-bars'

/**
 * A song in a lesson is written with its pickup bar and its rests, as a score
 * read from a file would be.
 */
describe('an exercise’s bars and rests', () => {
  // Built in each test: the lessons are loaded before the tests run, not before they are collected.
  const saints = () => lessonExercise('left-hand-finger-numbers')!

  it('opens on a short pickup bar, numbered 0, then full bars', () => {
    const measures = exerciseMeasures(saints(), 500)
    expect(measures[0]).toMatchObject({ startQ: 0, durationQ: 3, number: 0 })
    expect(measures[1]).toMatchObject({ startQ: 3, durationQ: 4, number: 1 })
    expect(measures.at(-1)!.startQ + measures.at(-1)!.durationQ).toBe(63)
  })

  it('writes a rest where a note is let go before the next is due', () => {
    const rests = exerciseRests(saints(), 500)
    // After the first "saints": the pickup, then the held G, then a beat's rest.
    expect(rests[0]).toMatchObject({ startQ: 7, durationQ: 1, hand: 'left' })
    expect(rests).toHaveLength(4)
  })

  it('has none for an exercise that states no metre', () => {
    const plain = lessonExercise('moving-left-and-right')!
    expect(exerciseMeasures(plain, 500)).toEqual([])
    expect(exerciseRests(plain, 500)).toEqual([])
  })
})
