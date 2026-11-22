import type { Exercise } from '@motius/shared'
import type { LearningTopic } from '@/state/learning-store'

export const THEORY_TITLES: Record<Exercise['kind'], string> = {
  scale: 'Understand this scale',
  chord: 'Understand these chords',
  arpeggio: 'Understand this arpeggio',
  progression: 'Understand this cadence',
  exercise: 'Understand this routine',
}

/**
 * What the panel is called for an area. Its kind of exercise says, except
 * where two areas share a kind: a fingering exercise is not a routine.
 */
export const theoryTitle = (topic: LearningTopic, kind: Exercise['kind']) =>
  topic === 'fingering' ? 'Understand this exercise' : THEORY_TITLES[kind]
