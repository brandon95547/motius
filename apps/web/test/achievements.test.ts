import { describe, expect, it } from 'vitest'
import type { Run } from '@motius/shared'
import { badgesOf, challengeFor, nextBadge } from '@/lib/achievements/badges'
import { anyWeekReached, streakOf, weekCount } from '@/lib/achievements/habits'
import { journeyOf, titleOf } from '@/lib/achievements/journey'
import { writtenLessons } from '@/lib/outline/outline'

/** Noon on a day of November 2026: the 16th is a Monday. */
const on = (date: number, hour = 12) => new Date(2026, 10, date, hour).getTime()

let id = 0
const run = (at: number, more: Partial<Run> = {}): Run => ({
  id: String(id++),
  at,
  kind: 'exercise',
  key: 'scales',
  title: 'A scale',
  place: 'Scales',
  opens: '#/scales',
  mode: 'learn',
  bpm: 72,
  steps: 8,
  accuracy: 1,
  mistakes: 0,
  missed: 0,
  ...more,
})
const lesson = (key: string, accuracy = 1) =>
  run(on(16), { kind: 'lesson', key, opens: `#/${key}`, accuracy })

describe('the practice streak', () => {
  it('counts days in a row, and is still going until a day has passed unplayed', () => {
    const runs = [run(on(16)), run(on(17)), run(on(17, 18)), run(on(18))]
    expect(streakOf(runs, on(18)).current).toBe(3)
    expect(streakOf(runs, on(19)).current).toBe(3)
    expect(streakOf(runs, on(16)).week.slice(0, 3)).toEqual([true, true, true])
  })

  it('forgives one day off a week, and not a second', () => {
    // Mon, Tue, (Wed off), Thu, (Fri off) — the second day off ends it.
    const runs = [run(on(16)), run(on(17)), run(on(19)), run(on(21))]
    expect(streakOf(runs.slice(0, 3), on(19)).current).toBe(3)
    expect(streakOf(runs, on(21)).current).toBe(1)
    expect(streakOf(runs, on(21)).longest).toBe(3)
    // A day off in the next week is that week's own.
    const later = [run(on(19)), run(on(20)), run(on(22)), run(on(24))]
    expect(streakOf(later, on(24)).current).toBe(4)
  })

  it('has ended after two days unplayed', () => {
    expect(streakOf([run(on(16))], on(19)).current).toBe(0)
  })
})

describe('the weekly goal', () => {
  it('counts the runs at 90% or better from Monday to Sunday', () => {
    const runs = [
      run(on(15)), // the Sunday before
      run(on(16)),
      run(on(18), { accuracy: 0.89 }),
      run(on(22)),
    ]
    expect(weekCount(runs, on(20))).toBe(2)
  })

  it('is reached in any week with enough, and never without a goal', () => {
    const runs = [run(on(9)), run(on(10)), run(on(16))]
    expect(anyWeekReached(runs, 2)).toBe(true)
    expect(anyWeekReached(runs, 3)).toBe(false)
    expect(anyWeekReached(runs, null)).toBe(false)
  })
})

describe('the course journey and the titles', () => {
  const written = writtenLessons()
  const foundations = written.filter((each) => each.category.id === 'piano-foundations')

  it('starts as a Beginner, with the first category up next', () => {
    const journey = journeyOf([])
    expect(journey[0]).toMatchObject({ state: 'next', done: 0 })
    expect(journey.filter((stage) => stage.state === 'to-come').length).toBeGreaterThan(0)
    expect(titleOf(journey)).toMatchObject({ title: 'Beginner', level: 1 })
    expect(titleOf(journey).next?.title).toBe('Apprentice')
  })

  it('makes an Apprentice of one lesson, and a Foundation Pianist of all of Piano Foundations', () => {
    const one = journeyOf([lesson(foundations[0]!.key)])
    expect(one[0]!.state).toBe('in-progress')
    expect(titleOf(one).title).toBe('Apprentice')

    const all = journeyOf(foundations.map((each) => lesson(each.key)))
    expect(all[0]!.state).toBe('complete')
    expect(titleOf(all)).toMatchObject({ title: 'Foundation Pianist', level: 3 })
  })
})

describe('the badges', () => {
  const streak = streakOf([])
  const context = (runs: Run[], weeklyGoal: number | null = null) => ({
    runs,
    scored: runs,
    streak: streakOf(runs, on(20)),
    weeklyGoal,
  })

  it('has every badge locked at first, and offers one to aim for', () => {
    const badges = badgesOf({ runs: [], scored: [], streak, weeklyGoal: null })
    expect(badges.length).toBeGreaterThanOrEqual(10)
    expect(badges.every((status) => !status.earned)).toBe(true)
    expect(nextBadge(badges)).not.toBeNull()
  })

  it('earns First Steps with a lesson, and counts toward a section', () => {
    const key = 'piano-foundations/keyboard-layout/white-and-black-keys/two-black-key-groups'
    const badges = badgesOf(context([lesson(key)]))
    const of = (id: string) => badges.find((status) => status.badge.id === id)!
    expect(of('course-first-steps').earned).toBe(true)
    expect(of('course-black-keys').progress).toEqual({ have: 1, need: 3 })
    // Next is the one nearest done that is not earned.
    expect(nextBadge(badges)!.earned).toBe(false)
  })

  it('earns Keyboard Master only at 90% or better on every Keyboard Layout lesson', () => {
    const layout = writtenLessons().filter((each) =>
      each.key.startsWith('piano-foundations/keyboard-layout/'),
    )
    const of = (runs: Run[]) =>
      badgesOf(context(runs)).find((status) => status.badge.id === 'course-keyboard-master')!
    expect(of(layout.map((each) => lesson(each.key, 0.95))).earned).toBe(true)
    // A whole section's badge is the gold one; a chapter's is not.
    expect(of([]).badge.gold).toBe(true)
    expect(
      badgesOf(context([])).find((status) => status.badge.id === 'course-pathfinder')!.badge.gold,
    ).toBeFalsy()
    expect(of(layout.map((each, index) => lesson(each.key, index === 0 ? 0.8 : 1))).earned).toBe(
      false,
    )
  })

  it('earns the habit badges from practice of any kind', () => {
    const runs = [
      run(on(16)),
      run(on(17)),
      run(on(18), { mode: 'practice' }),
      run(on(18), { kind: 'song', key: 'song-1' }),
    ]
    const earned = badgesOf(context(runs, 3))
      .filter((status) => status.earned)
      .map((status) => status.badge.id)
    expect(earned).toEqual(
      expect.arrayContaining([
        'habit-warming-up',
        'habit-goal-getter',
        'habit-spotless',
        'habit-encore',
      ]),
    )
    expect(earned).not.toContain('habit-week-strong')
  })

  it('challenges a lesson whose best is under 90% toward the mastery badge, and not once it is over', () => {
    const key = 'piano-foundations/keyboard-layout/musical-alphabet/notes-a-through-g'
    const short = [lesson(key, 0.8)]
    expect(challengeFor(key, short, badgesOf(context(short)))!.badge.id).toBe(
      'course-keyboard-master',
    )
    const enough = [lesson(key, 0.8), lesson(key, 0.92)]
    expect(challengeFor(key, enough, badgesOf(context(enough)))).toBeNull()
    // A lesson outside the badge's section is never challenged for it.
    expect(challengeFor('rhythm-and-timing/x', short, badgesOf(context(short)))).toBeNull()
  })
})
