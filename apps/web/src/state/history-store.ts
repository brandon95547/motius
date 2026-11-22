import * as React from 'react'
import { create } from 'zustand'
import { type NewRun, type ResetScope, type Run, type RunKind, MAX_RUNS } from '@motius/shared'
import { api } from '@/lib/api'
import { useAccountStore } from './account-store'

/**
 * Every run the player has finished: a lesson, a practice area's exercise, or
 * a song played through in Practice — what it was, when, how fast, and how it
 * went. What the Progress page reads, and what a lesson's best score is worked
 * out from.
 *
 * Kept with the player's account, so it follows them to any device they sign
 * in on (`/runs`). A run is shown the moment it ends and sent to the server
 * then; one the server has not taken yet — offline, or the server down — waits
 * on this device, under the player's own address so it can only go to their
 * account, and goes with the next load. A device's history from before there
 * were accounts goes to the first account signed in on it, so nothing kept
 * before is lost.
 */

export type { RunKind }
/** A finished run (the contract's `Run`): what it was, and how it went. */
export type RunRecord = Run

interface HistoryState {
  /** Oldest first: every run, the history. */
  runs: readonly RunRecord[]
  /**
   * When the player last started the lessons over: lesson scores count only
   * the lesson runs after it (`scoredRuns`). Null for never.
   */
  lessonsResetAt: number | null
  /** Fetches the player's runs, sending first any this device still holds. */
  load: () => Promise<void>
  add: (run: NewRun) => void
  /** Starts over: the lessons only, keeping the history, or everything. */
  reset: (scope: ResetScope) => Promise<void>
}

/** Runs the server has not taken yet, on this device, for the one signed in. */
const waitingKey = () => `motius.runs-waiting:${useAccountStore.getState().user?.email ?? ''}`
/** The history this device kept before there were accounts. */
const BEFORE_ACCOUNTS_KEY = 'motius.history.v1'

/** The same run, whether it is the one waiting here or the one the server sent back. */
const sameRun = (a: NewRun, b: NewRun) => a.at === b.at && a.key === b.key

/**
 * The runs waiting on this device, as this app wrote them. They are checked on
 * the server, one by one, when sent (`POST /runs`): one an older release wrote
 * that the server cannot read is skipped there and stops waiting here.
 */
function waiting(key = waitingKey()): NewRun[] {
  try {
    const stored: unknown = JSON.parse(globalThis.localStorage?.getItem(key) ?? '[]')
    return Array.isArray(stored) ? (stored as NewRun[]) : []
  } catch {
    return []
  }
}

function setWaiting(all: readonly NewRun[]) {
  const runs = all.filter((run, index) => all.findIndex((each) => sameRun(each, run)) === index)
  try {
    if (runs.length === 0) globalThis.localStorage?.removeItem(waitingKey())
    else globalThis.localStorage?.setItem(waitingKey(), JSON.stringify(runs.slice(-MAX_RUNS)))
  } catch (error) {
    // Private browsing, or storage full: the run is still shown this session.
    console.warn('Motius could not keep an unsaved run on this device.', error)
  }
}

/** Sends what is waiting; what the server takes stops waiting. */
async function sendWaiting(): Promise<readonly RunRecord[]> {
  const runs = waiting()
  if (runs.length === 0) return []
  const { items } = await api.addRuns(runs)
  // Every run sent has been answered: kept, or skipped as unreadable for good.
  setWaiting(waiting().filter((run) => !runs.some((sent) => sameRun(sent, run))))
  return items
}

export const useHistoryStore = create<HistoryState>((set) => ({
  runs: [],
  lessonsResetAt: null,

  load: async () => {
    // What this device kept before there were accounts joins this player's queue.
    const before = waiting(BEFORE_ACCOUNTS_KEY)
    if (before.length > 0) {
      setWaiting([...before, ...waiting()])
      try {
        globalThis.localStorage?.removeItem(BEFORE_ACCOUNTS_KEY)
      } catch {
        // Left for the next load to move again; the queue drops runs it holds twice.
      }
    }
    try {
      await sendWaiting()
    } catch (error) {
      console.error('Motius could not save runs kept on this device; it will try again.', error)
    }
    try {
      const { items, lessonsResetAt } = await api.listRuns()
      // Still waiting here: shown too, so nothing played disappears.
      const pending = waiting().map((run) => ({ ...run, id: `waiting-${run.at}-${run.key}` }))
      set({
        runs: [...items, ...pending].sort((a, b) => a.at - b.at).slice(-MAX_RUNS),
        lessonsResetAt,
      })
    } catch (error) {
      console.error('Motius could not load the practice history.', error)
    }
  },

  add: (run) => {
    const shown = { ...run, id: `waiting-${run.at}-${run.key}` }
    set((state) => ({ runs: [...state.runs, shown].slice(-MAX_RUNS) }))
    setWaiting([...waiting(), run])
    sendWaiting()
      .then((items) => {
        const kept = items.find((each) => sameRun(each, run))
        if (!kept) return
        set((state) => ({ runs: state.runs.map((each) => (each === shown ? kept : each)) }))
      })
      .catch((error: unknown) => {
        console.error('Motius could not save that run yet; it will try again.', error)
      })
  },

  reset: async (scope) => {
    const { lessonsResetAt } = await api.resetProgress(scope)
    if (scope === 'everything') {
      // Nothing waits to be sent either: it would bring back what was cleared.
      setWaiting([])
      set({ runs: [], lessonsResetAt })
    } else set({ lessonsResetAt })
  },
}))

/** One thing played, over all its runs. */
export interface Played {
  readonly key: string
  readonly latest: RunRecord
  readonly best: RunRecord
  readonly tries: number
}

/**
 * Each thing played once, from its runs: its latest run (for its name and how
 * to open it), its best (the highest accuracy, the latest of equals) and how
 * many times it has been played. The most recently played first.
 */
export function playedOf(runs: readonly RunRecord[]): Played[] {
  const byKey = new Map<string, { latest: RunRecord; best: RunRecord; tries: number }>()
  for (const run of runs) {
    const held = byKey.get(run.key)
    if (!held) byKey.set(run.key, { latest: run, best: run, tries: 1 })
    else {
      held.tries += 1
      if (run.at >= held.latest.at) held.latest = run
      if (run.accuracy >= held.best.accuracy) held.best = run
    }
  }
  return [...byKey.entries()]
    .map(([key, held]) => ({ key, ...held }))
    .sort((a, b) => b.latest.at - a.latest.at)
}

/** The best run of one thing, and how many times it has been played; null if never. */
export function bestOf(runs: readonly RunRecord[], key: string) {
  return playedOf(runs.filter((run) => run.key === key))[0] ?? null
}

/** A share as the percentage it is said as. */
export const percent = (share: number) => `${Math.round(share * 100)}%`

/**
 * The runs scores are worked out from: every run, less the lesson runs from
 * before the player last started the lessons over. The history (the Progress
 * page's totals and latest runs) keeps them all.
 */
export function scoredRuns(runs: readonly RunRecord[], lessonsResetAt: number | null) {
  return lessonsResetAt === null
    ? runs
    : runs.filter((run) => run.kind !== 'lesson' || run.at > lessonsResetAt)
}

/** `scoredRuns` of the store, kept the same array until either changes. */
export function useScoredRuns() {
  const runs = useHistoryStore((state) => state.runs)
  const since = useHistoryStore((state) => state.lessonsResetAt)
  return React.useMemo(() => scoredRuns(runs, since), [runs, since])
}
