import * as React from 'react'
import { playSoundEffect, stopSoundEffect, type SoundEffect } from '@/audio/sound-effects'
import { challengeFor, type BadgeStatus } from '@/lib/achievements/badges'
import { useAchievements } from '@/state/achievements'
import { useGoalsStore } from '@/state/goals-store'
import { percent, useScoredRuns } from '@/state/history-store'
import { useLearningStore } from '@/state/learning-store'
import { AchievementBadge } from '@/ui/AchievementBadge'
import { keyOf, useHere } from './lesson-here'

/*
 * A finished lesson's sound and the badges its results reveal: loaded with the
 * lesson, with the badges' rules, so they add nothing to what the app loads at
 * first.
 */

/**
 * The sound a finished lesson ends on: the gold badge's, when the run earned a
 * gold one; the badge's, when it earned another; and otherwise the lesson's own
 * success — only ever one. Mounted with the lesson, so it is ready the moment
 * the run ends; the run is in the history by then, so a badge it earned is
 * already counted.
 */
export function LessonFanfare() {
  const { unseen } = useAchievements()
  const status = useLearningStore((state) => state.session.status)
  const previous = React.useRef(status)
  React.useEffect(() => {
    if (status === 'complete' && previous.current === 'running') playSoundEffect(fanfareFor(unseen))
    if (status === 'running') {
      stopSoundEffect('success')
      stopSoundEffect('badge')
      stopSoundEffect('goldBadge')
    }
    previous.current = status
  }, [status, unseen])
  return null
}

function fanfareFor(earned: readonly BadgeStatus[]): SoundEffect {
  if (earned.some((status) => status.badge.gold)) return 'goldBadge'
  return earned.length > 0 ? 'badge' : 'success'
}

/**
 * In a lesson's results: the badges the run earned, revealed — counted as seen
 * at once, so an unlock is shown once and nowhere else — or else the one the
 * player is nearest to and how far along they are.
 */
export function LessonBadges() {
  const { unseen, next, badges } = useAchievements()
  const see = useGoalsStore((state) => state.see)
  const scored = useScoredRuns()
  const here = useHere()
  const lesson = here?.lessons[here.index]
  const challenge = here && lesson ? challengeFor(keyOf(here, lesson), scored, badges) : null
  const complete = useLearningStore((state) => state.session.status === 'complete')
  // Kept from the moment the run ends until the next one starts.
  const [earned, setEarned] = React.useState<readonly BadgeStatus[] | null>(null)
  React.useEffect(() => {
    if (!complete) setEarned(null)
    else if (earned === null && unseen.length > 0) {
      setEarned(unseen)
      void see(unseen.map((status) => status.badge.id))
    }
  }, [complete, unseen, earned, see])
  return <BadgeNews earned={earned ?? []} challenge={challenge} next={next} />
}

/**
 * What the run did for the player's badges: the ones it earned, revealed; else
 * a challenge, where this lesson's best is short of what a badge asks; else the
 * badge they are nearest to and how far along they are.
 */
function BadgeNews({
  earned,
  challenge,
  next,
}: {
  earned: readonly BadgeStatus[]
  challenge: BadgeStatus | null
  next: BadgeStatus | null
}) {
  const [first, ...more] = earned
  if (first) {
    return (
      <div
        className="badge-news"
        data-earned="true"
        data-gold={first.badge.gold === true}
        role="status"
      >
        <AchievementBadge
          icon={first.badge.icon}
          earned
          gold={first.badge.gold}
          size={56}
          className="badge-news__badge"
        />
        <p className="badge-news__text">
          <span className="badge-news__title">Badge earned: {first.badge.name}</span>
          <span>
            {first.badge.takes.replace(/\.$/, '')}
            {more.length > 0 && `, and ${more.length} more on your Progress page`}.
          </span>
        </p>
      </div>
    )
  }
  if (challenge) {
    const { badge, progress } = challenge
    return (
      <div className="badge-news" data-challenge="true">
        <AchievementBadge icon={badge.icon} earned={false} size={44} />
        <p className="badge-news__text">
          <span className="badge-news__title">
            Challenge: {percent(badge.mastery!.accuracy)} or better
          </span>
          <span>
            Play this lesson at {percent(badge.mastery!.accuracy)} to count it toward {badge.name}
            <span data-tabular>
              {' '}
              ({progress.have} of {progress.need})
            </span>
            .
          </span>
        </p>
      </div>
    )
  }
  if (!next) return null
  return (
    <div className="badge-news">
      <AchievementBadge icon={next.badge.icon} earned={false} size={44} />
      <p className="badge-news__text">
        <span className="badge-news__title">
          Next badge: {next.badge.name}
          {next.progress.need > 1 && (
            <span data-tabular>
              {' '}
              · {next.progress.have} of {next.progress.need}
            </span>
          )}
        </span>
        <span>{next.badge.takes}</span>
      </p>
    </div>
  )
}
