import { create } from 'zustand'
import { keepShow, keptShow } from './kept-choice'
import { useViewStore } from './view-store'

/**
 * The reminder of which hand is which color — green the right, blue the left —
 * shown when the music is about to start falling: Start or Play pressed with
 * the stage on falling notes, the only view that colors the hands. What was
 * pressed waits until it is closed, so no note falls while it is being read.
 *
 * It shows every time until "Show next time" is unticked, kept on this device,
 * as the lessons' introductions keep theirs (`lesson-intros.ts`). The Hands
 * reminder switch in Settings turns it back on.
 */
const HIDDEN_KEY = 'motius.hands-reminder-hidden'

interface HandsReminderState {
  /** What Start or Play was going to do, waiting on the reminder; null when it is not up. */
  readonly waiting: (() => void) | null
  /**
   * Whether it shows before the notes fall: one value for the dialog's "Show
   * next time" and the Hands reminder switch in Settings, so either undoes the other.
   */
  readonly show: boolean
  setShow: (show: boolean) => void
}

export const useHandsReminder = create<HandsReminderState>((set) => ({
  waiting: null,
  show: keptShow(HIDDEN_KEY),
  setShow: (show) => {
    keepShow(HIDDEN_KEY, show)
    set({ show })
  },
}))

/** Run `action` now, or after the reminder, when the notes are about to fall and it is wanted. */
export function remindThenRun(action: () => void) {
  if (useViewStore.getState().stageView !== 'falling' || !useHandsReminder.getState().show) action()
  else useHandsReminder.setState({ waiting: action })
}

/** The reminder closed: keep the box's answer and go on with what was pressed. */
export function closeHandsReminder(showNext: boolean) {
  const { waiting, setShow } = useHandsReminder.getState()
  setShow(showNext)
  useHandsReminder.setState({ waiting: null })
  waiting?.()
}
