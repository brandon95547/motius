import { describe, expect, it } from 'vitest'
import { isBlackKey } from '../midi/notes.js'
import { buildLessonExercise } from './lesson-exercise.js'
import { IDLE_SESSION, sessionReducer } from './session.js'

/**
 * The lessons' exercises.
 *
 * Two-black-key groups is taught as the primer books teach it: every group on
 * the keyboard, low to high, with fingers 2 and 3 together — the left hand up
 * to middle C and the right hand from there. What is pinned is that the walk is
 * that and nothing else: no three-black-key group in it, none left out, and the
 * hand changing at middle C.
 */
describe('two-black-key groups', () => {
  const exercise = buildLessonExercise('two-black-key-groups')

  it('finds every group of two black keys on a 61-key keyboard, low to high', () => {
    expect(exercise.steps.map((step) => step.notes)).toEqual([
      [37, 39],
      [49, 51],
      [61, 63],
      [73, 75],
      [85, 87],
    ])
    for (const step of exercise.steps) expect(step.notes.every(isBlackKey)).toBe(true)
  })

  it('plays the groups below middle C with the left hand, 3 and 2, and the rest with the right, 2 and 3', () => {
    const fingering = exercise.steps.map((step) =>
      step.fingers.map((finger) => `${finger.hand[0]}${finger.finger}`).join(' '),
    )
    expect(fingering).toEqual(['l3 l2', 'l3 l2', 'r2 r3', 'r2 r3', 'r2 r3'])
    // Said where the hand changes, and nowhere else.
    expect(exercise.steps.map((step) => step.cue)).toEqual([
      'Left hand, fingers 3 and 2',
      undefined,
      'Right hand, fingers 2 and 3',
      undefined,
      undefined,
    ])
  })

  it('takes every group the keyboard has, and only those wholly on it', () => {
    const all = buildLessonExercise('two-black-key-groups', { range: { low: 21, high: 108 } })
    expect(all.steps.map((step) => step.notes[0])).toEqual([25, 37, 49, 61, 73, 85, 97])
    // A keyboard that starts on D has lost the first group's C♯.
    const cut = buildLessonExercise('two-black-key-groups', { range: { low: 38, high: 96 } })
    expect(cut.steps[0]!.notes).toEqual([49, 51])
  })

  it('is in no key: Explore lights the groups and marks no home note', () => {
    expect(exercise.pitchClasses).toEqual([1, 3])
    expect(exercise.rootPitchClass).toBeNull()
    // And a run of it is counted in groups, not notes.
    expect(exercise.stepsAre).toBe('groups')
  })

  it('takes both keys of a group to move on, and counts a three-black-key group as a mistake', () => {
    let session = sessionReducer(IDLE_SESSION, { type: 'start', at: 0 }, exercise)
    session = sessionReducer(session, { type: 'noteOn', note: 42, at: 1 }, exercise) // F♯
    expect(session.mistakes).toBe(1)
    session = sessionReducer(session, { type: 'noteOn', note: 37, at: 2 }, exercise)
    expect(session.stepIndex).toBe(0)
    session = sessionReducer(session, { type: 'noteOn', note: 39, at: 3 }, exercise)
    expect(session.stepIndex).toBe(1)
  })
})
