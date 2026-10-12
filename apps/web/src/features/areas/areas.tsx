import {
  ALargeSmall,
  Activity,
  ArrowUpDown,
  AudioLines,
  BookOpen,
  CalendarCheck,
  ChartNoAxesColumn,
  ChartNoAxesColumnIncreasing,
  Compass,
  Contrast,
  Drum,
  Dumbbell,
  Eye,
  Gauge,
  GraduationCap,
  Hand,
  Hash,
  House,
  KeyboardMusic,
  Layers,
  ListMusic,
  MapPin,
  Milestone,
  MoveHorizontal,
  Music,
  Music2,
  Music3,
  Music4,
  Pause,
  PenLine,
  Piano,
  Repeat,
  Route,
  Ruler,
  Search,
  Shapes,
  Spline,
  Tally2,
  Tally4,
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
 * What is in a category is its sections, and a section may have sections of
 * its own, as far down as the subject goes: Piano Foundations has Keyboard
 * Layout, which has White and black keys, which has its three lessons. Each of
 * them with something under it is a page of cards.
 *
 * A section that is built says what it opens: one of the practice areas, or a
 * panel. A place with nothing under it and nothing to open has a page of its
 * own that says so — the place is there, with its name on it, before what goes
 * in it is. Every lesson is one of those so far.
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
  /** A line about it, for its card. A lesson has only its name so far. */
  readonly description?: string
  readonly accent: Accent
  /** Absent for a place that is a page: of its sections, or saying it is to come. */
  readonly opens?: Opens
}

export interface Section extends Place {
  /** Its name in the address: `#/chords-and-harmony/progressions`. */
  readonly id: string
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
  /** Its own icon and color. Without them it wears those of what it is under. */
  readonly icon?: PlaceIcon
  readonly accent?: Accent
  readonly description?: string
  readonly under?: readonly (string | Outline)[]
}

/**
 * The sections an outline describes, in its order and its words, each at the
 * address its name makes: renaming one moves it.
 *
 * Nothing in an outline is written yet. So whatever has names under it is a
 * page of them, and whatever has none — every lesson — is a page that says it
 * is still to come.
 */
const outlined = (
  of: Pick<Place, 'icon' | 'accent'>,
  items: readonly (string | Outline)[],
): Section[] =>
  items.map((item) => {
    const { label, description, under, ...own } = typeof item === 'string' ? { label: item } : item
    const look = { icon: own.icon ?? of.icon, accent: own.accent ?? of.accent }
    return {
      id: slug(label),
      label,
      ...look,
      ...(description && { description }),
      ...(under && { sections: outlined(look, under) }),
    }
  })

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
    // The user's outline of 2026-10-12, in its order and its words.
    sections: outlined({ icon: KeyboardMusic, accent: 'songs' }, [
      {
        label: 'Keyboard Layout',
        icon: Piano,
        accent: 'songs',
        description: 'White and black keys, the musical alphabet and keyboard navigation.',
        under: [
          {
            label: 'White and black keys',
            icon: Contrast,
            description: 'Two-black-key groups, three-black-key groups and keyboard patterns.',
            under: [
              'Two-black-key groups',
              'Three-black-key groups',
              'Recognizing keyboard patterns',
            ],
          },
          {
            label: 'Musical alphabet',
            icon: ALargeSmall,
            description: 'Notes A through G, repeating note names, and finding C and F.',
            under: ['Notes A through G', 'Repeating note names', 'Finding C and F'],
          },
          {
            label: 'Keyboard navigation',
            icon: Compass,
            description: 'Finding Middle C, locating notes, moving left and right, and octaves.',
            under: [
              'Finding Middle C',
              'Locating notes across the keyboard',
              'Moving left and right',
              'Recognizing octaves',
            ],
          },
        ],
      },
      {
        label: 'Understanding Pitch',
        icon: ArrowUpDown,
        accent: 'arpeggios',
        description: 'High and low notes, pitch direction, repeated notes and octaves.',
        under: [
          'High and low notes',
          'Ascending and descending notes',
          'Repeated notes',
          'Octave relationships',
          'Pitch direction',
          'Recognizing pitch changes',
        ],
      },
      {
        label: 'Fingers & Hand Positions',
        icon: Hand,
        accent: 'exercises',
        description: 'Finger numbering, starting positions and hand movement.',
        under: [
          {
            label: 'Finger numbering',
            icon: Hash,
            description: 'Right hand and left hand, 1 to 5.',
            under: ['Right hand (1–5)', 'Left hand (1–5)'],
          },
          {
            label: 'Starting positions',
            icon: MapPin,
            description: 'Middle C, C and G positions, and five-finger positions.',
            under: ['Middle C position', 'C position', 'G position', 'Five-finger positions'],
          },
          {
            label: 'Hand movement',
            icon: MoveHorizontal,
            description: 'Moving between positions and octaves, and extended hand positions.',
            under: [
              'Moving between positions',
              'Extended hand positions',
              'Moving between octaves',
            ],
          },
        ],
      },
      {
        label: 'Playing Your First Notes',
        icon: Music2,
        accent: 'rose',
        description: 'From single notes to simple melodies, with each hand and with both.',
        under: [
          'Playing individual notes',
          'Playing consecutive notes',
          'Playing repeated notes',
          'Playing ascending and descending sequences',
          'Playing with the right hand',
          'Playing with the left hand',
          'Playing with both hands',
          'Playing simple melodies',
        ],
      },
    ]),
  },
  {
    id: 'music-notation-and-reading',
    label: 'Music Notation & Reading',
    icon: BookOpen,
    description: 'Master the staff, clefs, note values and sight-reading.',
    accent: 'arpeggios',
    // The user's outline of 2026-10-12, in its order and its words.
    sections: outlined({ icon: BookOpen, accent: 'arpeggios' }, [
      {
        label: 'Musical Staff',
        icon: ListMusic,
        accent: 'songs',
        description:
          'Lines and spaces, the treble and bass clefs, the grand staff and ledger lines.',
        under: [
          'Staff lines and spaces',
          {
            label: 'Treble clef',
            description: 'Line notes and space notes.',
            under: ['Line notes', 'Space notes'],
          },
          {
            label: 'Bass clef',
            description: 'Line notes and space notes.',
            under: ['Line notes', 'Space notes'],
          },
          {
            label: 'Grand staff',
            description: 'Treble and bass staff relationships, and Middle C on the grand staff.',
            under: ['Treble and bass staff relationships', 'Middle C on the grand staff'],
          },
          {
            label: 'Ledger lines',
            description: 'Notes above the staff and notes below it.',
            under: ['Notes above the staff', 'Notes below the staff'],
          },
        ],
      },
      {
        label: 'Notes & Notation',
        icon: Music3,
        accent: 'arpeggios',
        description: 'Note heads, stems, flags and beams, and where notes are placed.',
        under: [
          'Note heads',
          'Stems',
          'Flags',
          'Beams',
          'Note placement',
          'Notes written simultaneously',
          'Stem direction',
        ],
      },
      {
        label: 'Musical Symbols',
        icon: Shapes,
        accent: 'exercises',
        description: 'Accidentals, key signatures, bar lines, repeats and other symbols.',
        under: [
          {
            label: 'Accidentals',
            icon: Hash,
            description: 'Sharps, flats, naturals and enharmonic notes.',
            under: ['Sharps', 'Flats', 'Naturals', 'Enharmonic notes'],
          },
          'Key signatures',
          {
            label: 'Bar lines',
            icon: Tally2,
            description: 'Single, double and final bar lines.',
            under: ['Single bar lines', 'Double bar lines', 'Final bar lines'],
          },
          {
            label: 'Repetition symbols',
            icon: Repeat,
            description: 'Repeat signs, endings, Da Capo, Dal Segno, Fine and Coda.',
            under: [
              'Repeat signs',
              'First and second endings',
              'Da Capo',
              'Dal Segno',
              'Fine',
              'Coda',
            ],
          },
          {
            label: 'Additional symbols',
            icon: Spline,
            description: 'Ties, slurs, fermatas and octave signs.',
            under: ['Ties', 'Slurs', 'Fermatas', 'Octave signs (8va and 8vb)'],
          },
        ],
      },
      {
        label: 'Sight-Reading',
        icon: Eye,
        accent: 'rose',
        description: 'Reading each clef and both staves, intervals, patterns and chords.',
        under: [
          'Recognizing notes',
          'Reading treble clef',
          'Reading bass clef',
          'Reading both staves',
          'Reading intervals',
          'Recognizing repeated notes',
          'Recognizing melodic patterns',
          'Reading ahead',
          'Reading unfamiliar music',
          'Reading chords on the staff',
        ],
      },
      {
        label: 'Music Writing',
        icon: PenLine,
        accent: 'scales',
        description: 'Writing notes, accidentals, key signatures and melodies, and transcribing.',
        under: [
          'Writing notes on the staff',
          'Writing accidentals',
          'Writing key signatures',
          'Writing simple melodies',
          'Writing two-part music',
          'Converting letter notes into notation',
          'Transcribing melodies',
        ],
      },
    ]),
  },
  {
    id: 'rhythm-and-timing',
    label: 'Rhythm & Timing',
    icon: MetronomeIcon,
    description: 'Develop your sense of rhythm, beat and tempo.',
    accent: 'exercises',
    // The user's outline of 2026-10-12, in its order and its words.
    sections: outlined({ icon: MetronomeIcon, accent: 'exercises' }, [
      {
        label: 'Beat & Counting',
        icon: Activity,
        accent: 'songs',
        description: 'Pulse, strong and weak beats, counting and subdividing.',
        under: [
          'Understanding pulse',
          'Strong and weak beats',
          'Counting beats',
          'Counting aloud',
          'Subdividing beats',
          'Keeping a steady pulse',
        ],
      },
      {
        label: 'Tempo & Metronome',
        icon: Gauge,
        accent: 'arpeggios',
        description: 'Tempo and beats per minute, using a metronome, and keeping consistent time.',
        under: [
          'Understanding tempo',
          'Beats per minute (BPM)',
          'Using a metronome',
          'Slow and fast tempos',
          'Maintaining consistent timing',
          'Changing tempo',
        ],
      },
      {
        label: 'Time Signatures',
        icon: Tally4,
        accent: 'exercises',
        description: 'Measures, simple and compound meter, common time and cut time.',
        under: [
          'Measures and bar lines',
          { label: 'Simple meter', description: '2/4, 3/4 and 4/4.', under: ['2/4', '3/4', '4/4'] },
          { label: 'Compound meter', description: '6/8.', under: ['6/8'] },
          'Common time',
          'Cut time (2/2)',
          'Changing time signatures',
          'Beat groupings',
        ],
      },
      {
        label: 'Note Values',
        icon: Music2,
        accent: 'rose',
        description: 'Whole notes to sixteenths, dotted notes and triplets.',
        under: [
          'Whole notes',
          'Half notes',
          'Quarter notes',
          'Eighth notes',
          'Sixteenth notes',
          {
            label: 'Dotted notes',
            description: 'Dotted half, quarter and eighth notes.',
            under: ['Dotted half notes', 'Dotted quarter notes', 'Dotted eighth notes'],
          },
          'Triplets',
          'Note-duration relationships',
        ],
      },
      {
        label: 'Rests',
        icon: Pause,
        accent: 'scales',
        description: 'Whole rests to sixteenths, dotted rests and counting silence.',
        under: [
          'Whole rests',
          'Half rests',
          'Quarter rests',
          'Eighth rests',
          'Sixteenth rests',
          'Dotted rests',
          'Counting silence',
        ],
      },
      {
        label: 'Rhythm Patterns',
        icon: Drum,
        accent: 'teal',
        description: 'Syncopation, swing and shuffle, dotted and triplet rhythms.',
        under: [
          'Repeated rhythms',
          'Pickup measures',
          'Syncopation',
          'Swing rhythms',
          'Shuffle rhythms',
          'Dotted rhythms',
          'Triplet patterns',
          'Rhythmic accompaniment',
          'Independent rhythms between hands',
        ],
      },
      {
        label: 'Rhythm Exercises',
        icon: Dumbbell,
        accent: 'pink',
        description: 'Clapping, tapping, counting and playing rhythms.',
        under: [
          'Clapping rhythms',
          'Tapping beats',
          'Counting note values',
          'Recognizing rhythm patterns',
          'Metronome challenges',
          'Playing rhythms on the keyboard',
        ],
      },
    ]),
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

/** Whether there is anything at a place yet: something it opens, or sections of its own. */
export const isBuilt = (place: Category | Section): boolean =>
  Boolean(place.opens) || (place.sections?.length ?? 0) > 0

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
