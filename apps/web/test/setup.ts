import { LESSON_EXERCISES, loadLessons, loadPracticeBuilder, PRACTICE_KINDS } from '@motius/shared'

/**
 * What jsdom does not have and every test needs alike.
 *
 * `matchMedia`: no media query matches, as on a wide screen with a mouse and
 * motion allowed. A test that needs one to match sets its own over this one.
 */
globalThis.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
  dispatchEvent: () => false,
  onchange: null,
})) as unknown as typeof globalThis.matchMedia

// Pointer capture: a drag keeps its element, which jsdom has no notion of.
Element.prototype.setPointerCapture ??= () => {}
Element.prototype.releasePointerCapture ??= () => {}

/*
 * The account's own data, which the app loads once someone is signed in:
 * empty, as for a new player, so a test of a screen does not depend on a
 * server. A test about this data stubs these itself, over these.
 */
import { beforeEach, vi } from 'vitest'
import { api } from '@/lib/api'

beforeEach(() => {
  // Sound: jsdom has no media playback. Played, it plays at once and silently;
  // a test about playing spies on these itself.
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    this.dispatchEvent(new Event('playing'))
    return Promise.resolve()
  })
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    this.dispatchEvent(new Event('pause'))
  })
  vi.spyOn(api, 'listRuns').mockResolvedValue({ items: [], lessonsResetAt: null })
  vi.spyOn(api, 'addRuns').mockImplementation(async (runs) => ({
    items: runs.map((run, index) => ({ ...run, id: `test-${run.at}-${index}` })),
    skipped: 0,
  }))
  vi.spyOn(api, 'listLessonSettings').mockResolvedValue({ items: [] })
  vi.spyOn(api, 'goals').mockResolvedValue({ weeklyGoal: null, seenBadges: [] })
  vi.spyOn(api, 'setWeeklyGoal').mockImplementation(async (weeklyGoal) => ({
    weeklyGoal,
    seenBadges: [],
  }))
  vi.spyOn(api, 'seeBadges').mockImplementation(async (badges) => ({
    weeklyGoal: null,
    seenBadges: [...badges],
  }))
})

// Lessons and each practice area's builder are fetched when first opened.
// Every test here may open any of them and expects it on the keys at once, so
// all are loaded before any test module (and its stores) is: the loading itself
// is tested where it lives (`lesson-loading.test.ts`, `practice-builders.test.ts`).
await Promise.all([
  ...LESSON_EXERCISES.map(loadLessons),
  ...PRACTICE_KINDS.map(loadPracticeBuilder),
])
