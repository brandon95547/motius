import type { LessonExerciseId, ProgressionType } from '@motius/shared'
import type { LearningTopic } from '@/state/learning-store'

/**
 * Where everything in the app is: nine categories, and what is in each.
 *
 * The nine are the mock's (new dashboard.png, 2026-10-12), in its order and
 * its words, and they took the place of the four there were — Songs, Lessons,
 * Explore, Practice. Each of the nine is laid out from the outline written for
 * it, and holds that and nothing else. The practice areas, which were filed
 * under them before the outlines were written, are in the bar's Practice.
 *
 * The dashboard, the pages and stages under it and the bar along the bottom
 * are all drawn from this one table, so they cannot disagree about what a
 * place is called, what it looks like, where it is or whether it is built yet.
 *
 * What is in a category is its sections, and a section may have sections of
 * its own, as far down as the subject goes: Piano Foundations has Keyboard
 * Layout, which has White and black keys, which has its three lessons.
 *
 * Only a category is a page of cards. A section opens onto the stage, with the
 * keyboard to play on and its lessons in a list beside it, the topics under it
 * as the list's chapters: a player is two choices from the dashboard to the
 * keys, however deep the outline goes. Each lesson keeps an address of its
 * own, which opens the stage on it.
 *
 * A section that is built says what it opens: one of the practice areas, or a
 * panel. A category with nothing in it has a page of its own that says so —
 * the place is there, with its name on it, before what goes in it is. No
 * lesson is written yet, and the list says so of each.
 *
 * Five more places are at the top and on no card: the ones the bar along the
 * bottom leads to. Songs is the area, and Practice has the other practice
 * areas. Lessons, Progress and Search are not built, so each is a page that
 * says so.
 */

/**
 * The card accents there are. A card is given one of these; there is no
 * color of its own to give it. The first six are named for the areas they
 * were first given to, and the last three for what they are.
 */
export type Accent =
  | 'songs'
  | 'scales'
  | 'chords'
  | 'arpeggios'
  | 'progressions'
  | 'exercises'
  | 'rose'
  | 'teal'
  | 'pink'

export type CategoryId =
  | 'piano-foundations'
  | 'music-notation-and-reading'
  | 'rhythm-and-timing'
  | 'scales-intervals-and-keys'
  | 'chords-and-harmony'
  | 'piano-technique'
  | 'musical-expression'
  | 'musical-structure-and-styles'
  | 'practice-and-repertoire'
  // On no card: the bar along the bottom leads to these.
  | 'lessons'
  | 'songs'
  | 'practice'
  | 'progress'
  | 'search'

/** Drawn like the icon set's own: square, in the current color, at the size asked for. */
type PlaceIcon = React.ComponentType<{ size?: number }>

/** What a card opens, where what it is for has been built. */
export type Opens =
  | {
      readonly kind: 'area'
      readonly topic: LearningTopic
      /** The type of progression, where the area is Progressions. */
      readonly progression?: ProgressionType
    }
  | { readonly kind: 'panel'; readonly panel: 'fundamentals' }
  /** The player's next unfinished lesson, in the course's order. */
  | { readonly kind: 'next-lesson' }

interface Place {
  readonly label: string
  readonly icon: PlaceIcon
  /** A line about it, for its card. A lesson has only its name so far. */
  readonly description?: string
  readonly accent: Accent
  /** Absent for a place that is a page: of its sections, or saying it is to come. */
  readonly opens?: Opens
}

/**
 * A written lesson's introduction: what it asks, how to play it a line at a
 * time, and one thing to keep in mind. Each kept to a sentence or two.
 */

export interface Section extends Place {
  /** Its name in the address: `#/chords-and-harmony/progressions`. */
  readonly id: string
  /**
   * What a lesson plays on the stage, once it is written. Its notes and its
   * introduction are content, loaded with its section (`loadLessons`).
   */
  readonly exercise?: LessonExerciseId
  /** What is under it, where it is a page of cards itself. */
  readonly sections?: readonly Section[]
}

export interface Category extends Place {
  readonly id: CategoryId
  readonly description: string
  /** None for a place that is itself an area — Songs — or that is not built. */
  readonly sections: readonly Section[]
}

/** A name as it is written in an address: `Fingers & Hand Positions` is `fingers-and-hand-positions`. */
const slug = (label: string) =>
  label
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/**
 * An outline, as the user writes one: a name, and under it more names, each of
 * which may have names of its own. A name by itself is a lesson.
 */
interface Outline {
  readonly label: string
  /**
   * Its name in the address, where that is not its label's: a lesson renamed
   * keeps the address it had, and with it the runs and settings kept under it.
   */
  readonly id?: string
  /** Its own icon and color. Without them it wears those of what it is under. */
  readonly icon?: PlaceIcon
  readonly accent?: Accent
  readonly description?: string
  readonly under?: readonly (string | Outline)[]
  /** A lesson that is written: what it plays. */
  readonly exercise?: LessonExerciseId
}

/**
 * The sections an outline describes, in its order and its words, each at the
 * address its name makes, or at the one it had before it was renamed.
 *
 * Nothing in an outline is written yet. So whatever has names under it is a
 * page of them, and whatever has none — every lesson — is a page that says it
 * is still to come.
 */
export const outlined = (
  of: Pick<Place, 'icon' | 'accent'>,
  items: readonly (string | Outline)[],
): Section[] =>
  items.map((item) => {
    const { label, id, description, under, exercise, ...own } =
      typeof item === 'string' ? { label: item } : item
    const look = { icon: own.icon ?? of.icon, accent: own.accent ?? of.accent }
    return {
      id: id ?? slug(label),
      label,
      ...look,
      ...(description && { description }),
      ...(exercise && { exercise }),
      ...(under && { sections: outlined(look, under) }),
    }
  })
