import * as React from 'react'
import { create } from 'zustand'
import { findProgressionType, type ProgressionType } from '@motius/shared'
import {
  findCategory,
  findSection,
  type Category,
  type CategoryId,
  type Section,
} from '@/features/areas/areas'
import { AVAILABLE_TOPICS, useLearningStore, type LearningTopic } from './learning-store'
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
 * Between the dashboard and the areas there are two kinds of page. A category
 * — `#/explore` — lists its sections. A section that is not built yet has a
 * page that says so, under its category: `#/practice/sight-reading`. A section
 * that is built has no page of its own; it opens the area it is for, at the
 * address that area has always had.
 *
 * An area with types of its own carries the type as a second step —
 * `#/progressions/cadences` — for the same reason: a reload should land on the
 * kind of progression that was open, not on whichever comes first. The area's
 * bare address still opens it, on the type it was last left on.
 *
 * Which area is open is still the learning store's `topic`, and which type its
 * `progressionType`; this only says whether we are in it.
 */
export type Page = 'dashboard' | 'category' | 'section' | 'area'

interface PageState {
  page: Page
  /** The category whose page is up, or whose section's is. */
  category: CategoryId | null
  /** The section whose page is up: one that is not built yet. */
  section: string | null
}

/** An area: somewhere to play. */
interface AreaPlace {
  readonly kind: 'area'
  readonly area: LearningTopic
  /** The type of progression the address names, where it names one. */
  readonly progression: ProgressionType | null
}

/** A page of the dashboard's: a category, or a section that is still to come. */
interface IndexPlace {
  readonly kind: 'category' | 'section'
  readonly category: CategoryId
  readonly section: string | null
}

type Place = AreaPlace | IndexPlace

/** The place a hash names, if it names one. */
function placeIn(hash: string): Place | null {
  const [name, second] = hash.replace(/^#\/?/, '').split('/')
  // An area first: Songs is an area and a category, and its address is the area's.
  const area = AVAILABLE_TOPICS.find((topic) => topic === name)
  if (area) {
    return {
      kind: 'area',
      area,
      progression: area === 'progressions' ? findProgressionType(second) : null,
    }
  }
  const category = findCategory(name)
  if (!category || category.sections.length === 0) return null
  const section = findSection(category, second)
  // A section that is built is not a page: its address is its area's. Named
  // here, it is the category it belongs to.
  return section && !section.opens
    ? { kind: 'section', category: category.id, section: section.id }
    : { kind: 'category', category: category.id, section: null }
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

// Read before the first render, so a reload on an area does not flash the
// dashboard while an effect catches up.
const initialPlace = placeIn(globalThis.location?.hash ?? '')
if (initialPlace?.kind === 'area') enter(initialPlace)

/** What the store says for a place: which page, and whose. */
const stateFor = (place: Place | null): PageState =>
  !place
    ? { page: 'dashboard', category: null, section: null }
    : place.kind === 'area'
      ? { page: 'area', category: null, section: null }
      : { page: place.kind, category: place.category, section: place.section }

export const usePageStore = create<PageState>(() => stateFor(initialPlace))

function apply(hash: string) {
  const place = placeIn(hash)
  if (place?.kind !== 'area') {
    // Leaving an area stops what it was playing. Left alone, the song's own
    // engine unmounts but the song still says it is playing, and it would set
    // off again by itself the moment the player came back.
    if (useSongStore.getState().playing) useSongStore.getState().setPlaying(false)
    shutSongChooser()
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

/** Goes to what a card is for: its area or its panel, or the page that says it is to come. */
function open(place: Category | Section, address: string) {
  const { opens } = place
  if (!opens) go(address)
  else if (opens.kind === 'panel') panelActions.open(opens.panel)
  else if (opens.progression) openProgression(opens.progression)
  else openArea(opens.topic)
}

export const pageActions = {
  openDashboard: () => go('#/'),
  /** A category: its page of sections, or — Songs — the area it is. */
  openCategory: (category: Category) => open(category, `#/${category.id}`),
  /** A section: what it is for, or the page that says it is still to come. */
  openSection: (category: Category, section: Section) =>
    open(section, `#/${category.id}/${section.id}`),
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
