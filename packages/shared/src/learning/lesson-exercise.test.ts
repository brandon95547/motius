import { describe, expect, it } from 'vitest'
import { isBlackKey } from '../midi/notes.js'
import { buildLessonExercise } from './lesson-exercise.js'
import { IDLE_SESSION, sessionReducer } from './session.js'

/**
 * The lessons' exercises.
 *
 * The black-key groups are taught as the fingering guide has them (Verbalis,
 * stage 1): every group on the keyboard pressed as a block, the left hand
 * going up from the bottom to middle C and the right hand coming down from the
 * top to meet it, with the long fingers — LH 4-3 and 4-3-2, RH 3-4 and 2-3-4.
 * What is pinned is that and nothing else: no group of the other kind in it,
 * none left out, and each hand moving only toward the middle.
 */
const fingering = (exercise: ReturnType<typeof buildLessonExercise>) =>
  exercise.steps.map((step) =>
    step.fingers.map((finger) => `${finger.hand[0]}${finger.finger}`).join(' '),
  )

describe('two-black-key groups', () => {
  const exercise = buildLessonExercise('two-black-key-groups')

  it('finds every group of two black keys on a 61-key keyboard: up in the left hand, down in the right', () => {
    expect(exercise.steps.map((step) => step.notes)).toEqual([
      [37, 39],
      [49, 51],
      [85, 87],
      [73, 75],
      [61, 63],
    ])
    for (const step of exercise.steps) expect(step.notes.every(isBlackKey)).toBe(true)
  })

  it('plays them with the guide’s long fingers: left hand 4-3, right hand 3-4', () => {
    expect(fingering(exercise)).toEqual(['l4 l3', 'l4 l3', 'r3 r4', 'r3 r4', 'r3 r4'])
    // Said where the hand changes, and nowhere else.
    expect(exercise.steps.map((step) => step.cue)).toEqual([
      'Left hand, fingers 4-3, going up',
      undefined,
      'Right hand, fingers 3-4, coming down',
      undefined,
      undefined,
    ])
  })

  it('takes every group the keyboard has, and only those wholly on it', () => {
    const all = buildLessonExercise('two-black-key-groups', { range: { low: 21, high: 108 } })
    expect(all.steps.map((step) => step.notes[0])).toEqual([25, 37, 49, 97, 85, 73, 61])
    // A keyboard that starts on D has lost the first group's C♯.
    const cut = buildLessonExercise('two-black-key-groups', { range: { low: 38, high: 96 } })
    expect(cut.steps[0]!.notes).toEqual([49, 51])
  })

  it('is in no key, and a run of it is counted in groups', () => {
    expect(exercise.pitchClasses).toEqual([1, 3])
    expect(exercise.rootPitchClass).toBeNull()
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

describe('three-black-key groups', () => {
  const exercise = buildLessonExercise('three-black-key-groups')

  it('finds every group of three black keys: up in the left hand, down in the right', () => {
    expect(exercise.steps.map((step) => step.notes)).toEqual([
      [42, 44, 46],
      [54, 56, 58],
      [90, 92, 94],
      [78, 80, 82],
      [66, 68, 70],
    ])
    expect(exercise.pitchClasses).toEqual([6, 8, 10])
    expect(exercise.pitchNames).toEqual({ 6: 'F♯', 8: 'G♯', 10: 'A♯' })
  })

  it('plays them with the guide’s long fingers: left hand 4-3-2, right hand 2-3-4', () => {
    expect(fingering(exercise)).toEqual([
      'l4 l3 l2',
      'l4 l3 l2',
      'r2 r3 r4',
      'r2 r3 r4',
      'r2 r3 r4',
    ])
    expect(exercise.steps[0]!.cue).toBe('Left hand, fingers 4-3-2, going up')
    expect(exercise.steps[2]!.cue).toBe('Right hand, fingers 2-3-4, coming down')
  })

  it('takes all three keys to move on, and counts a two-black-key group as a mistake', () => {
    let session = sessionReducer(IDLE_SESSION, { type: 'start', at: 0 }, exercise)
    session = sessionReducer(session, { type: 'noteOn', note: 37, at: 1 }, exercise) // C♯
    expect(session.mistakes).toBe(1)
    for (const [at, note] of [42, 44].entries())
      session = sessionReducer(session, { type: 'noteOn', note, at: at + 2 }, exercise)
    expect(session.stepIndex).toBe(0)
    session = sessionReducer(session, { type: 'noteOn', note: 46, at: 4 }, exercise)
    expect(session.stepIndex).toBe(1)
  })
})
