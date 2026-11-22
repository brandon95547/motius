import type { Run } from '@motius/shared'
import {
  Compass,
  Flame,
  Footprints,
  Medal,
  Music,
  Piano,
  Repeat,
  Sparkles,
  Sun,
  Target,
  Trophy,
  Type,
  type LucideIcon,
} from 'lucide-react'
import { writtenLessons } from '@/lib/outline/outline'
import { doneKeys } from './journey'
import { anyWeekReached, type Streak } from './habits'

/**
 * Every badge, in one list: what it is called, what it takes, and how far the
 * player is toward it. Whether one is earned is worked out from the runs every
 * time — none is stored — so a reset takes it away with them. Adding a badge is
 * an entry here.
 *
 * Course badges (`course-…`) count the lessons — a chapter's, or a whole
 * section's, which is gold; habit badges (`habit-…`) count practice of any kind. A course badge for a part of the course with no
 * written lesson yet is not offered.
 */

export interface BadgeContext {
  /** Every run, the history. */
  readonly runs: readonly Run[]
  /** The runs the lessons are scored from (`scoredRuns`). */
  readonly scored: readonly Run[]
  readonly streak: Streak
  readonly weeklyGoal: number | null
}

export interface BadgeProgress {
  readonly have: number
  readonly need: number
}

export interface Badge {
  readonly id: string
  readonly name: string
  /** What it takes, as the player is told it. */
  readonly takes: string
  readonly icon: LucideIcon
  /**
   * Gold for finishing a whole section of the course, the course's biggest
   * steps; every other badge is the lessons' violet.
   */
  readonly gold?: boolean
  /**
   * The lessons it asks to be played well, and how well: a lesson under
   * `prefix` counts toward it only at `accuracy` or better. A lesson's results
   * challenge the player to reach it.
   */
  readonly mastery?: { readonly prefix: string; readonly accuracy: number }
  readonly progress: (context: BadgeContext) => BadgeProgress
}

/** The written lessons under a part of the course. */
const lessonsUnder = (prefix: string) =>
  writtenLessons().filter((lesson) => lesson.key.startsWith(`${prefix}/`))

/** Every written lesson under a part of the course finished. */
const finishAll =
  (prefix: string) =>
  ({ scored }: BadgeContext): BadgeProgress => {
    const keys = lessonsUnder(prefix).map((lesson) => lesson.key)
    const done = doneKeys(scored)
    return { have: keys.filter((key) => done.has(key)).length, need: keys.length }
  }

/** The score a lesson asks for to count toward a mastery badge. */
export const MASTERY_ACCURACY = 0.9

/** Every written lesson under a part of the course played at 90% or better. */
const masterAll =
  (prefix: string) =>
  ({ scored }: BadgeContext): BadgeProgress => {
    const keys = lessonsUnder(prefix).map((lesson) => lesson.key)
    const mastered = new Set(
      scored
        .filter((run) => run.kind === 'lesson' && run.accuracy >= MASTERY_ACCURACY)
        .map((run) => run.key),
    )
    return { have: keys.filter((key) => mastered.has(key)).length, need: keys.length }
  }

const count = (have: number, need: number): BadgeProgress => ({
  have: Math.min(have, need),
  need,
})

const LAYOUT = 'piano-foundations/keyboard-layout'

export const BADGES: readonly Badge[] = [
  {
    id: 'course-first-steps',
    name: 'First Steps',
    takes: 'Finish your first lesson.',
    icon: Footprints,
    progress: ({ scored }) => count(doneKeys(scored).size, 1),
  },
  {
    id: 'course-black-keys',
    name: 'Black-Key Explorer',
    takes: 'Finish every White and black keys lesson.',
    icon: Piano,
    progress: finishAll(`${LAYOUT}/white-and-black-keys`),
  },
  {
    id: 'course-note-navigator',
    name: 'Note Navigator',
    takes: 'Finish every Musical alphabet lesson.',
    icon: Type,
    progress: finishAll(`${LAYOUT}/musical-alphabet`),
  },
  {
    id: 'course-pathfinder',
    name: 'Pathfinder',
    takes: 'Finish every Keyboard navigation lesson.',
    icon: Compass,
    progress: finishAll(`${LAYOUT}/keyboard-navigation`),
  },
  {
    id: 'course-keyboard-master',
    name: 'Keyboard Master',
    takes: 'Play every Keyboard Layout lesson at 90% or better.',
    icon: Trophy,
    gold: true,
    mastery: { prefix: LAYOUT, accuracy: MASTERY_ACCURACY },
    progress: masterAll(LAYOUT),
  },
  {
    id: 'habit-warming-up',
    name: 'Warming Up',
    takes: 'Practice three days in a row.',
    icon: Sun,
    progress: ({ streak }) => count(streak.longest, 3),
  },
  {
    id: 'habit-week-strong',
    name: 'Week Strong',
    takes: 'Keep a seven-day practice streak.',
    icon: Flame,
    progress: ({ streak }) => count(streak.longest, 7),
  },
  {
    id: 'habit-goal-getter',
    name: 'Goal Getter',
    takes: 'Reach your weekly goal.',
    icon: Target,
    progress: ({ runs, weeklyGoal }) => count(anyWeekReached(runs, weeklyGoal) ? 1 : 0, 1),
  },
  {
    id: 'habit-spotless',
    name: 'Spotless',
    takes: 'Finish a Practice run with no mistakes and nothing missed.',
    icon: Sparkles,
    progress: ({ runs }) =>
      count(
        runs.some((run) => run.mode === 'practice' && run.mistakes === 0 && run.missed === 0)
          ? 1
          : 0,
        1,
      ),
  },
  {
    id: 'habit-encore',
    name: 'Encore',
    takes: 'Play a song all the way through in Practice.',
    icon: Music,
    progress: ({ runs }) => count(runs.some((run) => run.kind === 'song') ? 1 : 0, 1),
  },
  {
    id: 'habit-dedicated',
    name: 'Dedicated',
    takes: 'Finish 100 runs.',
    icon: Repeat,
    progress: ({ runs }) => count(runs.length, 100),
  },
  {
    id: 'habit-regular',
    name: 'Regular',
    takes: 'Finish 25 runs.',
    icon: Medal,
    progress: ({ runs }) => count(runs.length, 25),
  },
]

export interface BadgeStatus {
  readonly badge: Badge
  readonly progress: BadgeProgress
  readonly earned: boolean
}

/** Every badge on offer, with how far the player is toward it. */
export function badgesOf(context: BadgeContext): BadgeStatus[] {
  return BADGES.map((badge) => ({ badge, progress: badge.progress(context) }))
    .filter(({ progress }) => progress.need > 0)
    .map((status) => ({ ...status, earned: status.progress.have >= status.progress.need }))
}

/**
 * The badge to aim for next: the unearned one the player is nearest to, by
 * the share of it done — the course's first where two are as near.
 */
export function nextBadge(statuses: readonly BadgeStatus[]): BadgeStatus | null {
  const open = statuses.filter((status) => !status.earned)
  if (open.length === 0) return null
  return open.reduce((best, status) =>
    status.progress.have / status.progress.need > best.progress.have / best.progress.need
      ? status
      : best,
  )
}

/**
 * The badge a lesson's best score is short of: an unearned mastery badge the
 * lesson counts toward, while its best is below what the badge asks. Null when
 * the lesson already counts, or no such badge takes it.
 */
export function challengeFor(
  lessonKey: string,
  scored: readonly Run[],
  statuses: readonly BadgeStatus[],
): BadgeStatus | null {
  const best = Math.max(
    0,
    ...scored
      .filter((run) => run.kind === 'lesson' && run.key === lessonKey)
      .map((run) => run.accuracy),
  )
  return (
    statuses.find(
      ({ badge, earned }) =>
        !earned &&
        badge.mastery !== undefined &&
        lessonKey.startsWith(`${badge.mastery.prefix}/`) &&
        best < badge.mastery.accuracy,
    ) ?? null
  )
}
