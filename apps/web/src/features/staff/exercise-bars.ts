import { stepBeats, type Exercise, type SongMeasure, type SongRest } from '@motius/shared'

/*
 * An exercise's bars and rests, for the staff, where it states a metre: what a
 * score read from a file has already, worked out from the steps.
 *
 * A song in a lesson starts on a pickup — "Oh when the | saints" — and stops
 * between phrases. The pickup is the exercise's own (`pickup`, in beats); a
 * rest is wherever every note of a step is let go before the next is due,
 * which the steps already say (`holds` shorter than the step).
 */

/** The bars, from the pickup if there is one, until every beat is in one. */
export function exerciseMeasures(exercise: Exercise, beatMs: number): SongMeasure[] {
  const meter = exercise.meter
  if (!meter) return []
  const total = exercise.steps.reduce((sum, step) => sum + stepBeats(step), 0)
  const quarters = (meter.beats * 4) / meter.beatType
  const measures: SongMeasure[] = []
  let start = 0
  for (let length = exercise.pickup || quarters; start < total; length = quarters) {
    measures.push({
      startMs: start * beatMs,
      durationMs: length * beatMs,
      startQ: start,
      durationQ: length,
      beats: meter.beats,
      beatType: meter.beatType,
      quarterMs: beatMs,
      // A pickup is bar 0, as a printed score numbers it.
      number: measures.length + (exercise.pickup ? 0 : 1),
    })
    start += length
  }
  return measures
}

/** The silences: after each step whose notes all end before the next one is due. */
export function exerciseRests(exercise: Exercise, beatMs: number): SongRest[] {
  const rests: SongRest[] = []
  let at = 0
  for (const step of exercise.steps) {
    const beats = stepBeats(step)
    const sounds = Math.max(...step.notes.map((_, i) => step.holds?.[i] ?? beats))
    if (sounds < beats - 1e-6)
      rests.push({
        startQ: at + sounds,
        startMs: (at + sounds) * beatMs,
        durationQ: beats - sounds,
        hand: step.fingers[0]?.hand ?? 'right',
      })
    at += beats
  }
  return rests
}
