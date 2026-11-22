import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Run } from '@motius/shared'

/**
 * A finished lesson ends on one sound: the gold badge's when the run earned a
 * gold one, the badge's when it earned another, and otherwise the lesson's own
 * success.
 */

describe('earning a badge', () => {
  const effects = vi.hoisted(() => ({ play: vi.fn(), stop: vi.fn() }))
  vi.mock('@/audio/sound-effects', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/audio/sound-effects')>()),
    playSoundEffect: effects.play,
    stopSoundEffect: effects.stop,
  }))

  beforeEach(() => {
    effects.play.mockClear()
    effects.stop.mockClear()
  })
  afterEach(cleanup)

  const key = 'piano-foundations/keyboard-layout/white-and-black-keys/two-black-key-groups'
  const finished: Run = {
    id: '1',
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
  }

  const end = async (runs: Run[]) => {
    const { useHistoryStore } = await import('@/state/history-store')
    const { useGoalsStore } = await import('@/state/goals-store')
    const { useLearningStore } = await import('@/state/learning-store')
    const { LessonFanfare } = await import('@/features/areas/goal-lines')
    useGoalsStore.setState({ weeklyGoal: null, seenBadges: new Set(), loaded: true })
    useHistoryStore.setState({ runs: [], lessonsResetAt: null })
    const status = (status: 'running' | 'complete') =>
      useLearningStore.setState((state) => ({ session: { ...state.session, status } }))
    act(() => status('running'))
    render(<LessonFanfare />)
    // As the app does it: the run is kept the moment it ends.
    act(() => {
      useHistoryStore.setState({ runs })
      status('complete')
    })
  }

  it('plays the badge sound, and not the lesson sound, when the run earns a badge', async () => {
    await end([finished])
    expect(effects.play).toHaveBeenCalledTimes(1)
    expect(effects.play).toHaveBeenCalledWith('badge')
  })

  it('plays the gold badge sound when the run earns a gold badge', async () => {
    const { writtenLessons } = await import('@/lib/outline/outline')
    // Every Keyboard Layout lesson at 90% or better earns Keyboard Master, which is gold.
    const layout = writtenLessons().filter((lesson) =>
      lesson.key.startsWith('piano-foundations/keyboard-layout/'),
    )
    await end(layout.map((lesson, index) => ({ ...finished, id: `${index}`, key: lesson.key })))
    expect(effects.play).toHaveBeenCalledExactlyOnceWith('goldBadge')
  })

  it('plays the lesson sound when the run earns none', async () => {
    const { useGoalsStore } = await import('@/state/goals-store')
    await end([])
    expect(effects.play).toHaveBeenCalledTimes(1)
    expect(effects.play).toHaveBeenCalledWith('success')
    expect(useGoalsStore.getState().seenBadges.size).toBe(0)
  })
})
