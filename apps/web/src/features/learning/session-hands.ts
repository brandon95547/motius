import type { Exercise, ExerciseStep, Hand } from '@motius/shared'

export const HAND_NAMES: Record<Hand, string> = { left: 'Left hand', right: 'Right hand' }

/**
 * The fingers due on a step, grouped by the hand that plays them — left first,
 * the way the hands sit on the keys.
 *
 * Read from the step rather than from a setting, so one hand, both hands, and
 * a chord split across them all come out of the same few lines.
 */
export function handsOf(
  exercise: Exercise,
  step: ExerciseStep | null | undefined,
): { hand: Hand; fingers: number[] }[] {
  const playing = new Set<Hand>(
    step ? step.fingers.map((finger) => finger.hand) : exercise.fingerings.map((f) => f.hand),
  )
  if (playing.size === 0) playing.add('right')
  return (['left', 'right'] as const)
    .filter((hand) => playing.has(hand))
    .map((hand) => ({
      hand,
      fingers: step?.fingers.filter((f) => f.hand === hand).map((f) => f.finger) ?? [],
    }))
}
