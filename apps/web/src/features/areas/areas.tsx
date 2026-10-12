import {
  AudioLines,
  BookOpen,
  CalendarCheck,
  ChartNoAxesColumn,
  ChartNoAxesColumnIncreasing,
  Compass,
  Drum,
  Eye,
  GraduationCap,
  Hand,
  House,
  KeyboardMusic,
  Layers,
  Milestone,
  Music,
  Music4,
  Route,
  Ruler,
  Search,
  Target,
  Waves,
} from 'lucide-react'
import type { ProgressionType } from '@motius/shared'
import type { LearningTopic } from '@/state/learning-store'
import { MetronomeIcon } from '@/ui/MetronomeIcon'

/**
 * Where everything in the app is: four categories, and the sections in three
 * of them.
 *
 * The dashboard, the pages under it, the bar along the bottom and the menu are
 * all drawn from this one table, so they cannot disagree about what a place is
 * called, what it looks like, where it is or whether it is built yet.
 *
 * A section that is built says what it opens: one of the practice areas, or a
 * panel. One that is not says nothing, and has a page of its own that says so
 * — the place is there, with its name on it, before what goes in it is.
 *
 * Two more places are at the top with the categories and are on no card:
 * Progress and Search, which the bar along the bottom leads to. Neither is
 * built, so each is a page that says so.
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

export type CategoryId = 'songs' | 'lessons' | 'explore' | 'practice' | 'progress' | 'search'

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

interface Place {
  readonly label: string
  readonly icon: PlaceIcon
  readonly description: string
  readonly accent: Accent
  /** Absent for a place that is not built: it has a page that says so. */
  readonly opens?: Opens
}

export interface Section extends Place {
  /** Its name in the address: `#/practice/sight-reading`. */
  readonly id: string
}

export interface Category extends Place {
  readonly id: CategoryId
  /** None for a category that is itself the place — Songs — or that is not built. */
  readonly sections: readonly Section[]
}

export const CATEGORIES: readonly Category[] = [
  {
    id: 'songs',
    label: 'Songs',
    icon: Music,
    description: 'Pick a piece or bring your own, and learn it a hand at a time.',
    accent: 'songs',
    opens: { kind: 'area', topic: 'songs' },
    sections: [],
  },
  {
    id: 'lessons',
    label: 'Lessons',
    icon: BookOpen,
    description: 'From the first note on: reading music, technique, theory and expression.',
    accent: 'arpeggios',
    // In the order they are taught, which is the number each card carries.
    sections: [
      {
        id: 'piano-foundations',
        label: 'Piano Foundations',
        icon: KeyboardMusic,
        description: 'Learn the keyboard, notes, and how to play your first melodies.',
        accent: 'songs',
        opens: { kind: 'panel', panel: 'fundamentals' },
      },
      {
        id: 'music-notation-and-reading',
        label: 'Music Notation & Reading',
        icon: BookOpen,
        description: 'Master the staff, clefs, note values and sight-reading.',
        accent: 'arpeggios',
      },
      {
        id: 'rhythm-and-timing',
        label: 'Rhythm & Timing',
        icon: MetronomeIcon,
        description: 'Develop your sense of rhythm, beat and tempo.',
        accent: 'exercises',
      },
      {
        id: 'scales-intervals-and-keys',
        label: 'Scales, Intervals & Keys',
        icon: Music,
        description: 'Explore intervals, scales, modes and key signatures.',
        accent: 'rose',
      },
      {
        id: 'chords-and-harmony',
        label: 'Chords & Harmony',
        icon: Layers,
        description: 'Learn chords, inversions, progressions and harmony.',
        accent: 'scales',
      },
      {
        id: 'piano-technique',
        label: 'Piano Technique',
        icon: Hand,
        description: 'Build your fingering, coordination and pedal skills.',
        accent: 'progressions',
      },
      {
        id: 'musical-expression',
        label: 'Musical Expression',
        icon: AudioLines,
        description: 'Play with dynamics, articulation and phrasing.',
        accent: 'arpeggios',
      },
      {
        id: 'musical-structure-and-styles',
        label: 'Musical Structure & Styles',
        icon: Music4,
        description: 'Discover song forms, genres and great composers.',
        accent: 'teal',
      },
      {
        id: 'practice-and-repertoire',
        label: 'Practice & Repertoire',
        icon: GraduationCap,
        description: 'Exercises, ear training, songs and track your progress.',
        accent: 'pink',
      },
    ],
  },
  {
    id: 'explore',
    label: 'Explore',
    icon: Compass,
    description: 'Scales, chords, arpeggios and how they join up, in every key.',
    accent: 'scales',
    sections: [
      {
        id: 'scales',
        label: 'Scales',
        icon: ChartNoAxesColumnIncreasing,
        description: 'Every key and mode, fingered, written out, and run with you.',
        accent: 'scales',
        opens: { kind: 'area', topic: 'scales' },
      },
      {
        id: 'chords',
        label: 'Chords',
        icon: Layers,
        description: 'Triads, four-note chords and sevenths in every position, solid and broken.',
        accent: 'chords',
        opens: { kind: 'area', topic: 'chords' },
      },
      {
        id: 'arpeggios',
        label: 'Arpeggios',
        icon: Waves,
        description: 'Each key’s chords run up the keyboard, from every position.',
        accent: 'arpeggios',
        opens: { kind: 'area', topic: 'arpeggios' },
      },
      {
        id: 'progressions',
        label: 'Progressions',
        icon: Route,
        description: 'Chords in sequence: the patterns that songs are built on.',
        accent: 'progressions',
      },
      {
        id: 'cadences',
        label: 'Cadences',
        icon: Milestone,
        description: 'The cadence of every key, in three positions: I – IV – I – V – I.',
        accent: 'exercises',
        opens: { kind: 'area', topic: 'progressions', progression: 'cadences' },
      },
      {
        id: 'intervals',
        label: 'Intervals',
        icon: Ruler,
        description: 'The distance between two notes, by name, on the keys and by ear.',
        accent: 'scales',
      },
    ],
  },
  {
    id: 'practice',
    label: 'Practice',
    icon: Target,
    description: 'What to play today: routines, fingering, sight-reading and rhythm.',
    accent: 'exercises',
    sections: [
      {
        id: 'daily-practice',
        label: 'Daily Practice',
        icon: CalendarCheck,
        description: 'Blocked, expanding and accelerating scales, the Grand Form, and more.',
        accent: 'exercises',
        opens: { kind: 'area', topic: 'exercises' },
      },
      {
        id: 'fingering-exercises',
        label: 'Fingering Exercises',
        icon: Hand,
        description:
          'The movements fingering is made of: positions, crossings and changes of finger.',
        accent: 'scales',
        opens: { kind: 'area', topic: 'fingering' },
      },
      {
        id: 'sight-reading',
        label: 'Sight-Reading',
        icon: Eye,
        description: 'Music you have not seen before, a line at a time.',
        accent: 'arpeggios',
      },
      {
        id: 'rhythm',
        label: 'Rhythm',
        icon: Drum,
        description: 'Counting, subdividing and keeping time.',
        accent: 'songs',
      },
    ],
  },
]

/**
 * At the top with the categories, and not among them: on no card and in no
 * menu, and reached from the bar along the bottom. Neither is built yet.
 */
export const TO_COME: readonly Category[] = [
  {
    id: 'progress',
    label: 'Progress',
    icon: ChartNoAxesColumn,
    description: 'What you have practiced, and how it is coming along.',
    accent: 'exercises',
    sections: [],
  },
  {
    id: 'search',
    label: 'Search',
    icon: Search,
    description: 'Find a lesson, a song or an exercise by its name.',
    accent: 'arpeggios',
    sections: [],
  },
]

export const findCategory = (id: string | null | undefined): Category | null =>
  [...CATEGORIES, ...TO_COME].find((category) => category.id === id) ?? null

/** Whether there is anything at a place yet: something it opens, or sections of its own. */
export const isBuilt = (place: Category | Section): boolean =>
  Boolean(place.opens) || ('sections' in place && place.sections.length > 0)

/**
 * The bar along the bottom: the dashboard, and five of the places at the top.
 * Explore is not one of them, and is reached from the dashboard.
 */
export const HOME = { id: 'home', label: 'Home', icon: House } as const
export const DESTINATIONS: readonly Category[] = (
  ['lessons', 'songs', 'practice', 'progress', 'search'] as const
).map((id) => findCategory(id)!)

export const findSection = (category: Category, id: string | null | undefined): Section | null =>
  category.sections.find((section) => section.id === id) ?? null

/** Whether a place opens this area — on this type of progression, where it names one. */
const leadsTo = (place: Place, topic: LearningTopic, progression: ProgressionType) =>
  place.opens?.kind === 'area' &&
  place.opens.topic === topic &&
  (place.opens.progression === undefined || place.opens.progression === progression)

/**
 * Where an area is filed: the category it is under, and the section that opens
 * it. Which is how the menu knows where you are while an area is open.
 */
export function placeOf(
  topic: LearningTopic,
  progression: ProgressionType,
): { category: Category; section: Section | null } | null {
  for (const category of CATEGORIES) {
    if (leadsTo(category, topic, progression)) return { category, section: null }
    const section = category.sections.find((entry) => leadsTo(entry, topic, progression))
    if (section) return { category, section }
  }
  return null
}

export const COMING_SOON = 'Coming soon'
