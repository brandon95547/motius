import type { Hand } from '../music/fingering.js'
import { stepBeats, type Exercise } from './exercise.js'

/**
 * An exercise laid out in time: every note with when it starts and how long it
 * lasts, in beats from the first step. What falling notes draw, and what a run
 * is timed against.
 *
 * The steps follow one another with no gaps, each as long as it is written
 * (`beats`); a note held past its step (`holds`) lasts as long as it is held.
 */

export interface TimedNote {
  /** Which step it belongs to: the one Learn waits on until it is played. */
  readonly step: number
  readonly note: number
  /** Beats from the first step's start. */
  readonly start: number
  /** Beats it is held. */
  readonly beats: number
  readonly hand?: Hand
  readonly finger?: number
}

export interface ExerciseTimeline {
  readonly notes: readonly TimedNote[]
  /** When each step starts, in beats; one past the last is when the exercise ends. */
  readonly stepStarts: readonly number[]
}

export function timelineOf(exercise: Exercise): ExerciseTimeline {
  const notes: TimedNote[] = []
  const stepStarts: number[] = []
  let at = 0
  exercise.steps.forEach((step, index) => {
    stepStarts.push(at)
    const seen = new Set<number>()
    step.notes.forEach((note, i) => {
      // Two hands on one key is one key going down once.
      if (seen.has(note)) return
      seen.add(note)
      const finger = step.fingers[i]
      notes.push({
        step: index,
        note,
        start: at,
        beats: step.holds?.[i] ?? stepBeats(step),
        ...(finger && { hand: finger.hand, finger: finger.finger }),
      })
    })
    at += stepBeats(step)
  })
  stepStarts.push(at)
  return { notes, stepStarts }
}

/** The step at a beat, or the first one after it; the last if the beat is past the end. */
export function stepAtBeat(timeline: ExerciseTimeline, beat: number): number {
  const { stepStarts } = timeline
  const steps = stepStarts.length - 1
  if (steps < 1) return 0
  const index = stepStarts.findIndex((start) => start >= beat - 1e-6)
  return Math.max(0, Math.min(index < 0 ? steps - 1 : index, steps - 1))
}

/** How a step was played against when it was due. */
export type Timing = 'early' | 'on-time' | 'late'

/**
 * Within this much of the beat, a step is on time: about a semiquaver at 100
 * BPM, the margin a teacher lets pass without comment.
 */
export const ON_TIME_MS = 150

export function timingOf(playedAt: number, dueAt: number): Timing {
  const off = playedAt - dueAt
  return off < -ON_TIME_MS ? 'early' : off > ON_TIME_MS ? 'late' : 'on-time'
}
