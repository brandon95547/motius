import * as React from 'react'
import { create } from 'zustand'
import { findProgressionType, type ProgressionType } from '@motius/shared'
import {
  findCategory,
  lessonAt,
  lessonsOf,
  pagesUnder,
  writtenLessons,
  type Category,
  type CategoryId,
  type Section,
} from '@/lib/outline/outline'
import { AVAILABLE_TOPICS, useLearningStore, type LearningTopic } from './learning-store'
import { bestOf, scoredRuns, useHistoryStore } from './history-store'
import { panelActions, usePanelStore } from './panel-store'
import { useSongStore } from './song-store'

/**
 * Which page is up: the dashboard, one of the pages under it, or an area.
 *
 * The address bar is the source of truth — `#/scales`, `#/songs`, and nothing
 * (or `#/`) for the dashboard — so Back leaves an area for the page it was
 * opened from the way it would leave any page, and a reload lands where the
 * player was. A hash rather than a path because nothing on the server has to
 * know about it.
 *
 * Between the dashboard and the areas is a category's page — `#/chords-and-harmony`
 * — which lists its sections, or, where it is not built yet, says so:
 * `#/lessons`, `#/progress`. A section opens onto the stage, with its lessons
 * beside the keys, and the address is the way down to the lesson that is up,
 * however far that is:
 * `#/piano-foundations/keyboard-layout/white-and-black-keys/two-black-key-groups`.
 * An address that stops at the section, or at a topic in it, is its first
 * lesson. A section that opens an area has no stage of its own; it opens the
 * area, at the address that area has always had.
 *
 * An area with types of its own carries the type as a second step —
 * `#/progressions/cadences` — for the same reason: a reload should land on the
 * kind of progression that was open, not on whichever comes first. The area's
 * bare address still opens it, on the type it was last left on.
 *
 * Which area is open is still the learning store's `topic`, and which type its
 * `progressionType`; this only says whether we are in it.
 */
export type Page = 'dashboard' | 'category' | 'lesson' | 'area' | 'admin'

interface PageState {
  page: Page
  /** The category whose page is up, or that the lesson that is up is under. */
  category: CategoryId | null
  /** The way down from the category to the lesson that is up, as far as the address names it. Empty on any other page. */
  path: readonly string[]
}

/** An area: somewhere to play. */
interface AreaPlace {
  readonly kind: 'area'
  readonly area: LearningTopic
  /** The type of progression the address names, where it names one. */
  readonly progression: ProgressionType | null
}

/** A category's page, or a lesson on the stage of a section under one. */
interface IndexPlace {
  readonly kind: 'category' | 'lesson'
  readonly category: CategoryId
  readonly path: readonly string[]
}

/** The admin's page: how each lesson opens. Only an admin is shown it. */
interface AdminPlace {
  readonly kind: 'admin'
}

type Place = AreaPlace | IndexPlace | AdminPlace

/** The admin's page's address. */
export const ADMIN_ADDRESS = '#/admin'

/** The place a hash names, if it names one. */
function placeIn(hash: string): Place | null {
  const [name, ...rest] = hash.replace(/^#\/?/, '').split('/')
  if (name === 'admin' && rest.length === 0) return { kind: 'admin' }
  // An area first: Songs is an area and a place in the bar, and its address is the area's.
  const area = AVAILABLE_TOPICS.find((topic) => topic === name)
  if (area) {
    return {
      kind: 'area',
      area,
      progression: area === 'progressions' ? findProgressionType(rest[0]) : null,
    }
  }
  const category = findCategory(name)
  // A place that is itself an area has no page: its address is its area's.
  if (!category || category.opens) return null
  // As far down as the address names a place. A section that opens an area
  // has no stage — its address is its area's — so named here it is the page above it.
  const path = pagesUnder(category, rest).map((section) => section.id)
  return { kind: path.length > 0 ? 'lesson' : 'category', category: category.id, path }
}

/** The song chooser belongs to Songs, and leaving the area puts it away. */
function shutSongChooser() {
  if (usePanelStore.getState().panel === 'library') panelActions.close()
}

/** Puts the learning store where an address says to be. */
function enter(place: AreaPlace) {
  const learning = useLearningStore.getState()
  if (place.progression) learning.setProgressionType(place.progression)
  if (learning.topic !== place.area) learning.setTopic(place.area)
  // Songs opens on its chooser, every time it is entered: the area is about
  // one song, and arriving is when you say which. A song already open is
  // marked in the list and is still there when the chooser is closed.
  if (place.area === 'songs') panelActions.open('library')
  else shutSongChooser()
}

/**
 * Puts a lesson on the keys: its exercise, where it is written, or none — free
 * play, with nothing lit and the staff writing what is played.
 */
function enterLesson(place: IndexPlace) {
  const category = findCategory(place.category)
  const section = category && pagesUnder(category, place.path)[0]
  const lessons = section ? lessonsOf(section) : []
  const lesson = lessons[lessonAt(lessons, place.path)]?.lesson
  const learning = useLearningStore.getState()
  learning.setLesson(lesson?.exercise ?? null)
  if (learning.topic !== 'lesson') learning.setTopic('lesson')
}

// Read before the first render, so a reload on an area does not flash the
// dashboard while an effect catches up.
const initialPlace = placeIn(globalThis.location?.hash ?? '')
if (initialPlace?.kind === 'area') enter(initialPlace)
if (initialPlace?.kind === 'lesson') enterLesson(initialPlace)

/** What the store says for a place: which page, and whose. */
const stateFor = (place: Place | null): PageState =>
  !place
    ? { page: 'dashboard', category: null, path: [] }
    : place.kind === 'area' || place.kind === 'admin'
      ? { page: place.kind, category: null, path: [] }
      : { page: place.kind, category: place.category, path: place.path }

export const usePageStore = create<PageState>(() => stateFor(initialPlace))

function apply(hash: string) {
  const place = placeIn(hash)
  if (place?.kind !== 'area') {
    // Leaving an area stops what it was playing. Left alone, the song's own
    // engine unmounts but the song still says it is playing, and it would set
    // off again by itself the moment the player came back.
    if (useSongStore.getState().playing) useSongStore.getState().setPlaying(false)
    shutSongChooser()
    if (place?.kind === 'lesson') enterLesson(place)
    usePageStore.setState(stateFor(place))
    return
  }
  enter(place)
  usePageStore.setState(stateFor(place))
}

function go(hash: string) {
  // Assigning the hash it already has fires nothing, so apply it by hand.
  if (globalThis.location.hash === hash) apply(hash)
  else globalThis.location.hash = hash
}

const openArea = (topic: LearningTopic) =>
  go(
    topic === 'progressions'
      ? `#/progressions/${useLearningStore.getState().progressionType}`
      : `#/${topic}`,
  )
/** One of Progressions' types — which is also how the area's own menu changes it. */
const openProgression = (type: ProgressionType) => go(`#/progressions/${type}`)

/** The address of a page under the dashboard: a category, and the way down from it. */
const addressOf = (category: Category, path: readonly Section[] = []) =>
  `#/${[category, ...path].map((place) => place.id).join('/')}`

/** Goes to what a card is for: its area or its panel, or the page it has at its address. */
function open(place: Category | Section, address: string) {
  const { opens } = place
  if (!opens) go(address)
  else if (opens.kind === 'panel') panelActions.open(opens.panel)
  else if (opens.kind === 'next-lesson') openNextLesson()
  else if (opens.progression) openProgression(opens.progression)
  else openArea(opens.topic)
}

/**
 * Where the player left off: the first written lesson, in the course's order,
 * with no scored run — or the first lesson of all, once every one is done.
 */
function openNextLesson() {
  const { runs, lessonsResetAt } = useHistoryStore.getState()
  const scored = scoredRuns(runs, lessonsResetAt)
  const lessons = writtenLessons()
  const next = lessons.find((lesson) => !bestOf(scored, lesson.key)) ?? lessons[0]
  if (next) go(`#/${next.key}`)
}

export const pageActions = {
  openDashboard: () => go('#/'),
  /** The admin's page: how each lesson opens. */
  openAdmin: () => go(ADMIN_ADDRESS),
  /** A category: its page — of sections, or saying it is to come — or, Songs, the area it is. */
  openCategory: (category: Category) => open(category, addressOf(category)),
  /**
   * A section, by the way down to it from its category: what it is for, or
   * its stage, on the lesson the way down names — the first, if it names none.
   */
  openSection: (category: Category, path: readonly Section[]) =>
    open(path[path.length - 1]!, addressOf(category, path)),
  /** A lesson on its section's stage, by the names from the section down to it. */
  openLesson: (category: Category, path: readonly string[]) =>
    go(`#/${[category.id, ...path].join('/')}`),
  openArea,
  openProgression,
}

/** Follows the address bar. Mounted once, by the shell. */
export function usePageSync() {
  React.useEffect(() => {
    const follow = () => apply(globalThis.location.hash)
    globalThis.addEventListener('hashchange', follow)
    return () => globalThis.removeEventListener('hashchange', follow)
  }, [])
}
