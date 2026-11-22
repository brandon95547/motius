import { describe, expect, it } from 'vitest'
import { buildLessonExercise } from './lesson-builders.js'
import { LESSON_EXERCISES, lessonExercise, lessonsLoaded, loadLessons } from './lesson-exercise.js'

/**
 * Lessons are content, loaded a section at a time when one of its lessons
 * opens, and then built at once from memory.
 */
describe('loading lessons on demand', () => {
  it('has nothing to build until the section is loaded, then all of it', async () => {
    expect(lessonsLoaded('c-position')).toBe(false)
    expect(lessonExercise('c-position')).toBeNull()

    await loadLessons('c-position')
    // The whole section, not only the one asked for.
    expect(lessonsLoaded('middle-c-position')).toBe(true)
    expect(lessonExercise('c-position')).toEqual(buildLessonExercise('c-position'))
    // Another section is still to come.
    expect(lessonsLoaded('two-black-key-groups')).toBe(false)
  })

  it('fetches a section once, however often it is asked for', async () => {
    const first = loadLessons('notes-a-through-g')
    expect(loadLessons('finding-middle-c')).toBe(first)
    await first
  })

  it('has a module for every written lesson', async () => {
    await Promise.all(LESSON_EXERCISES.map(loadLessons))
    for (const id of LESSON_EXERCISES) expect(lessonExercise(id)).not.toBeNull()
  })
})
