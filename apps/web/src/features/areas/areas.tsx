import {
  AudioLines,
  BookOpen,
  CalendarCheck,
  ChartNoAxesColumn,
  ChartNoAxesColumnIncreasing,
  Flag,
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
 * Where everything in the app is: nine categories, and what is in each.
 *
 * The nine are the mock's (new dashboard.png, 2026-10-12), in its order and
 * its words, and they took the place of the four there were — Songs, Lessons,
 * Explore, Practice. What those held is filed under the nine: the scales with
 * Scales, Intervals & Keys, the chords and what is made of them with Chords &
 * Harmony, the fingering exercises with Piano Technique, and so on.
 *
 * The dashboard, the pages under it, the bar along the bottom and the menu are
 * all drawn from this one table, so they cannot disagree about what a place is
 * called, what it looks like, where it is or whether it is built yet.
 *
 * A section that is built says what it opens: one of the practice areas, or a
 * panel. A place that is not says nothing, and has a page of its own that says
 * so — the place is there, with its name on it, before what goes in it is.
 *
 * Five more places are at the top and on no card: the ones the bar along the
 * bottom leads to. Songs is the area. Lessons, Practice, Progress and Search
 * are not built, so each is a page that says so.
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

interface Place {
  readonly label: string
  readonly icon: PlaceIcon
  readonly description: string
  readonly accent: Accent
  /** Absent for a place that is not built: it has a page that says so. */
  readonly opens?: Opens
}

export interface Section extends Place {
  /** Its name in the address: `#/chords-and-harmony/progressions`. */
  readonly id: string
}

export interface Category extends Place {
  readonly id: CategoryId
  /** None for a place that is itself an area — Songs — or that is not built. */
  readonly sections: readonly Section[]
}

/** Songs: an area, a place in the bar along the bottom, and a section of the ninth category. */
const SONGS = {
  id: 'songs',
  label: 'Songs',
  icon: Music,
  description: 'Pick a piece or bring your own, and learn it a hand at a time.',
  accent: 'songs',
  opens: { kind: 'area', topic: 'songs' },
} as const

// In the mock's order, which is the number each card carries.
export const CATEGORIES: readonly Category[] = [
  {
    id: 'piano-foundations',
    label: 'Piano Foundations',
    icon: KeyboardMusic,
    description: 'Learn the keyboard, notes, and how to play your first melodies.',
    accent: 'songs',
    sections: [
      {
        id: 'getting-started',
        label: 'Getting Started',
        icon: Flag,
        description:
          'The keyboard, the notes and the scales: the ground everything else stands on.',
        accent: 'songs',
        opens: { kind: 'panel', panel: 'fundamentals' },
      },
    ],
  },
  {
    id: 'music-notation-and-reading',
    label: 'Music Notation & Reading',
    icon: BookOpen,
    description: 'Master the staff, clefs, note values and sight-reading.',
    accent: 'arpeggios',
    sections: [],
  },
  {
    id: 'rhythm-and-timing',
    label: 'Rhythm & Timing',
    icon: MetronomeIcon,
    description: 'Develop your sense of rhythm, beat and tempo.',
    accent: 'exercises',
    sections: [],
  },
  {
    id: 'scales-intervals-and-keys',
    label: 'Scales, Intervals & Keys',
    icon: Music,
    description: 'Explore intervals, scales, modes and key signatures.',
    accent: 'rose',
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
        id: 'intervals',
        label: 'Intervals',
        icon: Ruler,
        description: 'The distance between two notes, by name, on the keys and by ear.',
        accent: 'rose',
      },
    ],
  },
  {
    id: 'chords-and-harmony',
    label: 'Chords & Harmony',
    icon: Layers,
    description: 'Learn chords, inversions, progressions and harmony.',
    accent: 'scales',
    sections: [
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
    ],
  },
  {
    id: 'piano-technique',
    label: 'Piano Technique',
    icon: Hand,
    description: 'Build your fingering, coordination and pedal skills.',
    accent: 'progressions',
    sections: [
      {
        id: 'fingering-exercises',
        label: 'Fingering Exercises',
        icon: Hand,
        description:
          'The movements fingering is made of: positions, crossings and changes of finger.',
        accent: 'scales',
        opens: { kind: 'area', topic: 'fingering' },
      },
    ],
  },
  {
    id: 'musical-expression',
    label: 'Musical Expression',
    icon: AudioLines,
    description: 'Play with dynamics, articulation and phrasing.',
    accent: 'arpeggios',
    sections: [],
  },
  {
    id: 'musical-structure-and-styles',
    label: 'Musical Structure & Styles',
    icon: Music4,
    description: 'Discover song forms, genres and great composers.',
    accent: 'teal',
    sections: [],
  },
  {
    id: 'practice-and-repertoire',
    label: 'Practice & Repertoire',
    icon: GraduationCap,
    description: 'Exercises, ear training, songs and track your progress.',
    accent: 'pink',
    sections: [
      {
        id: 'daily-practice',
        label: 'Daily Practice',
        icon: CalendarCheck,
        description: 'Blocked, expanding and accelerating scales, the Grand Form, and more.',
        accent: 'exercises',
        opens: { kind: 'area', topic: 'exercises' },
      },
      SONGS,
    ],
  },
]

/**
 * The bar along the bottom: the dashboard, and then these. None is on a card.
 * Songs is the area; the other four are not built yet, and what the categories
 * of the same names used to hold is under the nine.
 */
export const HOME = { id: 'home', label: 'Home', icon: House } as const
export const DESTINATIONS: readonly Category[] = [
  {
    id: 'lessons',
    label: 'Lessons',
    icon: BookOpen,
    description: 'From the first note on: reading music, technique, theory and expression.',
    accent: 'arpeggios',
    sections: [],
  },
  { ...SONGS, sections: [] },
  {
    id: 'practice',
    label: 'Practice',
    icon: Target,
    description: 'What to play today: routines, fingering, sight-reading and rhythm.',
    accent: 'exercises',
    sections: [],
  },
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
  [...CATEGORIES, ...DESTINATIONS].find((category) => category.id === id) ?? null

export const findSection = (category: Category, id: string | null | undefined): Section | null =>
  category.sections.find((section) => section.id === id) ?? null

/** Whether there is anything at a place yet: something it opens, or sections of its own. */
export const isBuilt = (place: Category | Section): boolean =>
  Boolean(place.opens) || ('sections' in place && place.sections.length > 0)

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
): { category: Category; section: Section } | null {
  for (const category of CATEGORIES) {
    const section = category.sections.find((entry) => leadsTo(entry, topic, progression))
    if (section) return { category, section }
  }
  return null
}

export const COMING_SOON = 'Coming soon'
