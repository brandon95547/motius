import { describe, expect, it } from 'vitest'
import { stepBeats } from './exercise.js'
import { buildLessonExercise } from './lesson-builders.js'
import { LESSON_SECTIONS, type LessonExerciseId } from './lesson-exercise.js'

/**
 * Fingers & Hands: each lesson a song that fits its five-finger position, so
 * the hand never moves (the fingering guide's ground rules 1 and 3; Alfred
 * Level 1 pp. 9, 14, 18, 74). What is pinned: the tune, its fingers, and that
 * its bars add up.
 */
/** Every song lesson: Fingers & Hands', and First Notes', which keep to one position too. */
const IDS: LessonExerciseId[] = [
  ...LESSON_SECTIONS['hand-positions'],
  ...LESSON_SECTIONS['first-notes'],
]

/** Each key as its name (or finger), hand and finger: `Er3`. */
const played = (id: LessonExerciseId) =>
  buildLessonExercise(id)
    .steps.map((step) => `${step.label}${step.fingers[0]!.hand[0]}${step.fingers[0]!.finger}`)
    .join(' ')

describe('every song lesson', () => {
  it.each(IDS)('%s fills whole bars after its pickup', (id) => {
    const exercise = buildLessonExercise(id)
    const beats = exercise.steps.reduce((sum, step) => sum + stepBeats(step), 0)
    expect((beats - (exercise.pickup ?? 0)) % exercise.meter!.beats).toBe(0)
  })

  // Moving the Pattern moves the hand on purpose, a key at a time: each
  // pattern keeps to one position, and the lesson as a whole does not.
  const MOVES: LessonExerciseId[] = ['moving-the-pattern']
  // Five white keys side by side span at most seven semitones.
  const fits = (keys: number[]) => Math.max(...keys) - Math.min(...keys) <= 7

  it.each(IDS.filter((id) => !MOVES.includes(id)))(
    '%s keeps each hand in one five-finger position',
    (id) => {
      for (const hand of ['left', 'right'] as const) {
        const keys = buildLessonExercise(id)
          .steps.filter((step) => step.fingers[0]!.hand === hand)
          .flatMap((step) => step.notes)
        if (keys.length > 0) expect(fits(keys)).toBe(true)
      }
    },
  )

  it.each(MOVES)('%s keeps each pattern in one five-finger position', (id) => {
    const byPhrase = Map.groupBy(buildLessonExercise(id).steps, (step) => step.id.split('-')[0]!)
    expect(byPhrase.size).toBeGreaterThan(1)
    for (const steps of byPhrase.values())
      expect(fits(steps.flatMap((step) => step.notes))).toBe(true)
  })
})

describe('the right hand’s finger numbers: Goin’ Home', () => {
  it('plays the Largo theme from middle C, each key named by its finger', () => {
    expect(played('right-hand-finger-numbers')).toBe(
      [
        '3r3 5r5 5r5 3r3 2r2 1r1 2r2 3r3 5r5 3r3 2r2',
        '3r3 5r5 5r5 3r3 2r2 1r1 2r2 3r3 2r2 1r1 1r1',
      ].join(' '),
    )
  })
})

describe('the left hand’s finger numbers: When the Saints', () => {
  const exercise = buildLessonExercise('left-hand-finger-numbers')

  it('starts on a pickup, little finger on the C below middle C', () => {
    expect(exercise.pickup).toBe(3)
    expect(exercise.steps.slice(0, 4).map((step) => step.notes[0])).toEqual([48, 52, 53, 55])
    expect(played('left-hand-finger-numbers').startsWith('5l5 3l3 2l2 1l1')).toBe(true)
  })

  it('lets go of the long notes for the rest before each "Oh when the"', () => {
    const rests = exercise.steps.filter((step) => step.holds)
    expect(rests.map((step) => [step.label, step.beats, step.holds![0]])).toEqual([
      ['1', 5, 4],
      ['1', 5, 4],
      ['4', 5, 4],
      ['2', 4, 3],
    ])
  })
})

describe('the C position: Ode to Joy', () => {
  it('has the left hand start an octave down, the right answer and carry on, and the left thumb take the low G', () => {
    const steps = buildLessonExercise('c-position').steps
    expect(steps.slice(0, 4).map((step) => step.label + step.fingers[0]!.hand[0])).toEqual([
      'El',
      'El',
      'Fl',
      'Gl',
    ])
    expect(steps[0]!.notes[0]).toBe(52)
    expect(steps.find((step) => step.notes[0] === 55)!.fingers[0]).toEqual({
      finger: 1,
      hand: 'left',
    })
  })
})

describe('the middle C position: Amazing Grace', () => {
  it('shares middle C: the left hand takes the G and A below it, the right thumb middle C', () => {
    const exercise = buildLessonExercise('middle-c-position')
    expect(exercise.meter).toEqual({ beats: 3, beatType: 4 })
    expect(exercise.pickup).toBe(1)
    expect(played('middle-c-position').split(' ').slice(0, 9)).toEqual([
      ...['Gl4', 'Cr1', 'Er3', 'Cr1', 'Er3', 'Dr2', 'Cr1', 'Al3', 'Gl4'],
    ])
  })
})

describe('the songs added beside them', () => {
  it('has Rousseau’s melody as the 1939 recording sings it, in C', () => {
    expect(
      buildLessonExercise('right-hand-rousseau')
        .steps.map((step) => step.label)
        .join(''),
    ).toBe('3321122432155433321231')
  })

  it('splits the middle C songs at middle C: below it the left hand, from it the right', () => {
    for (const id of ['middle-c-train', 'middle-c-yankee-doodle'] as const)
      for (const step of buildLessonExercise(id).steps)
        expect(step.fingers[0]!.hand).toBe(step.notes[0]! < 60 ? 'left' : 'right')
  })

  it('gives each C position song to both hands, the left an octave down', () => {
    for (const id of ['c-position-outshine-the-sun', 'c-position-love-somebody'] as const) {
      const steps = buildLessonExercise(id).steps
      expect(steps.some((step) => step.fingers[0]!.hand === 'left' && step.notes[0]! < 56)).toBe(
        true,
      )
      expect(steps.some((step) => step.fingers[0]!.hand === 'right')).toBe(true)
    }
  })
})

describe('on a small keyboard', () => {
  it('leaves out a key the keyboard does not have', () => {
    const exercise = buildLessonExercise('c-position', { range: { low: 53, high: 96 } })
    expect(exercise.steps.every((step) => step.notes[0]! >= 53)).toBe(true)
  })
})
