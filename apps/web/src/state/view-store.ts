import { create } from 'zustand'
import { STANDARD_RANGES } from '@motius/shared'
import {
  DEFAULT_SPAN,
  shiftWindow,
  windowForSpan,
  type KeyboardWindow,
} from '@/features/keyboard/keyboard-layout'

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
 * What the stage shows above the keys: the music written out, the notes
 * falling toward the keys that play them, or nothing.
 */
export const STAGE_VIEWS = ['staff', 'falling', 'off'] as const
export type StageView = (typeof STAGE_VIEWS)[number]

interface ViewState {
  /** A span id from KEYBOARD_SPANS, or AUTO_SPAN. */
  spanId: string
  follow: boolean
  stageView: StageView
  window: KeyboardWindow
  autoSpanLabel: string

  setSpanId: (spanId: string) => void
  setFollow: (follow: boolean) => void
  setStageView: (view: StageView) => void
  setWindow: (update: KeyboardWindow | ((current: KeyboardWindow) => KeyboardWindow)) => void
  shiftOctave: (octaves: number) => void
  setAutoSpanLabel: (label: string) => void
}

export const useViewStore = create<ViewState>((set) => ({
  spanId: AUTO_SPAN,
  follow: true,
  stageView: 'staff',
  window: windowForSpan(DEFAULT_SPAN, STANDARD_RANGES[DEFAULT_SPAN.keyCount].low),
  autoSpanLabel: DEFAULT_SPAN.label,

  setSpanId: (spanId) => set({ spanId }),
  setFollow: (follow) => set({ follow }),
  setStageView: (stageView) => set({ stageView }),
  setWindow: (update) =>
    set((state) => ({ window: typeof update === 'function' ? update(state.window) : update })),
  shiftOctave: (octaves) => set((state) => ({ window: shiftWindow(state.window, octaves) })),
  setAutoSpanLabel: (autoSpanLabel) => set({ autoSpanLabel }),
}))
