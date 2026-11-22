import * as React from 'react'
import type { KeyLabels, StageView } from '@motius/shared'
import { findCategory, lessonAt, lessonsOf, pagesUnder } from '@/lib/outline/outline'
import { useLearningStore } from '@/state/learning-store'
import { useLessonSettingsStore } from '@/state/lesson-settings-store'
import { usePageStore } from '@/state/page-store'
import { useViewStore } from '@/state/view-store'

/**
 * The lesson on the stage: its address (as its settings and its history know
 * it), the lesson, and the category it is under. Null off a lesson.
 */
export function lessonUp() {
  const { page, category: id, path } = usePageStore.getState()
  if (page !== 'lesson') return null
  const category = findCategory(id)
  const section = category ? pagesUnder(category, path)[0] : undefined
  if (!category || !section) return null
  const lessons = lessonsOf(section)
  const lesson = lessons[lessonAt(lessons, path)]
  return lesson ? { key: [category.id, ...lesson.path].join('/'), lesson, category } : null
}

/** What a lesson's settings can change, as the player had it. */
interface Own {
  keyLabels: KeyLabels
  stageView: StageView
  hands: boolean
}

const ownNow = (): Own => {
  const { stageView, hands } = useViewStore.getState()
  return { keyLabels: useLearningStore.getState().keyLabels, stageView, hands }
}

/**
 * Opens each lesson as an admin has set it, and gives the player their own
 * back when they leave.
 *
 * What an admin sets is where a lesson starts, not a rule: the player can
 * change any of it once in. So the player's own choices are noted on the way
 * into the lessons, each lesson opens with its settings or else with those,
 * and on the way out whatever the lesson set is put back as it was — unless
 * the player changed it themselves while in, which they meant to keep.
 *
 * The view and the hands are set here without being saved as the player's
 * preference: a lesson's choice is not theirs.
 */
export function useLessonSettings() {
  React.useEffect(() => {
    void useLessonSettingsStore.getState().load()

    let own: Own | null = null
    /** What the lesson up set, to tell it from a change the player made. */
    let applied: Partial<Own> = {}
    let up: string | null = null

    const restore = () => {
      if (!own) return
      const now = ownNow()
      if (applied.keyLabels !== undefined && now.keyLabels === applied.keyLabels) {
        useLearningStore.getState().setKeyLabels(own.keyLabels)
      }
      const view: Partial<Own> = {}
      if (applied.stageView !== undefined && now.stageView === applied.stageView) {
        view.stageView = own.stageView
      }
      if (applied.hands !== undefined && now.hands === applied.hands) view.hands = own.hands
      if (Object.keys(view).length > 0) useViewStore.setState(view)
      applied = {}
    }

    const follow = (force = false) => {
      const key = lessonUp()?.key ?? null
      if (key === up && !force) return
      if (key === null) {
        restore()
        own = null
        up = null
        return
      }
      restore()
      own ??= ownNow()
      up = key
      const settings = useLessonSettingsStore.getState().byLesson[key]
      const next: Partial<Own> = {}
      if (settings?.keyLabels) next.keyLabels = settings.keyLabels
      if (settings?.stageView) next.stageView = settings.stageView
      if (settings && settings.hands !== null) next.hands = settings.hands
      if (next.keyLabels) useLearningStore.getState().setKeyLabels(next.keyLabels)
      const view = { stageView: next.stageView, hands: next.hands }
      if (view.stageView !== undefined || view.hands !== undefined) {
        useViewStore.setState(
          Object.fromEntries(Object.entries(view).filter(([, value]) => value !== undefined)),
        )
      }
      // The tempo is the lesson's own already (set with its exercise), unless set here.
      if (settings?.bpm) useLearningStore.getState().setTargetBpm(settings.bpm)
      applied = next
    }

    follow()
    const stopPages = usePageStore.subscribe(() => follow())
    // Settings that arrive, or that an admin changes, apply to the lesson up.
    const stopSettings = useLessonSettingsStore.subscribe((state, before) => {
      if (state.byLesson !== before.byLesson) follow(true)
    })
    return () => {
      stopPages()
      stopSettings()
      restore()
    }
  }, [])
}
