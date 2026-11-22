import {
  LESSON_BPM,
  accuracy,
  DEFAULT_FINGERING_SYSTEM,
  isFingeringSystemId,
  lessonExercise,
  lessonsLoaded,
  loadLessons,
  loadPracticeBuilder,
  practiceBuilder,
  tempo,
  type Exercise,
  type FingeringSystemId,
  type NoteRange,
  type PracticeKind,
  type SessionState,
} from '@motius/shared'
import type { Chosen, LearningTopic } from './learning-types'

/**
 * The kind of builder a topic's exercise comes from, as it is set now; none
 * for a lesson, which is content (`loadLessons`), or for a topic with none.
 */
function kindOf(topic: LearningTopic, specs: Chosen): PracticeKind | null {
  // One switch, and it is the only place that maps a topic to a builder. A new
  // area is a case here plus a builder in shared (`practice-builders.ts`).
  switch (topic) {
    case 'scales':
      return 'scale'
    case 'chords':
      return 'chord'
    case 'arpeggios':
      return 'arpeggio'
    case 'progressions':
      // The area's own switch: a new type of progression is a case here.
      return specs.progressionType === 'cadences' ? 'progression' : null
    case 'exercises':
      return 'exercise'
    case 'fingering':
      return 'fingering'
    default:
      return null
  }
}

/** Null until its builder, or its lesson's section, has loaded (`loadFor`). */
export function buildExercise(
  topic: LearningTopic,
  specs: Chosen,
  fingering: FingeringSystemId,
  range: NoteRange,
): Exercise | null {
  const options = { fingering, range }
  if (topic === 'lesson') return specs.lesson ? lessonExercise(specs.lesson, options) : null
  switch (kindOf(topic, specs)) {
    case 'scale':
      return practiceBuilder('scale')?.(specs.spec, options) ?? null
    case 'chord':
      return practiceBuilder('chord')?.(specs.chordSpec, options) ?? null
    case 'arpeggio':
      return practiceBuilder('arpeggio')?.(specs.arpeggioSpec, options) ?? null
    case 'progression':
      return practiceBuilder('progression')?.(specs.cadenceSpec, options) ?? null
    case 'exercise':
      return practiceBuilder('exercise')?.(specs.routineSpec, options) ?? null
    case 'fingering':
      return practiceBuilder('fingering')?.(specs.fingeringSpec, options) ?? null
    default:
      return null
  }
}

/**
 * What the exercise as set needs fetched first — its area's builder, or its
 * lesson's section — or null when it can be built now.
 */
export function loadFor(topic: LearningTopic, specs: Chosen): Promise<void> | null {
  if (topic === 'lesson')
    return specs.lesson && !lessonsLoaded(specs.lesson) ? loadLessons(specs.lesson) : null
  const kind = kindOf(topic, specs)
  return kind && !practiceBuilder(kind) ? loadPracticeBuilder(kind) : null
}

export const FINGERING_SYSTEM_KEY = 'motius.fingering.system'

export function loadFingeringSystem(): FingeringSystemId {
  try {
    const stored = window.localStorage.getItem(FINGERING_SYSTEM_KEY)
    // A system this version does not have — saved by a later one — is the default.
    return isFingeringSystemId(stored) ? stored : DEFAULT_FINGERING_SYSTEM
  } catch {
    return DEFAULT_FINGERING_SYSTEM
  }
}

export function clampBpm(bpm: number): number {
  return Math.min(LESSON_BPM.max, Math.max(LESSON_BPM.min, Math.round(bpm)))
}

const AUTO_TEMPO_STEP = 4

export function nextTargetBpm(
  target: number,
  session: SessionState,
  exercise: Exercise | null,
): number {
  const score = accuracy(session)
  const measured = tempo(session, exercise)
  if (score >= 0.95 && measured !== null && measured >= target * 0.95) {
    return clampBpm(target + AUTO_TEMPO_STEP)
  }
  if (score < 0.85) return clampBpm(target - AUTO_TEMPO_STEP)
  return target
}
