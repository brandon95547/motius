import type { buildArpeggioExercise, buildChordExercise } from './chord-exercise.js'
import type { buildCadenceExercise } from './cadence-exercise.js'
import type { buildFingeringExercise } from './fingering-exercise.js'
import { loadOnce } from './load-once.js'
import type { buildRoutineExercise } from './routine-exercise.js'
import type { buildScaleExercise } from './scale-exercise.js'

/*
 * Each practice area's builder is code of its own, loaded the first time the
 * area opens, as a section's lessons are (`lesson-exercise.ts`). The app holds
 * only the settings each area opens on (`practice-defaults.ts`) until then, so
 * a new area, or a bigger builder, weighs on its own area and no other page.
 *
 * Keyed by the kind of spec each one builds from.
 */

export interface PracticeBuilders {
  readonly scale: typeof buildScaleExercise
  readonly chord: typeof buildChordExercise
  readonly arpeggio: typeof buildArpeggioExercise
  readonly progression: typeof buildCadenceExercise
  readonly exercise: typeof buildRoutineExercise
  readonly fingering: typeof buildFingeringExercise
}

export type PracticeKind = keyof PracticeBuilders

const MODULES: { [Kind in PracticeKind]: () => Promise<PracticeBuilders[Kind]> } = {
  scale: () => import('./scale-exercise.js').then((loaded) => loaded.buildScaleExercise),
  chord: () => import('./chord-exercise.js').then((loaded) => loaded.buildChordExercise),
  arpeggio: () => import('./chord-exercise.js').then((loaded) => loaded.buildArpeggioExercise),
  progression: () => import('./cadence-exercise.js').then((loaded) => loaded.buildCadenceExercise),
  exercise: () => import('./routine-exercise.js').then((loaded) => loaded.buildRoutineExercise),
  fingering: () =>
    import('./fingering-exercise.js').then((loaded) => loaded.buildFingeringExercise),
}

const loaded: { -readonly [Kind in PracticeKind]?: PracticeBuilders[Kind] } = {}

/** Fetch an area's builder, once; a failed fetch is tried again next time. */
export const loadPracticeBuilder: (kind: PracticeKind) => Promise<void> = loadOnce(
  async <Kind extends PracticeKind>(kind: Kind) => {
    loaded[kind] = (await MODULES[kind]()) as (typeof loaded)[Kind]
  },
)

/** An area's builder, once it has loaded; until then, nothing to build with. */
export const practiceBuilder = <Kind extends PracticeKind>(
  kind: Kind,
): PracticeBuilders[Kind] | undefined => loaded[kind]

export const PRACTICE_KINDS = Object.keys(MODULES) as PracticeKind[]
