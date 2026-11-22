import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildSong, MAX_RUNS, PRACTICE_START } from '@motius/shared'
import { useRunHistory } from '@/components/use-run-history'
import { api } from '@/lib/api'
import { useAccountStore } from '@/state/account-store'
import { ProgressPage, whenOf } from '@/features/progress/ProgressPage'
import { playedOf, useHistoryStore, type RunRecord } from '@/state/history-store'
import { useLearningStore } from '@/state/learning-store'
import { usePageStore } from '@/state/page-store'
import { useSongStore } from '@/state/song-store'

/**
 * The practice history: every finished run kept with the player's account,
 * and Progress, which reads it — the latest runs, then everything played with its best, its
 * tries and when it was last played.
 */

const run = (over: Partial<RunRecord> = {}): RunRecord => ({
  id: Math.random().toString(36),
  at: Date.now(),
  kind: 'exercise',
  key: 'scale:A',
  title: 'A Natural Minor',
  place: 'Scales',
  opens: '#/scales',
  mode: 'learn',
  bpm: 72,
  steps: 15,
  accuracy: 0.8,
  mistakes: 3,
  missed: 0,
  ...over,
})

const learning = () => useLearningStore.getState()

/** What the server holds for the player, and how many times runs were sent. */
let server: RunRecord[] = []
let reachable = true

beforeEach(() => {
  globalThis.localStorage.clear()
  useHistoryStore.setState({ runs: [], lessonsResetAt: null })
  useAccountStore.setState({
    status: 'signed-in',
    user: { email: 'player@example.com', name: 'Player', picture: null, isAdmin: false },
  })
  server = []
  reachable = true
  vi.spyOn(api, 'listRuns').mockImplementation(async () => ({
    items: [...server],
    lessonsResetAt: null,
  }))
  vi.spyOn(api, 'addRuns').mockImplementation(async (runs) => {
    if (!reachable) throw new Error('offline')
    const items = runs.map((each, index) => ({ ...each, id: `server-${server.length + index}` }))
    server.push(...items)
    return { items, skipped: 0 }
  })
})
afterEach(() => {
  cleanup()
  act(() => learning().reset())
  vi.restoreAllMocks()
})

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))
const waitingKey = 'motius.runs-waiting:player@example.com'
const waitingHere = () => JSON.parse(globalThis.localStorage.getItem(waitingKey) ?? '[]')

describe('the history', () => {
  it('shows a run at once and keeps it with the account', async () => {
    const { id: _id, ...finished } = run()
    useHistoryStore.getState().add(finished)
    expect(useHistoryStore.getState().runs).toHaveLength(1)
    await settle()
    expect(server).toHaveLength(1)
    expect(useHistoryStore.getState().runs[0]!.id).toBe('server-0')
    expect(waitingHere()).toEqual([])
  })

  it('holds a run the server could not take on the device, and sends it on the next load', async () => {
    reachable = false
    const { id: _id, ...finished } = run()
    useHistoryStore.getState().add(finished)
    await settle()
    expect(server).toHaveLength(0)
    expect(waitingHere()).toHaveLength(1)

    reachable = true
    await act(() => useHistoryStore.getState().load())
    expect(server).toHaveLength(1)
    expect(waitingHere()).toEqual([])
    expect(useHistoryStore.getState().runs.map((each) => each.id)).toEqual(['server-0'])
  })

  it('stops holding a run the server skipped as unreadable, and keeps sending the rest', async () => {
    // Written by an older release: the server checks each run and skips it.
    const { id: _id, ...good } = run({ key: 'good' })
    globalThis.localStorage.setItem(waitingKey, JSON.stringify([{ key: 'old' }, good]))
    vi.mocked(api.addRuns).mockImplementationOnce(async (runs) => ({
      items: runs.filter((each) => each.title).map((each) => ({ ...each, id: 'server-0' })),
      skipped: 1,
    }))
    await act(() => useHistoryStore.getState().load())
    expect(waitingHere()).toEqual([])
  })

  it('takes the history this device kept before accounts to the first account signed in', async () => {
    const { id: _id, ...before } = run({ key: 'from-before' })
    globalThis.localStorage.setItem('motius.history.v1', JSON.stringify([{ ...before, id: 'x' }]))
    await act(() => useHistoryStore.getState().load())
    expect(server.map((each) => each.key)).toEqual(['from-before'])
    expect(globalThis.localStorage.getItem('motius.history.v1')).toBeNull()
  })

  it('lets the oldest go past the limit', () => {
    const { add } = useHistoryStore.getState()
    useHistoryStore.setState({ runs: Array.from({ length: MAX_RUNS }, () => run()) })
    add(run({ key: 'newest' }))
    const { runs } = useHistoryStore.getState()
    expect(runs).toHaveLength(MAX_RUNS)
    expect(runs.at(-1)!.key).toBe('newest')
  })

  it('counts each thing played once: its best, its tries, the latest first', () => {
    const played = playedOf([
      run({ key: 'a', at: 1, accuracy: 0.5 }),
      run({ key: 'b', at: 2, accuracy: 1 }),
      run({ key: 'a', at: 3, accuracy: 0.9 }),
      run({ key: 'a', at: 4, accuracy: 0.7 }),
    ])
    expect(played.map((each) => each.key)).toEqual(['a', 'b'])
    expect(played[0]!.tries).toBe(3)
    expect(played[0]!.best.accuracy).toBe(0.9)
    expect(played[0]!.latest.at).toBe(4)
  })

  it('says when as a player would', () => {
    const now = new Date(2026, 10, 18, 15, 0).getTime()
    expect(whenOf(now - 60_000, now)).toMatch(/^Today, /)
    expect(whenOf(now - 86_400_000, now)).toMatch(/^Yesterday, /)
    expect(whenOf(new Date(2026, 10, 2, 9).getTime(), now)).toMatch(/2/)
  })
})

describe('keeping a run', () => {
  /** Plays every step of the exercise that is up, right. */
  const finish = () =>
    act(() => {
      learning().start()
      for (const step of learning().exercise!.steps)
        for (const note of step.notes) useLearningStore.getState().noteOn(note)
    })

  it('keeps a lesson’s run under its address and name', () => {
    renderHook(() => useRunHistory())
    act(() => {
      usePageStore.setState({
        page: 'lesson',
        category: 'piano-foundations',
        path: ['keyboard-layout', 'white-and-black-keys', 'two-black-key-groups'],
      })
      learning().setLesson('two-black-key-groups')
      learning().setTopic('lesson')
      learning().setMode('learn')
    })
    finish()
    const [kept] = useHistoryStore.getState().runs
    expect(kept).toMatchObject({
      kind: 'lesson',
      title: 'Two black keys',
      place: 'Piano Foundations',
      accuracy: 1,
      mode: 'learn',
    })
    expect(kept!.opens).toBe(`#/${kept!.key}`)
    expect(kept!.key).toMatch(/two-black-key-groups$/)
  })

  it('keeps a practice area’s run as the exercise it was, and nothing from Listen', () => {
    renderHook(() => useRunHistory())
    act(() => {
      usePageStore.setState({ page: 'area', category: null, path: [] })
      learning().setTopic('scales')
      learning().setMode('practice')
    })
    finish()
    const [kept] = useHistoryStore.getState().runs
    expect(kept).toMatchObject({ kind: 'exercise', place: 'Scales', opens: '#/scales' })
    expect(kept!.key).toBe(learning().exercise!.id)

    act(() => learning().setMode('listen'))
    expect(useHistoryStore.getState().runs).toHaveLength(1)
  })

  it('keeps a song’s Practice when it reaches the end, with how it was timed', () => {
    const song = buildSong({
      id: 'kept',
      title: 'Kept',
      bpm: 100,
      beatsPerMeasure: 4,
      notes: [
        { note: 60, velocity: 80, startMs: 0, durationMs: 500, hand: 'right', role: 'keyboard' },
      ],
      source: 'midi',
      handsInferred: false,
    })
    renderHook(() => useRunHistory())
    act(() =>
      useSongStore.setState({
        library: [song],
        currentId: song.id,
        mode: 'practice',
        tempoScale: 1,
        stepCount: 2,
        practice: { ...PRACTICE_START, step: 1, results: ['on-time'] },
      }),
    )
    act(() => useSongStore.getState().end())
    const [kept] = useHistoryStore.getState().runs
    expect(kept).toMatchObject({
      kind: 'song',
      title: 'Kept',
      accuracy: 0.5,
      missed: 1,
      timing: { onTime: 1, early: 0, late: 0 },
    })
    act(() => useSongStore.getState().setMode('listen'))
  })
})

describe('Progress', () => {
  it('says there is nothing yet, and how to put something there', () => {
    render(<ProgressPage />)
    expect(screen.getByRole('heading', { name: 'Nothing played yet' })).toBeDefined()
  })

  it('lists the latest runs, then each thing played with its best, by kind', () => {
    useHistoryStore.setState({
      runs: [
        run({ key: 'scale', at: 1, accuracy: 0.6 }),
        run({ key: 'scale', at: 2, accuracy: 0.9 }),
        run({
          key: 'lesson',
          kind: 'lesson',
          title: 'Two black keys',
          place: 'Piano Foundations',
          opens: '#/piano-foundations/x',
          at: 3,
          accuracy: 1,
        }),
      ],
    })
    render(<ProgressPage />)
    expect(screen.getByText('Runs').nextSibling!.textContent).toBe('3')
    const recent = within(screen.getByRole('region', { name: 'Recent' })).getAllByRole('button')
    expect(recent).toHaveLength(3)
    expect(recent[0]!.textContent).toContain('Two black keys')

    const areas = within(screen.getByRole('region', { name: 'Practice areas' }))
    expect(areas.getByRole('button').textContent).toContain('Best 90% · 2 tries')
    const lessons = within(screen.getByRole('region', { name: 'Lessons' }))
    fireEvent.click(lessons.getByRole('button'))
    expect(globalThis.location.hash).toBe('#/piano-foundations/x')
    expect(screen.queryByRole('region', { name: 'Songs' })).toBeNull()
  })
})

describe('starting over', () => {
  const lesson = (at: number) =>
    run({
      key: 'lesson',
      kind: 'lesson',
      title: 'Two black keys',
      place: 'Piano Foundations',
      opens: '#/piano-foundations/x',
      at,
      accuracy: 1,
    })
  const openReset = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Reset progress…' }))
    return screen.getByRole('dialog', { name: 'Reset progress' })
  }

  it('offers both ways in a dialog, the gentler chosen, and cancels', () => {
    useHistoryStore.setState({ runs: [lesson(1)] })
    render(<ProgressPage />)
    const dialog = openReset()
    expect(within(dialog).getByRole('radio', { name: /Start the lessons over/ })).toHaveProperty(
      'checked',
      true,
    )
    fireEvent.click(within(dialog).getByRole('radio', { name: /Start fresh, like a new account/ }))
    expect(within(dialog).getByRole('button', { name: 'Delete everything' })).toBeDefined()
    expect(dialog.textContent).toContain('cannot be undone')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('starts the lessons over, and keeps the history in the totals', async () => {
    const reset = vi.spyOn(api, 'resetProgress').mockResolvedValue({ lessonsResetAt: 10 })
    useHistoryStore.setState({ runs: [run({ key: 'scale', at: 2 }), lesson(5)] })
    render(<ProgressPage />)
    fireEvent.click(within(openReset()).getByRole('button', { name: 'Start lessons over' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(reset).toHaveBeenCalledWith('lessons')
    // The lesson's best is gone; the history, and the totals, keep it.
    expect(screen.queryByRole('region', { name: 'Lessons' })).toBeNull()
    expect(screen.getByText('Runs').nextSibling!.textContent).toBe('2')
    expect(screen.getByText('Pieces played').nextSibling!.textContent).toBe('2')
    expect(
      within(screen.getByRole('region', { name: 'Recent' })).getAllByRole('button'),
    ).toHaveLength(2)
    // A lesson played after it counts again.
    act(() => useHistoryStore.setState({ runs: [...useHistoryStore.getState().runs, lesson(20)] }))
    expect(screen.getByRole('region', { name: 'Lessons' })).toBeDefined()
  })

  it('starts fresh like a new account: every run gone, the introductions back', async () => {
    vi.spyOn(api, 'resetProgress').mockResolvedValue({ lessonsResetAt: null })
    globalThis.localStorage.setItem('motius.lesson-intros-hidden', JSON.stringify(['x']))
    useHistoryStore.setState({ runs: [lesson(1), run({ key: 'scale', at: 2 })] })
    render(<ProgressPage />)
    const dialog = openReset()
    fireEvent.click(within(dialog).getByRole('radio', { name: /Start fresh, like a new account/ }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete everything' }))
    await screen.findByRole('heading', { name: 'Nothing played yet' })
    expect(useHistoryStore.getState().runs).toEqual([])
    expect(globalThis.localStorage.getItem('motius.lesson-intros-hidden')).toBeNull()
  })

  it('says so when the reset did not work, and keeps everything', async () => {
    vi.spyOn(api, 'resetProgress').mockRejectedValue(new Error('offline'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    useHistoryStore.setState({ runs: [lesson(1)] })
    render(<ProgressPage />)
    fireEvent.click(within(openReset()).getByRole('button', { name: 'Start lessons over' }))
    await screen.findByText('That did not work. Try again.')
    expect(useHistoryStore.getState().runs).toHaveLength(1)
  })
})
