import { useLearningStore, type KeyAnnotation } from '@/state/learning-store'

/**
 * What the keys are marked with — one choice, made here for every part of the
 * keyboard that shows it (the keys, the finger badges, the announcement): a
 * song's markings in Songs, the exercise's everywhere else.
 */
export function useKeyAnnotations(): Readonly<Record<number, KeyAnnotation>> {
  return useLearningStore((state) =>
    state.topic === 'songs' ? state.songAnnotations : state.annotations,
  )
}

/**
 * One key's marking. One subscription per key, to that key's own entry: a note
 * event rebuilds the map but leaves every other entry referentially identical,
 * so only the keys that actually changed re-render.
 */
export function useKeyAnnotation(note: number): KeyAnnotation | undefined {
  return useLearningStore((state) =>
    state.topic === 'songs' ? state.songAnnotations[note] : state.annotations[note],
  )
}
