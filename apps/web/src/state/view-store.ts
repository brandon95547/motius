import { create } from 'zustand'
import { STAGE_VIEWS, STANDARD_RANGES, type StageView } from '@motius/shared'
import {
  DEFAULT_SPAN,
  shiftWindow,
  windowForSpan,
  type KeyboardWindow,
} from '@/lib/keyboard-layout'

/**
 * How the instrument is being looked at: which stretch of the keyboard is on
 * screen, whether it chases the player, and what is drawn above the keys.
 *
 * These used to be the keyboard panel's own React state, next to the toolbar
 * that set them. The toolbar has moved into the Settings drawer, which mounts
 * only while it is open — and state held by the panel could not be reached
 * from there, while state held by the drawer would be thrown away every time
 * it closed. So it lives here, where both the keys and the drawer can see it
 * and neither owns it.
 *
 * `autoSpanLabel` is the one thing the keyboard reports back rather than being
 * told: what Auto has resolved to at the current width, so the drawer can say
 * "Auto — 61 key" instead of an unexplained "Auto".
 */

export const AUTO_SPAN = 'auto'

/**
 * What the stage shows above the keys: the music written out, or the notes
 * falling toward the keys that play them. Chosen from the bar, and kept: on
 * every screen, and the next time the app is opened.
 */
// One list of views, in the contract, which lesson settings use too.
export { STAGE_VIEWS, type StageView }

const STAGE_VIEW_KEY = 'motius.stage-view'
const HANDS_KEY = 'motius.hands'
/** Where the hands were kept when only songs had them. Read once, so a choice made then holds. */
const OLD_HANDS_KEY = 'motius.songs.hands'

function storedHands(): boolean {
  try {
    const value =
      globalThis.localStorage?.getItem(HANDS_KEY) ?? globalThis.localStorage?.getItem(OLD_HANDS_KEY)
    return value === 'on'
  } catch {
    return false
  }
}

function storedStageView(): StageView {
  try {
    const value = globalThis.localStorage?.getItem(STAGE_VIEW_KEY)
    return STAGE_VIEWS.find((view) => view === value) ?? 'staff'
  } catch {
    // Private browsing, or storage disabled: the staff, as the app first opens.
    return 'staff'
  }
}

interface ViewState {
  /** A span id from KEYBOARD_SPANS, or AUTO_SPAN. */
  spanId: string
  follow: boolean
  stageView: StageView
  /** See-through hands over the keys, playing the music's fingering where it has one. */
  hands: boolean
  window: KeyboardWindow
  autoSpanLabel: string

  setSpanId: (spanId: string) => void
  setFollow: (follow: boolean) => void
  setStageView: (view: StageView) => void
  setHands: (on: boolean) => void
  setWindow: (update: KeyboardWindow | ((current: KeyboardWindow) => KeyboardWindow)) => void
  shiftOctave: (octaves: number) => void
  setAutoSpanLabel: (label: string) => void
}

export const useViewStore = create<ViewState>((set) => ({
  spanId: AUTO_SPAN,
  follow: true,
  stageView: storedStageView(),
  hands: storedHands(),
  window: windowForSpan(DEFAULT_SPAN, STANDARD_RANGES[DEFAULT_SPAN.keyCount].low),
  autoSpanLabel: DEFAULT_SPAN.label,

  setSpanId: (spanId) => set({ spanId }),
  setFollow: (follow) => set({ follow }),
  setStageView: (stageView) => {
    try {
      globalThis.localStorage?.setItem(STAGE_VIEW_KEY, stageView)
    } catch {
      // Not kept past this visit, which is all that is lost.
    }
    set({ stageView })
  },
  setHands: (hands) => {
    try {
      globalThis.localStorage?.setItem(HANDS_KEY, hands ? 'on' : 'off')
    } catch {
      // Not kept past this visit, which is all that is lost.
    }
    set({ hands })
  },
  setWindow: (update) =>
    set((state) => ({ window: typeof update === 'function' ? update(state.window) : update })),
  shiftOctave: (octaves) => set((state) => ({ window: shiftWindow(state.window, octaves) })),
  setAutoSpanLabel: (autoSpanLabel) => set({ autoSpanLabel }),
}))
