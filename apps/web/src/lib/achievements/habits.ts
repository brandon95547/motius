import type { Run } from '@motius/shared'
import { dayOf, mondayOf } from './days'

/**
 * Practice habits: the streak of days played, and the weekly goal.
 *
 * The streak forgives one day off in each week: a missed day keeps it going,
 * as long as it is the week's only one. It is meant to bring a player back,
 * not to punish a busy day. Today does not end it before it is over.
 */

/** A run that counts toward the weekly goal: played at 90% or better. */
export const GOAL_ACCURACY = 0.9

export interface Streak {
  /** Days played in the streak that is still going (0 if it has ended). */
  readonly current: number
  /** The longest streak there has been. */
  readonly longest: number
  /** This week, Monday to Sunday: whether each day was played. */
  readonly week: readonly boolean[]
}

/** The days played, oldest first, each once. */
const daysPlayed = (runs: readonly Pick<Run, 'at'>[]) =>
  [...new Set(runs.map((run) => dayOf(run.at)))].sort((a, b) => a - b)

interface StreakRun {
  start: number
  end: number
  played: number
  /** The weeks whose one day off it has taken, by their Monday. */
  rested: Set<number>
}

/**
 * Streaks, read along the days played. Two days played in a row carry it on;
 * so does one missed day between them, if that week has not had its day off
 * yet. Its length counts the days played.
 */
function streaksOf(days: readonly number[]): StreakRun[] {
  const streaks: StreakRun[] = []
  for (const day of days) {
    const last = streaks.at(-1)
    const gap = last ? day - last.end : Infinity
    const restWeek = mondayOf(day - 1)
    if (last && (gap === 1 || (gap === 2 && !last.rested.has(restWeek)))) {
      if (gap === 2) last.rested.add(restWeek)
      last.end = day
      last.played += 1
    } else {
      streaks.push({ start: day, end: day, played: 1, rested: new Set() })
    }
  }
  return streaks
}

export function streakOf(runs: readonly Pick<Run, 'at'>[], now = Date.now()): Streak {
  const today = dayOf(now)
  const days = daysPlayed(runs)
  const streaks = streaksOf(days)
  const last = streaks.at(-1)
  // Still going if it was played today or yesterday — or the day before, with
  // yesterday as its week's day off, if that week has one left.
  const alive =
    last !== undefined &&
    (today - last.end <= 1 || (today - last.end === 2 && !last.rested.has(mondayOf(today - 1))))
  const played = new Set(days)
  const monday = mondayOf(today)
  return {
    current: alive ? last.played : 0,
    longest: Math.max(0, ...streaks.map((streak) => streak.played)),
    week: Array.from({ length: 7 }, (_, index) => played.has(monday + index)),
  }
}

/** Runs at the goal's standard in the week a moment falls in. */
export function weekCount(runs: readonly Pick<Run, 'at' | 'accuracy'>[], now = Date.now()): number {
  const monday = mondayOf(dayOf(now))
  return runs.filter((run) => run.accuracy >= GOAL_ACCURACY && mondayOf(dayOf(run.at)) === monday)
    .length
}

/** Whether any week has reached a goal of so many runs at the standard. */
export function anyWeekReached(
  runs: readonly Pick<Run, 'at' | 'accuracy'>[],
  goal: number | null,
): boolean {
  if (goal === null) return false
  const weeks = new Map<number, number>()
  for (const run of runs) {
    if (run.accuracy < GOAL_ACCURACY) continue
    const monday = mondayOf(dayOf(run.at))
    weeks.set(monday, (weeks.get(monday) ?? 0) + 1)
  }
  return [...weeks.values()].some((count) => count >= goal)
}
