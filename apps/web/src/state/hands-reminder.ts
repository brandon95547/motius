import { create } from 'zustand'
import { useViewStore } from './view-store'

/**
 * The reminder of which hand is which color — green the right, blue the left —
 * shown when the music is about to start falling: Start or Play pressed with
 * the stage on falling notes, the only view that colors the hands. What was
 * pressed waits until it is closed, so no note falls while it is being read.
 *
 * It shows every time until "Show next time" is unticked, kept on this device,
 * as the lessons' introductions keep theirs (`lesson-intros.ts`).
 */
const HIDDEN_KEY = 'motius.hands-reminder-hidden'

export function handsReminderHidden(): boolean {
  try {
    return globalThis.localStorage?.getItem(HIDDEN_KEY) === 'true'
  } catch {
    return false
  }
}

function keepShowNext(show: boolean) {
  try {
    if (show) globalThis.localStorage?.removeItem(HIDDEN_KEY)
    else globalThis.localStorage?.setItem(HIDDEN_KEY, 'true')
  } catch {
    // Storage off: it shows again next time, which is what the box says by default.
  }
}

interface HandsReminderState {
  /** What Start or Play was going to do, waiting on the reminder; null when it is not up. */
  readonly waiting: (() => void) | null
}

export const useHandsReminder = create<HandsReminderState>(() => ({ waiting: null }))

/** Run `action` now, or after the reminder, when the notes are about to fall and it is wanted. */
export function remindThenRun(action: () => void) {
  if (useViewStore.getState().stageView !== 'falling' || handsReminderHidden()) action()
  else useHandsReminder.setState({ waiting: action })
}

/** The reminder closed: keep the box's answer and go on with what was pressed. */
export function closeHandsReminder(showNext: boolean) {
  const { waiting } = useHandsReminder.getState()
  keepShowNext(showNext)
  useHandsReminder.setState({ waiting: null })
  waiting?.()
}
