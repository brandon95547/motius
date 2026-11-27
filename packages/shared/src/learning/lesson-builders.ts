import type { Exercise } from './exercise.js'
import { FIRST_NOTES_LESSONS } from './first-notes-lessons.js'
import { HAND_POSITION_LESSONS } from './hand-position-lessons.js'
import { INTERVAL_LESSONS } from './interval-lessons.js'
import { KEYBOARD_LAYOUT_LESSONS } from './keyboard-layout-lessons.js'
import type { LessonExerciseId, LessonExerciseOptions } from './lesson-exercise.js'
import { DEFAULT_PLAYABLE_RANGE } from './practice-defaults.js'

/**
 * Every lesson's exercise, built at once with no loading: for tests and for
 * code that is not a page, where the size of a module does not matter. Not
 * exported to the app (`index.ts`), which loads each section when it opens
 * (`loadLessons`).
 */
export function buildLessonExercise(
  id: LessonExerciseId,
  options: LessonExerciseOptions = {},
): Exercise {
  const build = {
    ...KEYBOARD_LAYOUT_LESSONS,
    ...HAND_POSITION_LESSONS,
    ...FIRST_NOTES_LESSONS,
    ...INTERVAL_LESSONS,
  }[id]
  return build(options.range ?? DEFAULT_PLAYABLE_RANGE, options)
}
