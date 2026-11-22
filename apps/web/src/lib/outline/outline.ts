import { CATEGORIES, DESTINATIONS } from './categories'
import type { Category, Section } from './outline-types'

/**
 * Where everything in the app is, and the ways to look a place up in it. The
 * outline is data, in `categories.ts`; its shapes are in `outline-types.ts`.
 * Shared, because the stores, the frame and the features all find places in it.
 */

export * from './outline-types'
export { CATEGORIES, DESTINATIONS, HOME } from './categories'

export const findCategory = (id: string | null | undefined): Category | null =>
  [...CATEGORIES, ...DESTINATIONS].find((category) => category.id === id) ?? null

/**
 * The pages on the way down from a category, as far as the names lead to one.
 * A name that is no section stops it there, and so does a section that opens
 * something: that is not a page, and its address is its area's.
 */
export function pagesUnder(category: Category, ids: readonly string[]): Section[] {
  const pages: Section[] = []
  let sections: readonly Section[] | undefined = category.sections
  for (const id of ids) {
    const next: Section | undefined = sections?.find((section) => section.id === id)
    if (!next || next.opens) break
    pages.push(next)
    sections = next.sections
  }
  return pages
}

/** A lesson on a section's stage, and the way down to it. */
export interface Lesson {
  readonly lesson: Section
  /** The topics between the section and the lesson: none for a lesson right under it. */
  readonly topics: readonly Section[]
  /** The names from the section down to the lesson, as its address has them. */
  readonly path: readonly string[]
}

/**
 * A section's lessons, in the outline's order: whatever under it has nothing
 * under it in turn. A section with nothing under it is its own one lesson.
 */
export function lessonsOf(section: Section): Lesson[] {
  const walk = (sections: readonly Section[], topics: readonly Section[]): Lesson[] =>
    sections.flatMap((entry) =>
      entry.sections?.length
        ? walk(entry.sections, [...topics, entry])
        : [{ lesson: entry, topics, path: [section.id, ...topics.map((t) => t.id), entry.id] }],
    )
  return section.sections?.length
    ? walk(section.sections, [])
    : [{ lesson: section, topics: [], path: [section.id] }]
}

/**
 * Which of a section's lessons the way down names: that lesson, or the first
 * under the topic or the section it stops at.
 */
export const lessonAt = (lessons: readonly Lesson[], path: readonly string[]): number =>
  Math.max(
    0,
    lessons.findIndex((entry) => path.every((id, index) => entry.path[index] === id)),
  )

/** Whether there is anything at a place yet: something it opens, or sections of its own. */
export const isBuilt = (place: Category | Section): boolean =>
  Boolean(place.opens) || (place.sections?.length ?? 0) > 0

export const COMING_SOON = 'Coming soon'

/** A lesson that is written — it has an exercise to play — and its address. */
export interface WrittenLesson {
  readonly category: Category
  readonly path: readonly string[]
  /** Its address without the `#/`: the key its runs are saved under. */
  readonly key: string
}

/** Every written lesson, in the course's order: category by category, as Home lists them. */
export function writtenLessons(): WrittenLesson[] {
  return CATEGORIES.flatMap((category) =>
    category.sections
      .filter((section) => !section.opens)
      .flatMap(lessonsOf)
      .filter(({ lesson }) => lesson.exercise)
      .map(({ path }) => ({ category, path, key: [category.id, ...path].join('/') })),
  )
}
