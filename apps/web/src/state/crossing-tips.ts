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
 */
const HIDDEN_KEY = 'motius.crossing-tips-hidden'

interface CrossingTipsState {
  /** Whether a crossing stops the run to show how. */
  readonly show: boolean
  setShow: (show: boolean) => void
  /** The crossing last closed, by its run and step, so it does not show again in that run. */
  readonly closed: string | null
}

export const useCrossingTips = create<CrossingTipsState>((set) => ({
  show: keptShow(HIDDEN_KEY),
  setShow: (show) => {
    keepShow(HIDDEN_KEY, show)
    set({ show })
  },
  closed: null,
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

/** The tip closed: keep the box's answer, and let the run go on to the key. */
export function closeCrossingTip(showNext: boolean) {
  const { session } = useLearningStore.getState()
  useCrossingTips.getState().setShow(showNext)
  useCrossingTips.setState({ closed: stepKey(session.startedAt, session.stepIndex) })
}
