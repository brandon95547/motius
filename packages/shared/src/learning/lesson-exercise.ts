import type { NoteRange } from '../domain/device.js'
import type { Hand } from '../music/fingering.js'
import type { Exercise, ExerciseStep } from './exercise.js'
import { DEFAULT_PLAYABLE_RANGE } from './scale-exercise.js'

/**
 * The exercises the lessons play, one per lesson that has one.
 *
 * A lesson is taught as a teacher would teach it at the instrument, and the
 * exercise is what the student's hands do: Explore shows it on the keys, Learn
 * walks through it a step at a time, Practice takes the guidance away and
 * keeps score. Each is built from the keys the player has, like the others.
 */

export const LESSON_EXERCISES = ['two-black-key-groups'] as const
export type LessonExerciseId = (typeof LESSON_EXERCISES)[number]

export interface LessonExerciseOptions {
  /** The keys the player has. A 61-key instrument when left out. */
  readonly range?: NoteRange
}

const MIDDLE_C = 60

/**
 * Every group of two black keys, from the bottom of the keyboard to the top:
 * the left hand up to middle C, then the right hand on from there.
 *
 * As the primer books teach it, before a single note has a name. The groups
 * are the landmarks the white keys are found by, so the student finds every
 * one, with fingers 2 and 3 of one hand pressed together — 3 and 2 in the left
 * hand, which is the same two fingers mirrored. Going up the keyboard is going
 * up in pitch, which is the other thing the walk teaches: low on the left,
 * high on the right, and the hand that plays each half.
 */
function twoBlackKeyGroups(range: NoteRange): Exercise {
  const groups: (readonly [number, number])[] = []
  for (let c = Math.floor(range.low / 12) * 12; c <= range.high; c += 12) {
    const pair = [c + 1, c + 3] as const
    if (pair[0] >= range.low && pair[1] <= range.high) groups.push(pair)
  }
  const handFor = (pair: readonly [number, number]): Hand => (pair[0] < MIDDLE_C ? 'left' : 'right')

  const steps: ExerciseStep[] = groups.map((pair, index) => {
    const hand = handFor(pair)
    const fingers = hand === 'left' ? [3, 2] : [2, 3]
    // Said once, where the hand that plays changes: on the first group of each.
    const first = index === 0 || handFor(groups[index - 1]!) !== hand
    const cue = first
      ? `${hand === 'left' ? 'Left' : 'Right'} hand, fingers ${fingers.join(' and ')}`
      : undefined
    return {
      id: `group-${pair[0]}`,
      notes: pair,
      fingers: fingers.map((finger) => ({ finger, hand })),
      label: 'C♯ + D♯',
      noteLabels: ['C♯', 'D♯'],
      ...(cue && { cue }),
    }
  })
  const hands = (['left', 'right'] as const).filter((hand) =>
    groups.some((pair) => handFor(pair) === hand),
  )

  return {
    id: 'lesson:two-black-key-groups',
    kind: 'exercise',
    title: 'Two-black-key groups',
    subtitle: 'Both hands · low to high',
    steps,
    pitchClasses: [1, 3],
    rootPitchClass: null,
    pitchNames: { 1: 'C♯', 3: 'D♯' },
    notes: steps.flatMap((step) => step.notes),
    // Written with every sharp printed: the lesson is in no key.
    keyFifths: null,
    facts: [{ label: 'Groups', value: String(groups.length) }],
    fingerings: hands.map((hand) => ({
      hand,
      fingers: hand === 'left' ? [3, 2] : [2, 3],
      source: 'derived',
      perStep: 2,
    })),
    defaultBpm: 60,
  }
}

/** The exercise a lesson plays. */
export function buildLessonExercise(
  id: LessonExerciseId,
  options: LessonExerciseOptions = {},
): Exercise {
  const range = options.range ?? DEFAULT_PLAYABLE_RANGE
  switch (id) {
    case 'two-black-key-groups':
      return twoBlackKeyGroups(range)
  }
}
