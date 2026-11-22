import * as React from 'react'
import { badgesOf, nextBadge, type BadgeStatus } from '@/lib/achievements/badges'
import { streakOf, weekCount, type Streak } from '@/lib/achievements/habits'
import { journeyOf, titleOf, type JourneyStage, type Title } from '@/lib/achievements/journey'
import { useGoalsStore } from './goals-store'
import { useHistoryStore, useScoredRuns } from './history-store'

/**
 * What the player has earned and is aiming for, worked out from their runs
 * and goals. Kept apart from the goals store, which loads with the app, so the
 * badges and their rules load only with what shows them: the Progress page,
 * the dashboard's next goal and a lesson's results.
 */

export interface Achievements {
  readonly streak: Streak
  /** Runs at 90% or better this week, toward the weekly goal. */
  readonly thisWeek: number
  readonly weeklyGoal: number | null
  readonly journey: readonly JourneyStage[]
  readonly title: Title
  readonly badges: readonly BadgeStatus[]
  /** The unearned badge the player is nearest to. */
  readonly next: BadgeStatus | null
  /** Earned, and not shown to the player yet. */
  readonly unseen: readonly BadgeStatus[]
}

/** Everything earned and aimed for, from the runs and the goals. */
export function useAchievements(): Achievements {
  const runs = useHistoryStore((state) => state.runs)
  const scored = useScoredRuns()
  const weeklyGoal = useGoalsStore((state) => state.weeklyGoal)
  const seen = useGoalsStore((state) => state.seenBadges)
  const loaded = useGoalsStore((state) => state.loaded)
  return React.useMemo(() => {
    const streak = streakOf(runs)
    const journey = journeyOf(scored)
    const badges = badgesOf({ runs, scored, streak, weeklyGoal })
    return {
      streak,
      thisWeek: weekCount(runs),
      weeklyGoal,
      journey,
      title: titleOf(journey),
      badges,
      next: nextBadge(badges),
      // Until the goals load, nothing counts as unseen: a reveal waits for them.
      unseen: loaded ? badges.filter((status) => status.earned && !seen.has(status.badge.id)) : [],
    }
  }, [runs, scored, weeklyGoal, seen, loaded])
}
