import type * as React from 'react'
import { Flame, Target } from 'lucide-react'
import { WEEKLY_GOAL } from '@motius/shared'
import { GOAL_ACCURACY } from '@/lib/achievements/habits'
import { percent } from '@/state/history-store'
import type { Achievements } from '@/state/achievements'
import { useGoalsStore } from '@/state/goals-store'
import { Select } from '@/ui/Controls'

/**
 * The habits: the practice streak, with this week's days, and the weekly goal
 * the player chose — so many runs at 90% or better, Monday to Sunday.
 */

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const GOALS = [3, 5, 10, 15, 20, 30].filter(
  (goal) => goal >= WEEKLY_GOAL.min && goal <= WEEKLY_GOAL.max,
)

export function Habits({ achievements }: { achievements: Achievements }) {
  const { streak, thisWeek, weeklyGoal } = achievements
  const setWeeklyGoal = useGoalsStore((state) => state.setWeeklyGoal)
  const today = (new Date().getDay() + 6) % 7
  const share = weeklyGoal ? Math.min(1, thisWeek / weeklyGoal) : 0

  return (
    <div className="habits">
      <section className="habit" aria-label="Practice streak">
        <h2 className="habit__head">
          <Flame size={18} aria-hidden className="habit__icon" />
          Practice streak
        </h2>
        <p className="habit__big" data-tabular>
          {streak.current} {streak.current === 1 ? 'day' : 'days'}
        </p>
        <p className="habit__line">
          {streak.current > 0
            ? 'One day off a week keeps it going.'
            : 'Play today to start a streak.'}{' '}
          Longest: {streak.longest}.
        </p>
        <ol className="habit__week">
          {DAYS.map((day, index) => (
            <li
              key={day}
              className="habit__day"
              data-played={streak.week[index]}
              data-today={index === today}
            >
              <span className="habit__dot" aria-hidden />
              <span>{day}</span>
              <span className="sr-only">{streak.week[index] ? 'played' : 'not played'}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="habit" aria-label="Weekly goal">
        <h2 className="habit__head">
          <Target size={18} aria-hidden className="habit__icon" />
          Weekly goal
          {weeklyGoal && (
            <span className="habit__count" data-tabular>
              {Math.min(thisWeek, weeklyGoal)} / {weeklyGoal}
            </span>
          )}
        </h2>
        <p className="habit__line">
          Runs at {percent(GOAL_ACCURACY)} or better this week, Monday to Sunday.
        </p>
        {weeklyGoal && (
          <div
            className="habit__meter"
            role="progressbar"
            aria-label="Weekly goal"
            aria-valuemin={0}
            aria-valuemax={weeklyGoal}
            aria-valuenow={Math.min(thisWeek, weeklyGoal)}
            style={{ '--fill': `${share * 100}%` } as React.CSSProperties}
          >
            <span className="habit__fill" />
          </div>
        )}
        <label className="habit__goal">
          <span>Goal</span>
          <Select
            size="sm"
            value={weeklyGoal === null ? '' : String(weeklyGoal)}
            onChange={(event) =>
              void setWeeklyGoal(event.target.value ? Number(event.target.value) : null).catch(
                (error: unknown) => console.error('Motius could not save the weekly goal.', error),
              )
            }
            options={[
              { value: '', label: 'No goal yet' },
              ...GOALS.map((goal) => ({ value: String(goal), label: `${goal} runs a week` })),
            ]}
          />
        </label>
      </section>
    </div>
  )
}
