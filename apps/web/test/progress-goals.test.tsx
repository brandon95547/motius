import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Run } from '@motius/shared'
import { ProgressPage } from '@/features/progress/ProgressPage'
import { api } from '@/lib/api'
import { useGoalsStore } from '@/state/goals-store'
import { useHistoryStore } from '@/state/history-store'

/** The Progress page's trophy room: the title, the habits, the journey and the badges. */

const FIRST = 'piano-foundations/keyboard-layout/white-and-black-keys/two-black-key-groups'

const lessonRun = (key: string): Run => ({
  id: key,
  at: Date.now(),
  kind: 'lesson',
  key,
  title: 'Two black keys',
  place: 'Piano Foundations',
  opens: `#/${key}`,
  mode: 'learn',
  bpm: 72,
  steps: 4,
  accuracy: 1,
  mistakes: 0,
  missed: 0,
})

beforeEach(() => {
  useHistoryStore.setState({ runs: [], lessonsResetAt: null })
  useGoalsStore.setState({ weeklyGoal: null, seenBadges: new Set(), loaded: true })
})
afterEach(cleanup)

describe('the trophy room', () => {
  it('starts a Beginner with every badge locked, and the first category up next', () => {
    render(<ProgressPage />)
    expect(screen.getByRole('heading', { name: 'Beginner' })).toBeDefined()
    const badges = within(screen.getByRole('region', { name: 'Badges' }))
    expect(badges.queryAllByText('Earned')).toHaveLength(0)
    const journey = within(screen.getByRole('region', { name: 'Lesson journey' }))
    expect(journey.getByRole('button', { name: /Piano Foundations.*Up next/ })).toBeDefined()
  })

  it('marks a badge earned since the last visit New, and counts it seen', async () => {
    useHistoryStore.setState({ runs: [lessonRun(FIRST)] })
    render(<ProgressPage />)
    expect(screen.getByRole('heading', { name: 'Apprentice' })).toBeDefined()
    const badges = within(screen.getByRole('region', { name: 'Badges' }))
    expect(badges.getByText('New')).toBeDefined()
    await waitFor(() => expect(api.seeBadges).toHaveBeenCalledWith(['course-first-steps']))
    expect(useGoalsStore.getState().seenBadges.has('course-first-steps')).toBe(true)
  })

  it('marks New a badge found unseen once the goals load after the page opened', async () => {
    useGoalsStore.setState({ loaded: false })
    useHistoryStore.setState({ runs: [lessonRun(FIRST)] })
    render(<ProgressPage />)
    const badges = within(screen.getByRole('region', { name: 'Badges' }))
    expect(badges.queryByText('New')).toBeNull()
    act(() => useGoalsStore.setState({ loaded: true }))
    expect(badges.getByText('New')).toBeDefined()
    await waitFor(() => expect(api.seeBadges).toHaveBeenCalledWith(['course-first-steps']))
  })

  it('sets a weekly goal, and shows how far this week is toward it', async () => {
    useHistoryStore.setState({ runs: [lessonRun(FIRST)] })
    render(<ProgressPage />)
    const goal = within(screen.getByRole('region', { name: 'Weekly goal' }))
    act(() => {
      fireEvent.change(goal.getByRole('combobox'), { target: { value: '5' } })
    })
    await waitFor(() => expect(useGoalsStore.getState().weeklyGoal).toBe(5))
    expect(api.setWeeklyGoal).toHaveBeenCalledWith(5)
    expect(goal.getByText('1 / 5')).toBeDefined()
  })
})
