import { ON_TIME_MS, timingOf, type Timing } from './timeline.js'

/**
 * Practising a song: it plays on at its tempo whatever you play, and each step
 * of the part you play is judged against its beat, as an exercise's Practice
 * judges it — on time, early or late, or missed if it goes by unplayed.
 *
 * A pure reducer over key presses and the clock, like the exercise's engine
 * (`session.ts`), so the judging can be tested without a song playing. The
 * steps are taken in order: the step being asked for is the next one not yet
 * judged, and a key that is not one of its notes counts for nothing.
 *
 * Times are the performance's, in milliseconds of the song at its written
 * tempo; `scale` is the tempo it is being played at, as a share of that, so
 * that "on time" is the same 150 ms of the player's time at any speed.
 */

/** A step to be played: its notes, and when it is due. */
export interface PracticeStep {
  readonly notes: readonly number[]
  readonly startMs: number
}

export type StepResult = Timing | 'missed'

export interface SongPracticeState {
  /** The step being asked for: the first not yet judged. */
  readonly step: number
  /** Its notes played so far. A chord is played when all of them have been. */
  readonly reached: readonly number[]
  /** How each step went, in order. */
  readonly results: readonly StepResult[]
}

export const PRACTICE_START: SongPracticeState = { step: 0, reached: [], results: [] }

/** A key played at `atMs`: a note of the step asked for counts towards it. */
export function practiceNoteOn(
  state: SongPracticeState,
  steps: readonly PracticeStep[],
  note: number,
  atMs: number,
  scale = 1,
): SongPracticeState {
  const step = steps[state.step]
  if (!step || !step.notes.includes(note) || state.reached.includes(note)) return state
  const reached = [...state.reached, note]
  if (!step.notes.every((each) => reached.includes(each))) return { ...state, reached }
  // Judged when the step is complete, as an exercise's is: a chord is on time
  // when it is all down on time.
  const timing = timingOf(atMs / scale, step.startMs / scale)
  return { step: state.step + 1, reached: [], results: [...state.results, timing] }
}

/**
 * The music has got to `atMs`. A step is missed once the next one is due, and
 * a margin more, and it is still unplayed: every such step at once, so a late
 * look does not leave the run catching up a step at a time.
 */
export function practiceAt(
  state: SongPracticeState,
  steps: readonly PracticeStep[],
  atMs: number,
  scale = 1,
): SongPracticeState {
  let { step, reached } = state
  const results = [...state.results]
  for (; step < steps.length; step++) {
    const next = steps[step + 1]?.startMs ?? Number.POSITIVE_INFINITY
    if (atMs <= next + ON_TIME_MS * scale) break
    results.push('missed')
    reached = []
  }
  return step === state.step ? state : { step, reached, results }
}

/** How a run went, counted. Steps never reached are missed. */
export function practiceSummary(results: readonly StepResult[], total = results.length) {
  const count = (result: StepResult) => results.filter((each) => each === result).length
  const played = results.length - count('missed')
  return {
    total,
    onTime: count('on-time'),
    early: count('early'),
    late: count('late'),
    missed: total - played,
    /** The share of the steps played at all. */
    accuracy: total === 0 ? 0 : played / total,
  }
}
