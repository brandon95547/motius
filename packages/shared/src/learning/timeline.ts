import type { Hand } from '../music/fingering.js'
import { playedStepTimes } from '../songs/performance.js'
import { songSteps, type Song } from '../songs/song.js'
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

/**
 * A song laid out the same way, so falling notes draw it as they draw an
 * exercise: in beats of the tempo it is written at, in the order it is played
 * (a repeat where it is heard), one step for each step Learn walks, with each
 * note's hand and finger. Only the keyboard part the player plays: both hands,
 * or one.
 */
export function songTimeline(song: Song, part: 'both' | Hand = 'both'): ExerciseTimeline {
  const beatMs = 60_000 / song.bpm
  const steps = songSteps(song, part)
  const notes: TimedNote[] = []
  const stepStarts: number[] = []
  playedStepTimes(song, steps).forEach((played, step) => {
    stepStarts.push(played.startMs / beatMs)
    for (const note of steps[played.index]!.notes)
      notes.push({
        step,
        note: note.note,
        start: (note.startMs + played.offsetMs) / beatMs,
        beats: note.durationMs / beatMs,
        hand: note.hand,
        ...(note.finger !== undefined && { finger: note.finger }),
      })
  })
  const last = notes.reduce((end, note) => Math.max(end, note.start + note.beats), 0)
  stepStarts.push(Math.max(last, stepStarts[stepStarts.length - 1] ?? 0))
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

/** Practice starts this many beats before the first note is due, so it can be come in on. */
export const LEAD_IN_BEATS = 4

/** A song's Practice lead-in, in milliseconds of the song at its written tempo. */
export const leadInMs = (song: Pick<Song, 'bpm'>) => (LEAD_IN_BEATS * 60_000) / song.bpm

export function timingOf(playedAt: number, dueAt: number): Timing {
  const off = playedAt - dueAt
  return off < -ON_TIME_MS ? 'early' : off > ON_TIME_MS ? 'late' : 'on-time'
}
