import { describe, expect, it } from 'vitest'
import { buildLessonExercise } from './lesson-exercise.js'
import { buildScaleExercise, DEFAULT_SCALE_SPEC } from './scale-exercise.js'
import { stepAtBeat, timelineOf, timingOf } from './timeline.js'

/**
 * The timeline falling notes are drawn from: every note at its beat, as long as
 * it is written, with the hand and finger that play it.
 */
describe('an exercise laid out in time', () => {
  it('starts each step where the one before ends', () => {
    const scale = buildScaleExercise(DEFAULT_SCALE_SPEC)
    const { notes, stepStarts } = timelineOf(scale)
    expect(stepStarts).toHaveLength(scale.steps.length + 1)
    expect(stepStarts[0]).toBe(0)
    for (let i = 1; i < stepStarts.length; i++)
      expect(stepStarts[i]! - stepStarts[i - 1]!).toBe(scale.steps[i - 1]!.beats ?? 1)
    expect(notes.every((note) => note.start === stepStarts[note.step])).toBe(true)
  })

  it('keeps both notes of a two-key step together, with their hand and finger', () => {
    const groups = timelineOf(buildLessonExercise('two-black-key-groups'))
    const first = groups.notes.filter((note) => note.step === 0)
    expect(first).toEqual([
      { step: 0, note: 37, start: 0, beats: 1, hand: 'left', finger: 4 },
      { step: 0, note: 39, start: 0, beats: 1, hand: 'left', finger: 3 },
    ])
    expect(groups.stepStarts).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('finds the step at a beat, or the next, and never past the last', () => {
    const groups = timelineOf(buildLessonExercise('two-black-key-groups'))
    expect(stepAtBeat(groups, -3)).toBe(0)
    expect(stepAtBeat(groups, 2)).toBe(2)
    expect(stepAtBeat(groups, 2.4)).toBe(3)
    expect(stepAtBeat(groups, 99)).toBe(4)
  })

  it('calls a step on time within the margin, and early or late past it', () => {
    expect(timingOf(1000, 1000)).toBe('on-time')
    expect(timingOf(1140, 1000)).toBe('on-time')
    expect(timingOf(800, 1000)).toBe('early')
    expect(timingOf(1200, 1000)).toBe('late')
  })
})
