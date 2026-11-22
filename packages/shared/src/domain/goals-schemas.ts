import { z } from 'zod'
import { WEEKLY_GOAL } from './goals.js'

/** A badge's id: `course-…` for the course's, `habit-…` for practice habits. */
export const badgeIdSchema = z
  .string()
  .min(1)
  .max(60)
  .regex(/^(course|habit)-[a-z0-9-]+$/)

export const goalsSchema = z.object({
  /** Null until the player picks one. */
  weeklyGoal: z.number().int().min(WEEKLY_GOAL.min).max(WEEKLY_GOAL.max).nullable(),
  /** Every badge whose unlock the player has been shown. */
  seenBadges: z.array(badgeIdSchema),
})

export type Goals = z.infer<typeof goalsSchema>

export const setWeeklyGoalSchema = z.object({
  weeklyGoal: z.number().int().min(WEEKLY_GOAL.min).max(WEEKLY_GOAL.max).nullable(),
})

export const seeBadgesSchema = z.object({ badges: z.array(badgeIdSchema).min(1).max(100) })
