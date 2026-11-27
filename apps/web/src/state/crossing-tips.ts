import { create } from 'zustand'
import type { StepCrossing } from '@motius/shared'
import { keepShow, keptShow } from './kept-choice'
import { useLearningStore } from './learning-store'

/**
 * How to cross — the thumb under, or a finger over the thumb — shown when a
 * lesson's run reaches a key that needs it, before it is played
 * (`StepCrossing`, which the lesson marks). Only in Lesson mode, where the run
 * waits for the key: Listen plays it, and Practice keeps time.
 *
 * Each crossing shows once a run, until "Show next time" is unticked, kept on
 * this device; the Crossing tips switch in Settings turns it back on.
 *
 * Asked for again: during a run, the lesson's info button opens the latest tip
 * the run has reached, the part the player is on, rather than the lesson's
 * introduction (the user, 2026-11-23).
 */
const HIDDEN_KEY = 'motius.crossing-tips-hidden'

interface CrossingTipsState {
  /** Whether a crossing stops the run to show how. */
  readonly show: boolean
  setShow: (show: boolean) => void
  /** The crossing last closed, by its run and step, so it does not show again in that run. */
  readonly closed: string | null
  /** A tip opened again from the info button, if one is open. */
  readonly asked: StepCrossing | null
}

export const useCrossingTips = create<CrossingTipsState>((set) => ({
  show: keptShow(HIDDEN_KEY),
  setShow: (show) => {
    keepShow(HIDDEN_KEY, show)
    set({ show })
  },
  closed: null,
  asked: null,
}))

/** This run's step, as the key a closed tip is remembered by. */
const stepKey = (startedAt: number | null, step: number) => `${startedAt}:${step}`

/** The crossing the run is waiting on, where its tip is wanted; null otherwise. */
export function useCrossingDue(): StepCrossing | null {
  const show = useCrossingTips((state) => state.show)
  const closed = useCrossingTips((state) => state.closed)
  return useLearningStore((state) => {
    const { session, exercise } = state
    if (!show || state.topic !== 'lesson' || state.mode !== 'learn') return null
    if (session.status !== 'running') return null
    if (closed === stepKey(session.startedAt, session.stepIndex)) return null
    return exercise?.steps[session.stepIndex]?.crossing ?? null
  })
}

/** The tip on screen: the one the run is waiting on, or one asked for again. */
export function useCrossingTip(): { crossing: StepCrossing | null; asked: boolean } {
  const due = useCrossingDue()
  // Only while the run it was asked in is going.
  const asked = useCrossingTips((state) => state.asked)
  const running = useLearningStore((state) => state.session.status === 'running')
  const again = running ? asked : null
  return { crossing: due ?? again, asked: due === null && again !== null }
}

/** The latest tip the run has reached, up to and on the step it is on; null before the first, or with no run going. */
export function reachedCrossingTip(): StepCrossing | null {
  const { session, exercise } = useLearningStore.getState()
  if (session.status !== 'running' || !exercise) return null
  for (let step = Math.min(session.stepIndex, exercise.steps.length - 1); step >= 0; step--) {
    const crossing = exercise.steps[step]?.crossing
    if (crossing) return crossing
  }
  return null
}

/** Open a tip again, from the info button. */
export const askCrossingTip = (crossing: StepCrossing) =>
  useCrossingTips.setState({ asked: crossing })

/** The tip closed: keep the box's answer, and let the run go on to the key. */
export function closeCrossingTip(showNext: boolean) {
  const { session } = useLearningStore.getState()
  useCrossingTips.getState().setShow(showNext)
  useCrossingTips.setState({
    closed: stepKey(session.startedAt, session.stepIndex),
    asked: null,
  })
}
