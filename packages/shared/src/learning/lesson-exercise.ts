import type { NoteRange } from '../domain/device-schemas.js'
import type { FingeringSystemId } from '../music/fingering-system.js'
import type { Exercise } from './exercise.js'
import { loadOnce } from './load-once.js'
import { DEFAULT_PLAYABLE_RANGE } from './practice-defaults.js'

/**
 * The exercises the lessons play, one per lesson that has one.
 *
 * A lesson is taught as a teacher would teach it at the instrument, and the
 * exercise is what the student's hands do: Listen plays it and shows it on the keys, Learn
 * walks through it a step at a time, Practice takes the guidance away and
 * keeps score. Each is built from the keys the player has, like the others.
 *
 * Lessons are content, not code the first screen needs: each section's are
 * their own module, fetched the first time one of its lessons opens
 * (`loadLessons`), and kept — the notes and the introduction alike. This
 * module is only their names and the loading.
 */

/** Every written lesson, by the section whose module builds it. */
export const LESSON_SECTIONS = {
  'keyboard-layout': [
    'two-black-key-groups',
    'three-black-key-groups',
    'keyboard-patterns',
    'black-key-song',
    'notes-a-through-g',
    'repeating-note-names',
    'finding-c-and-f',
    'finding-middle-c',
    'locating-notes',
    'moving-left-and-right',
    'recognizing-octaves',
  ],
  'hand-positions': [
    'right-hand-finger-numbers',
    'left-hand-finger-numbers',
    'c-position',
    'middle-c-position',
    'right-hand-rousseau',
    'right-hand-jingle-bells',
    'left-hand-railroad',
    'left-hand-lightly-row',
    'c-position-outshine-the-sun',
    'c-position-love-somebody',
    'middle-c-train',
    'middle-c-yankee-doodle',
  ],
  'first-notes': [
    'hands-on-c',
    'steps-and-skips',
    'mixing-steps-and-skips',
    'moving-the-pattern',
    'pattern-1',
    'pattern-2',
    'patterns-1-and-2',
    'pattern-4',
    'whole-melody',
  ],
  intervals: [
    'high-or-low',
    'pitch-recognition',
    'half-steps',
    'half-steps-lower',
    'half-steps-higher',
    'whole-steps',
    'whole-steps-lower',
    'whole-steps-higher',
    'counting-intervals',
  ],
} as const

type LessonSection = keyof typeof LESSON_SECTIONS
export type LessonExerciseId = (typeof LESSON_SECTIONS)[LessonSection][number]
export const LESSON_EXERCISES: readonly LessonExerciseId[] = Object.values(LESSON_SECTIONS).flat()

export interface LessonExerciseOptions {
  /** The keys the player has. A 61-key instrument when left out. */
  readonly range?: NoteRange
  /** The fingering system the player has chosen, for a run up the white keys. */
  readonly fingering?: FingeringSystemId
}

/** What a section's module gives for each of its lessons. */
export type LessonBuilder = (range: NoteRange, options: LessonExerciseOptions) => Exercise

/** What a written lesson asks of the player, as a teacher would say it. */
export interface LessonAbout {
  readonly objective: string
  /** Led by the hand that plays it, where a hand has its own part. */
  readonly how: readonly { readonly who?: 'Left hand' | 'Right hand'; readonly text: string }[]
  readonly remember?: string
  /**
   * The objective read aloud: a file in the web app's `public/narration/`,
   * named for the lesson. A new recording takes a new name, as the files are
   * not hashed.
   */
  readonly narration?: string
  /** A tempo the results dialog challenges the player to try it at next. */
  readonly tempoChallenge?: number
}

/** A section's module: each lesson's exercise and its introduction. */
interface SectionContent {
  readonly builders: Readonly<Record<string, LessonBuilder>>
  readonly abouts: Readonly<Record<string, LessonAbout>>
}

/** Each section's module, loaded on demand: its own chunk in the app. */
const SECTION_MODULES: Record<LessonSection, () => Promise<SectionContent>> = {
  'keyboard-layout': () =>
    import('./keyboard-layout-lessons.js').then((loaded) => ({
      builders: loaded.KEYBOARD_LAYOUT_LESSONS,
      abouts: loaded.KEYBOARD_LAYOUT_ABOUT,
    })),
  'hand-positions': () =>
    import('./hand-position-lessons.js').then((loaded) => ({
      builders: loaded.HAND_POSITION_LESSONS,
      abouts: loaded.HAND_POSITION_ABOUT,
    })),
  'first-notes': () =>
    import('./first-notes-lessons.js').then((loaded) => ({
      builders: loaded.FIRST_NOTES_LESSONS,
      abouts: loaded.FIRST_NOTES_ABOUT,
    })),
  intervals: () =>
    import('./interval-lessons.js').then((loaded) => ({
      builders: loaded.INTERVAL_LESSONS,
      abouts: loaded.INTERVAL_ABOUT,
    })),
}

const sectionOf = (id: LessonExerciseId) =>
  (Object.keys(LESSON_SECTIONS) as LessonSection[]).find((section) =>
    (LESSON_SECTIONS[section] as readonly string[]).includes(id),
  )!

const builders = new Map<string, LessonBuilder>()
const abouts = new Map<string, LessonAbout>()
const loadSection = loadOnce((section: LessonSection) =>
  SECTION_MODULES[section]().then((content) => {
    for (const [lesson, build] of Object.entries(content.builders)) builders.set(lesson, build)
    for (const [lesson, about] of Object.entries(content.abouts)) abouts.set(lesson, about)
  }),
)

/**
 * Fetch the section a lesson is in, once: every lesson of it can then be built
 * at once. A failed fetch is forgotten, so the next ask tries again.
 */
export const loadLessons = (id: LessonExerciseId): Promise<void> => loadSection(sectionOf(id))

/** Whether a lesson's section has been loaded, so it can be built now. */
export const lessonsLoaded = (id: LessonExerciseId) => builders.has(id)

/** The exercise a lesson plays, once its section is loaded (`loadLessons`); null until then. */
export function lessonExercise(
  id: LessonExerciseId,
  options: LessonExerciseOptions = {},
): Exercise | null {
  return builders.get(id)?.(options.range ?? DEFAULT_PLAYABLE_RANGE, options) ?? null
}

/** A lesson's introduction, once its section is loaded; null until then. */
export const lessonAbout = (id: LessonExerciseId): LessonAbout | null => abouts.get(id) ?? null
