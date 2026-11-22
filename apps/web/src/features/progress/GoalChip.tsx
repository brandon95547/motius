import type * as React from 'react'
import { findCategory } from '@/lib/outline/outline'
import { useAchievements } from '@/state/achievements'
import { pageActions } from '@/state/page-store'
import { AchievementBadge } from '@/ui/AchievementBadge'

/**
 * The next badge to aim for, on the bar wherever it has room — every page with
 * no music to play — as a chip that opens Progress. On a phone it is the badge
 * alone in a ring of how far along it is; the bar along the bottom has
 * Progress itself. Nothing when every badge is earned.
 */
export function GoalChip() {
  const { next } = useAchievements()
  const progress = findCategory('progress')
  if (!next || !progress) return null
  const { have, need } = next.progress
  const label = `Next badge: ${next.badge.name}. ${next.badge.takes}${
    need > 1 ? ` ${have} of ${need} done.` : ''
  }`
  return (
    <button
      type="button"
      className="goal-chip"
      aria-label={label}
      title={label}
      onClick={() => pageActions.openCategory(progress)}
      style={{ '--done': `${(have / need) * 100}%` } as React.CSSProperties}
    >
      <span className="goal-chip__ring">
        <AchievementBadge icon={next.badge.icon} earned={false} size={24} />
      </span>
      <span className="goal-chip__text" aria-hidden>
        {next.badge.name}
        {need > 1 && (
          <span className="goal-chip__count" data-tabular>
            {have} of {need}
          </span>
        )}
      </span>
    </button>
  )
}
