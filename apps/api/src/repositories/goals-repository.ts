import type { Db } from '../db/index.js'
import type { Goals } from '@motius/shared'

/**
 * What a player is aiming for, kept with their account: their weekly goal and
 * the badges whose unlock they have been shown. Every method takes the
 * player's id: each reads and changes only their own. A reset clears these
 * with the runs, in `RunRepository.reset`.
 */
export class GoalsRepository {
  constructor(private readonly db: Db) {}

  /** The player's weekly goal and the badges they have seen, sorted by id. */
  get(userId: number): Goals {
    const user = this.db
      .prepare<[number], { weeklyGoal: number | null }>(
        'SELECT weekly_goal AS weeklyGoal FROM users WHERE id = ?',
      )
      .get(userId)
    const seen = this.db
      .prepare<[number], { badgeId: string }>(
        'SELECT badge_id AS badgeId FROM seen_badges WHERE user_id = ? ORDER BY badge_id',
      )
      .all(userId)
    return { weeklyGoal: user?.weeklyGoal ?? null, seenBadges: seen.map((row) => row.badgeId) }
  }

  /** Sets the weekly goal, or clears it with null. */
  setWeeklyGoal(userId: number, weeklyGoal: number | null): Goals {
    this.db.prepare('UPDATE users SET weekly_goal = ? WHERE id = ?').run(weeklyGoal, userId)
    return this.get(userId)
  }

  /** Marks badges seen. One seen before keeps when it was first seen. */
  see(userId: number, badges: readonly string[]): Goals {
    const insert = this.db.prepare(
      'INSERT INTO seen_badges (user_id, badge_id, seen_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
    )
    const now = Date.now()
    this.db.transaction(() => {
      for (const badge of badges) insert.run(userId, badge, now)
    })()
    return this.get(userId)
  }
}
