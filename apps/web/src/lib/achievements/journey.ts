import type { Run } from '@motius/shared'
import { CATEGORIES, writtenLessons, type Category } from '@/lib/outline/outline'

/**
 * Where the player is in the course: each category's written lessons and how
 * many are done, and the title that goes with how far they have come.
 *
 * A lesson is done once it has a scored run, as the lessons list counts it. A
 * category with no written lesson yet is to come; nothing about it is earned.
 */

export type StageState = 'complete' | 'in-progress' | 'next' | 'not-started' | 'to-come'

export interface JourneyStage {
  readonly category: Category
  readonly written: number
  readonly done: number
  readonly state: StageState
}

/** The lesson keys that have a scored run. */
export const doneKeys = (scored: readonly Pick<Run, 'kind' | 'key'>[]) =>
  new Set(scored.filter((run) => run.kind === 'lesson').map((run) => run.key))

export function journeyOf(scored: readonly Pick<Run, 'kind' | 'key'>[]): JourneyStage[] {
  const done = doneKeys(scored)
  const lessons = writtenLessons()
  const stages = CATEGORIES.map((category) => {
    const own = lessons.filter((lesson) => lesson.category.id === category.id)
    const finished = own.filter((lesson) => done.has(lesson.key)).length
    const state: StageState =
      own.length === 0
        ? 'to-come'
        : finished === own.length
          ? 'complete'
          : finished > 0
            ? 'in-progress'
            : 'not-started'
    return { category, written: own.length, done: finished, state }
  })
  // The first one with lessons to play and none started is the next, unless one is under way.
  if (!stages.some((stage) => stage.state === 'in-progress')) {
    const next = stages.find((stage) => stage.state === 'not-started')
    if (next) return stages.map((stage) => (stage === next ? { ...stage, state: 'next' } : stage))
  }
  return stages
}

/** The titles, in order, and what each asks. */
const TITLES: readonly { title: string; needs: string; reached: (j: Progress) => boolean }[] = [
  { title: 'Beginner', needs: '', reached: () => true },
  {
    title: 'Apprentice',
    needs: 'Finish your first lesson.',
    reached: (j) => j.lessonsDone >= 1,
  },
  {
    title: 'Foundation Pianist',
    needs: 'Finish every Piano Foundations lesson.',
    reached: (j) => j.complete.has('piano-foundations'),
  },
  {
    title: 'Developing Pianist',
    needs: 'Finish three categories.',
    reached: (j) => j.complete.size >= 3,
  },
  {
    title: 'Intermediate Pianist',
    needs: 'Finish five categories.',
    reached: (j) => j.complete.size >= 5,
  },
  {
    title: 'Advanced Pianist',
    needs: 'Finish all nine categories.',
    reached: (j) => j.complete.size >= CATEGORIES.length,
  },
]

interface Progress {
  readonly lessonsDone: number
  readonly complete: ReadonlySet<string>
}

export interface Title {
  readonly title: string
  /** Its place, 1 for the first. */
  readonly level: number
  /** The title after it and what it asks; none at the top. */
  readonly next: { readonly title: string; readonly needs: string } | null
}

export function titleOf(journey: readonly JourneyStage[]): Title {
  const progress: Progress = {
    lessonsDone: journey.reduce((sum, stage) => sum + stage.done, 0),
    complete: new Set(
      journey.filter((stage) => stage.state === 'complete').map((stage) => stage.category.id),
    ),
  }
  let level = 0
  while (level + 1 < TITLES.length && TITLES[level + 1]!.reached(progress)) level++
  const next = TITLES[level + 1]
  return {
    title: TITLES[level]!.title,
    level: level + 1,
    next: next ? { title: next.title, needs: next.needs } : null,
  }
}
