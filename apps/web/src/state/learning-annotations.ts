import {
  isInExercise,
  normalisePitchClass,
  PIANO_HIGHEST_NOTE,
  PIANO_LOWEST_NOTE,
  type Exercise,
  type LearningMode,
  type SessionState,
} from '@motius/shared'
import type { KeyAnnotation } from './learning-types'

/** How many notes ahead carry a finger badge in Learn mode. */
const LOOKAHEAD = 6

export function buildAnnotations(
  exercise: Exercise | null,
  mode: LearningMode,
  session: SessionState,
  demoStepIndex: number | null = null,
): Record<number, KeyAnnotation> {
  const annotations: Record<number, KeyAnnotation> = {}
  if (!exercise) return annotations

  const nameFor = (note: number) => exercise.pitchNames[normalisePitchClass(note)]

  if (mode === 'listen') {
    // Every octave, because "the notes of A minor" is a fact about the whole
    // keyboard, not about the two octaves this exercise happens to walk.
    for (let note = PIANO_LOWEST_NOTE; note <= PIANO_HIGHEST_NOTE; note++) {
      if (!isInExercise(exercise, note)) continue
      annotations[note] = {
        role: normalisePitchClass(note) === exercise.rootPitchClass ? 'root' : 'scale',
        label: nameFor(note),
      }
    }
    return annotations
  }

  if (mode === 'practice') {
    // The guidance goes away. Only your own mistakes come back, and the key a
    // question is measured from, which is part of the question.
    const landmark = exercise.steps[session.stepIndex]?.landmark
    if (landmark !== undefined) annotations[landmark] = { role: 'root', label: nameFor(landmark) }
    for (const note of Object.keys(session.wrongNotes)) {
      annotations[Number(note)] = { role: 'wrong' }
    }
    return annotations
  }

  // Learn: the exercise's own notes, in the octaves it actually walks.
  // The demonstration's playback head stands in for the player's position while
  // it is running, so the same target, finger and cue appear on the same note.
  const here = demoStepIndex ?? session.stepIndex
  exercise.steps.forEach((step, index) => {
    const ahead = index - here
    step.notes.forEach((note, i) => {
      const existing = annotations[note]
      // A note played twice in a scale keeps the annotation of its earliest
      // remaining occurrence, which is the one the player is heading for.
      if (existing && existing.role !== 'scale') return
      annotations[note] = {
        // Notes already played keep the quiet wash and lose their badge. The
        // shape of the scale stays on the keyboard — a keybed that empties out
        // behind you takes away the very thing you are learning to see.
        // Marking the whole walk: played is done, all still to come is upcoming.
        role: exercise.marksProgress
          ? ahead < 0
            ? 'done'
            : ahead === 0
              ? 'target'
              : 'upcoming'
          : ahead < 0
            ? 'scale'
            : ahead === 0
              ? 'target'
              : ahead <= LOOKAHEAD
                ? 'upcoming'
                : 'scale',
        finger: ahead < 0 ? undefined : step.fingers[i]?.finger,
        hand: step.fingers[i]?.hand,
        // The finger's own cue, not the step's: with both hands on a step only
        // one of them is crossing, and the cue belongs on that hand's key.
        cue: ahead === 0 ? step.fingers[i]?.cue : undefined,
        label: step.noteLabels?.[i] ?? step.label,
      }
    })
  })

  // A step any key of a stretch answers: the stretch washed, unless the step
  // is a question, whose answer would show; and the key it is measured from,
  // with what to do.
  const step = exercise.steps[here]
  if (step?.answer && !step.prompt) {
    for (let note = step.answer.from; note <= step.answer.to; note++)
      annotations[note] ??= { role: 'scale' }
  }
  if (step?.landmark !== undefined) {
    annotations[step.landmark] = {
      role: 'root',
      label: nameFor(step.landmark),
      ...(step.cue && { cue: step.cue }),
    }
  }

  for (const note of Object.keys(session.wrongNotes)) {
    annotations[Number(note)] = { role: 'wrong' }
  }

  return describe(annotations, exercise)
}

/**
 * Adds the facts a key can be labelled with, whatever the mode decided.
 *
 * Always, rather than when a toolbar switch is on: these are properties of the
 * note, not of the view, and computing them here keeps the toolbar a rendering
 * decision instead of a reason to rebuild every annotation.
 */
function describe(
  annotations: Record<number, KeyAnnotation>,
  exercise: Exercise,
): Record<number, KeyAnnotation> {
  const groups = exercise.tetrachordGroups

  for (const [key, annotation] of Object.entries(annotations)) {
    const note = Number(key)
    const pitchClass = normalisePitchClass(note)
    const degree = exercise.pitchDegrees?.[pitchClass]
    // The tonic both opens the lower group and closes the upper one. It reads
    // as the start of the scale, so the lower group keeps it.
    const group = groups?.lower.includes(pitchClass)
      ? ('lower' as const)
      : groups?.upper.includes(pitchClass)
        ? ('upper' as const)
        : undefined

    if (degree || group) annotations[note] = { ...annotation, degree, group }
  }

  return annotations
}
