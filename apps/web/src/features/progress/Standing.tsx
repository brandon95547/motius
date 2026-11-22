import type * as React from 'react'
import { AchievementBadge } from '@/ui/AchievementBadge'
import { GraduationCap } from 'lucide-react'
import type { Achievements } from '@/state/achievements'

/**
 * Where the player stands: their title, and what the next one asks, with the
 * share of the written lessons they have finished. A title is earned by how
 * far they are in the course, never by points.
 */
export function Standing({ achievements }: { achievements: Achievements }) {
  const { title, journey } = achievements
  const written = journey.reduce((sum, stage) => sum + stage.written, 0)
  const done = journey.reduce((sum, stage) => sum + stage.done, 0)
  const share = written > 0 ? done / written : 0
  return (
    <section className="standing" aria-label="Your piano journey">
      <AchievementBadge icon={GraduationCap} earned={done > 0} size={72} />
      <div className="standing__body">
        <p className="standing__eyebrow">Your piano journey</p>
        <h2 className="standing__title">{title.title}</h2>
        <div className="standing__row">
          <span className="standing__level">Level {title.level}</span>
          <div
            className="standing__meter"
            role="progressbar"
            aria-label="Lessons finished"
            aria-valuemin={0}
            aria-valuemax={written}
            aria-valuenow={done}
            style={{ '--fill': `${share * 100}%` } as React.CSSProperties}
          >
            <span className="standing__fill" />
          </div>
          <span className="standing__count" data-tabular>
            {done} / {written} lessons
          </span>
        </div>
      </div>
      {title.next && (
        <p className="standing__next">
          <span className="standing__next-label">Next: {title.next.title}</span>
          {title.next.needs}
        </p>
      )}
    </section>
  )
}
