import * as React from 'react'
import type { BadgeStatus } from '@/lib/achievements/badges'
import type { Achievements } from '@/state/achievements'
import { useGoalsStore } from '@/state/goals-store'
import { AchievementBadge } from '@/ui/AchievementBadge'

/**
 * Every badge on offer: the earned ones lit, the rest locked with what they
 * take and how far along the player is. A badge earned since the player last
 * looked is marked New for this visit, and counted as seen.
 */
export function BadgeShelf({ achievements }: { achievements: Achievements }) {
  const see = useGoalsStore((state) => state.see)
  const { badges, unseen } = achievements
  // Everything new while the page is open stays marked New, including what
  // turns out new once the goals have loaded; each is counted seen as it shows.
  const [fresh, setFresh] = React.useState<ReadonlySet<string>>(() => new Set())
  React.useEffect(() => {
    if (unseen.length === 0) return
    const ids = unseen.map((status) => status.badge.id)
    setFresh((before) => new Set([...before, ...ids]))
    void see(ids)
  }, [unseen, see])

  const earned = badges.filter((status) => status.earned).length
  return (
    <section className="progress__group" aria-label="Badges">
      <h2 className="progress__title">
        Badges{' '}
        <span className="badges__count" data-tabular>
          {earned} of {badges.length}
        </span>
      </h2>
      <ul className="badges">
        {badges.map((status) => (
          <BadgeCard key={status.badge.id} status={status} fresh={fresh.has(status.badge.id)} />
        ))}
      </ul>
    </section>
  )
}

function BadgeCard({ status, fresh }: { status: BadgeStatus; fresh: boolean }) {
  const { badge, progress, earned } = status
  return (
    <li className="badge-card" data-earned={earned} data-gold={earned && badge.gold === true}>
      <AchievementBadge icon={badge.icon} earned={earned} gold={badge.gold} size={56} />
      <span className="badge-card__name">
        {badge.name}
        {fresh && <span className="badge-card__new">New</span>}
      </span>
      <span className="badge-card__takes">{badge.takes}</span>
      <span className="badge-card__state" data-tabular>
        {earned ? 'Earned' : progress.need > 1 ? `${progress.have} of ${progress.need}` : 'Not yet'}
      </span>
    </li>
  )
}
