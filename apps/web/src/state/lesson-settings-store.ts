import { create } from 'zustand'
import type { LessonSettings } from '@motius/shared'
import { api } from '@/lib/api'

/**
 * How each lesson opens — the labels on the keys, the view, the hands and the
 * tempo — where an admin has set it, by the lesson's address. Loaded once
 * signed in; an admin's change is saved to the server and kept here at once.
 */
interface LessonSettingsState {
  byLesson: Readonly<Record<string, LessonSettings>>
  loaded: boolean
  load: () => Promise<void>
  /** Saves a lesson's settings for everybody (admins only). */
  save: (settings: LessonSettings) => Promise<void>
}

export const useLessonSettingsStore = create<LessonSettingsState>((set) => ({
  byLesson: {},
  loaded: false,

  load: async () => {
    try {
      const { items } = await api.listLessonSettings()
      set({
        byLesson: Object.fromEntries(items.map((item) => [item.lessonKey, item])),
        loaded: true,
      })
    } catch (error) {
      // Lessons still open, as the player left things.
      console.error('Motius could not load how the lessons open.', error)
      set({ loaded: true })
    }
  },

  save: async (settings) => {
    const saved = await api.setLessonSettings(settings)
    set((state) => ({ byLesson: { ...state.byLesson, [saved.lessonKey]: saved } }))
  },
}))
