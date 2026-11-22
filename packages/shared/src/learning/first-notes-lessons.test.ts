import { describe, expect, it } from 'vitest'
import { buildLessonExercise } from './lesson-builders.js'
import type { LessonExerciseId } from './lesson-exercise.js'

/**
 * First Notes: the patterns a tune is made of, each shown on the keys, then
 * a tune known for it (bars and positions are checked with every song lesson,
 * `hand-position-lessons.test.ts`). What is pinned: the tunes, and that each
 * lesson's exercises are its pattern.
 */
const letters = (id: LessonExerciseId) =>
  buildLessonExercise(id)
    .steps.map((step) => step.label)
    .join('')

/**
 * The moves from key to key, in semitones, inside each of the first `count`
 * phrases: a phrase starts where the last left off, so the move between two is
 * not either one's pattern. A phrase begins at the step that carries its cue.
 */
const moves = (id: LessonExerciseId, count: number) => {
  const phrases: number[][] = []
  for (const step of buildLessonExercise(id).steps) {
    if (step.cue) phrases.push([])
    phrases.at(-1)!.push(step.notes[0]!)
  }
  return phrases
    .slice(0, count)
    .flatMap((notes) => notes.slice(1).map((note, index) => note - notes[index]!))
}

describe('First Notes', () => {
  it('goes up and down in each hand, the left an octave below', () => {
    const exercise = buildLessonExercise('which-way-notes-go')
    expect(letters('which-way-notes-go').slice(0, 10)).toBe('CDEFGGFEDC')
    const left = exercise.steps.filter((step) => step.fingers[0]!.hand === 'left')
    expect(left.map((step) => step.notes[0])).toEqual([48, 50, 52, 53, 55, 55, 53, 52, 50, 48])
    expect(left[0]!.fingers[0]!.finger).toBe(5)
  })

  it('plays Hot Cross Buns after its repeats', () => {
    expect(letters('repeated-notes').endsWith('EDCEDCCCCCDDDDEDC')).toBe(true)
  })

  it('steps by the next key only, before Mary Had a Little Lamb', () => {
    // The exercises: C D C D, E F E F G F E, C up to G and back.
    for (const move of moves('steps', 3)) expect(Math.abs(move)).toBeLessThanOrEqual(2)
    expect(letters('steps').endsWith('EDCDEEEDDDEGGEDCDEEEEDDEDC')).toBe(true)
  })

  it('skips over one key, before Frère Jacques', () => {
    // The exercises: C E C E, D F D F, E G E G, C E G E C.
    for (const move of moves('skips', 4)) expect([3, 4]).toContain(Math.abs(move))
    expect(letters('skips').endsWith('CDECCDECEFGEFG')).toBe(true)
  })

  it('plays Au clair de la lune twice in the right hand, then once in the left', () => {
    const tune = 'CCCDEDCEDDC'
    expect(letters('simple-melodies')).toBe(tune.repeat(3))
    const hands = buildLessonExercise('simple-melodies').steps.map((step) => step.fingers[0]!.hand)
    expect(hands.lastIndexOf('right')).toBe(tune.length * 2 - 1)
  })
})
