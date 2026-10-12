import {
  ALargeSmall,
  Activity,
  AlignVerticalSpaceAround,
  ArrowLeftRight,
  ArrowUpDown,
  AudioLines,
  Blocks,
  BookOpen,
  Brain,
  CalendarCheck,
  ChartNoAxesColumn,
  ChartNoAxesColumnIncreasing,
  CircleDashed,
  CirclePlay,
  ClipboardList,
  Compass,
  Contrast,
  Disc3,
  Drum,
  Dumbbell,
  Ear,
  Ellipsis,
  Eye,
  FlipVertical2,
  Footprints,
  Gauge,
  GraduationCap,
  Hand,
  Hash,
  House,
  KeyRound,
  KeyboardMusic,
  Landmark,
  Layers,
  Layers2,
  Library,
  Lightbulb,
  ListMusic,
  ListPlus,
  ListTree,
  MapPin,
  Milestone,
  Moon,
  MoveHorizontal,
  Music,
  Music2,
  Music3,
  Music4,
  Pause,
  PenLine,
  Piano,
  Pointer,
  Repeat,
  Repeat2,
  RotateCw,
  Route,
  Rows4,
  Ruler,
  Search,
  Shapes,
  Sparkles,
  Spline,
  Sun,
  Tally2,
  Tally4,
  Target,
  Triangle,
  Trophy,
  Volume2,
  Waves,
  Waypoints,
} from 'lucide-react'
import type { ProgressionType } from '@motius/shared'
import type { LearningTopic } from '@/state/learning-store'
import { MetronomeIcon } from '@/ui/MetronomeIcon'

/**
 * Where everything in the app is: nine categories, and what is in each.
 *
 * The nine are the mock's (new dashboard.png, 2026-10-12), in its order and
 * its words, and they took the place of the four there were — Songs, Lessons,
 * Explore, Practice. Each of the nine is laid out from the outline written for
 * it, and holds that and nothing else. The practice areas, which were filed
 * under them before the outlines were written, are in the bar's Practice.
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

/** Songs: an area, and a place in the bar along the bottom. */
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
    // The user's outline of 2026-10-12, in its order and its words.
    sections: outlined({ icon: Music, accent: 'rose' }, [
      {
        label: 'Intervals',
        icon: Ruler,
        accent: 'songs',
        description: 'Half and whole steps, interval sizes and qualities, and recognizing them.',
        under: [
          'Half steps',
          'Whole steps',
          'Melodic intervals',
          'Harmonic intervals',
          {
            label: 'Interval sizes',
            description: 'Unison to octaves.',
            under: [
              'Unison',
              'Seconds',
              'Thirds',
              'Fourths',
              'Fifths',
              'Sixths',
              'Sevenths',
              'Octaves',
            ],
          },
          {
            label: 'Interval qualities',
            description: 'Perfect, major, minor, augmented and diminished.',
            under: ['Perfect', 'Major', 'Minor', 'Augmented', 'Diminished'],
          },
          'Interval recognition',
          'Interval construction',
        ],
      },
      {
        label: 'Keys & Tonality',
        icon: KeyRound,
        accent: 'arpeggios',
        description: 'Tonics, major and minor keys, key signatures, transposition and modulation.',
        under: [
          'Tonics and tonal centers',
          'Major keys',
          'Minor keys',
          'Relative major and minor',
          'Parallel major and minor',
          'Key signatures',
          'Enharmonic keys',
          'Scale degrees',
          'Transposition',
          'Modulation',
        ],
      },
      {
        label: 'Circle of Fifths',
        icon: CircleDashed,
        accent: 'exercises',
        description: 'Fifths and fourths, the order of sharps and flats, and related keys.',
        under: [
          'Circle construction',
          'Clockwise movement by fifths',
          'Counterclockwise movement by fourths',
          'Order of sharps',
          'Order of flats',
          'Identifying key signatures',
          'Relative keys',
          'Closely related keys',
          'Dominant relationships',
          'Subdominant relationships',
          'Key changes and modulation',
        ],
      },
      {
        label: 'Major Scales',
        icon: Sun,
        accent: 'rose',
        description: 'The major scale formula, tetrachords, all 12 scales and their fingering.',
        under: [
          'Major scale formula',
          'Tetrachords',
          'All 12 major scales',
          'Ascending and descending scales',
          'Scale degrees',
          'Major scale fingering',
        ],
      },
      {
        label: 'Minor Scales',
        icon: Moon,
        accent: 'scales',
        description: 'Natural, harmonic and melodic minor, their formulas and fingering.',
        under: [
          'Natural minor',
          'Harmonic minor',
          'Melodic minor',
          'Relative minor relationships',
          'Minor scale formulas',
          'Minor scale fingering',
        ],
      },
      {
        label: 'Additional Scales',
        icon: ListPlus,
        accent: 'teal',
        description: 'Chromatic, whole-tone, pentatonic and blues scales.',
        under: [
          'Chromatic scales',
          'Whole-tone scales',
          'Major pentatonic',
          'Minor pentatonic',
          'Blues scales',
        ],
      },
      {
        label: 'Diatonic Modes',
        icon: RotateCw,
        accent: 'pink',
        description: 'Ionian to Locrian, and how the modes are built and related.',
        under: [
          'Ionian',
          'Dorian',
          'Phrygian',
          'Lydian',
          'Mixolydian',
          'Aeolian',
          'Locrian',
          'Mode construction',
          'Mode relationships',
        ],
      },
      {
        label: 'Scale Technique',
        icon: Hand,
        accent: 'progressions',
        description: 'Finger patterns, thumb passing, octaves, hands together, and speed.',
        under: [
          'Finger patterns',
          'Thumb passing',
          'One-octave scales',
          'Two-octave scales',
          'Multiple-octave scales',
          'Hands-separate scales',
          'Hands-together scales',
          'Parallel motion',
          'Contrary motion',
          'Chromatic warm-ups',
          'Scale speed and accuracy',
        ],
      },
    ]),
  },
  {
    id: 'chords-and-harmony',
    label: 'Chords & Harmony',
    icon: Layers,
    description: 'Learn chords, inversions, progressions and harmony.',
    accent: 'scales',
    // The user's outline of 2026-10-12, in its order and its words.
    sections: outlined({ icon: Layers, accent: 'scales' }, [
      {
        label: 'Chord Foundations',
        icon: Blocks,
        accent: 'songs',
        description: 'What a chord is, roots and chord tones, and how chords are built.',
        under: [
          'What is a chord?',
          'Root notes',
          'Chord tones',
          'Intervals within chords',
          'Chord construction formulas',
          'Diatonic harmony',
        ],
      },
      {
        label: 'Triads',
        icon: Triangle,
        accent: 'arpeggios',
        description:
          'Major, minor, diminished and augmented triads, suspended chords and diatonic triads.',
        under: [
          'Major triads',
          'Minor triads',
          'Diminished triads',
          'Augmented triads',
          { label: 'Suspended chords', description: 'Sus2 and Sus4.', under: ['Sus2', 'Sus4'] },
          'Diatonic triads',
        ],
      },
      {
        label: 'Seventh & Extended Chords',
        icon: Rows4,
        accent: 'exercises',
        description: 'Seventh chords, sixths, ninths, elevenths and thirteenths.',
        under: [
          'Dominant seventh',
          'Major seventh',
          'Minor seventh',
          'Diminished seventh',
          'Half-diminished seventh',
          'Sixth chords',
          'Ninth chords',
          'Eleventh chords',
          'Thirteenth chords',
        ],
      },
      {
        label: 'Chord Inversions',
        icon: FlipVertical2,
        accent: 'rose',
        description: 'Root position and the inversions of triads and seventh chords.',
        under: [
          'Root position',
          'First inversion',
          'Second inversion',
          'Third inversion (seventh chords)',
          'Inverting major triads',
          'Inverting minor triads',
          'Inverting seventh chords',
          'Smooth inversion transitions',
        ],
      },
      {
        label: 'Chord Voicings',
        icon: AlignVerticalSpaceAround,
        accent: 'scales',
        description:
          'Closed and open positions, block, broken and rolled chords, and voice leading.',
        under: [
          'Closed-position chords',
          'Open-position chords',
          'Block chords',
          'Broken chords',
          'Rolled chords',
          'Slash chords',
          'Two-handed voicings',
          'Chord extensions',
          'Voice leading',
        ],
      },
      {
        label: 'Chord Progressions',
        icon: Route,
        accent: 'teal',
        description: 'Roman numerals, primary chords, common progressions and turnarounds.',
        under: [
          'Roman numeral notation',
          {
            label: 'Primary chords',
            description: 'I, IV, V and V7.',
            under: ['I', 'IV', 'V', 'V7'],
          },
          {
            label: 'Common progressions',
            description: 'I–IV–V, I–V–vi–IV, ii–V–I and the 12-bar blues.',
            under: ['I–IV–V', 'I–V–vi–IV', 'ii–V–I', '12-bar blues'],
          },
          'Circle-of-fifths progressions',
          'Turnarounds',
          'Chord substitutions',
          'Progressions in major keys',
          'Progressions in minor keys',
        ],
      },
      {
        label: 'Cadences',
        icon: Milestone,
        accent: 'pink',
        description: 'Authentic, half, plagal and deceptive cadences, and recognizing them.',
        under: [
          'Authentic cadences',
          'Perfect authentic cadences',
          'Imperfect authentic cadences',
          'Half cadences',
          'Plagal cadences',
          'Deceptive cadences',
          'Cadence recognition',
        ],
      },
      {
        label: 'Harmonic Relationships',
        icon: Waypoints,
        accent: 'progressions',
        description: 'Tonic, dominant and subdominant function, common tones and modulation.',
        under: [
          'Chords built from scales',
          'Tonic function',
          'Dominant function',
          'Subdominant function',
          'Common tones',
          'Voice leading',
          'Shared chords',
          'Pivot chords',
          'Modulation',
          'Harmonic movement',
        ],
      },
      {
        label: 'Chord Application',
        icon: CirclePlay,
        accent: 'arpeggios',
        description: 'Chord symbols and charts, accompaniment, and harmonizing melodies.',
        under: [
          'Reading chord symbols',
          'Reading chord charts',
          'Left-hand accompaniment',
          'Harmonizing melodies',
          'Changing chords smoothly',
          'Accompaniment in different keys',
          'Playing chords by ear',
        ],
      },
    ]),
  },
  {
    id: 'piano-technique',
    label: 'Piano Technique',
    icon: Hand,
    description: 'Build your fingering, coordination and pedal skills.',
    accent: 'progressions',
    // The user's outline of 2026-10-12, in its order and its words.
    sections: outlined({ icon: Hand, accent: 'progressions' }, [
      {
        label: 'Fingering',
        icon: Pointer,
        accent: 'songs',
        description:
          'Finger independence, crossing and thumb passing, and fingering for scales, chords and melodies.',
        under: [
          'Finger independence',
          'Finger strength and control',
          'Finger crossing',
          'Thumb passing',
          'Finger substitution',
          'Alternative fingering',
          'Fingering for scales',
          'Fingering for chords',
          'Fingering for arpeggios',
          'Fingering for melodies',
        ],
      },
      {
        label: 'Hand Coordination',
        icon: ArrowLeftRight,
        accent: 'arpeggios',
        description:
          'Each hand alone and both together, independent rhythms and changing position.',
        under: [
          'Right-hand exercises',
          'Left-hand exercises',
          'Hands-separate playing',
          'Hands-together playing',
          'Independent rhythms',
          'Melody and accompaniment coordination',
          'Hand-position changes',
          'Playing without looking at the hands',
          'Melody sharing between hands',
        ],
      },
      {
        label: 'Technical Exercises',
        icon: Dumbbell,
        accent: 'exercises',
        description: 'Five-finger, Hanon, chromatic, octave, chord and arpeggio exercises.',
        under: [
          'Five-finger exercises',
          'Hanon exercises',
          'Chromatic exercises',
          'Octave exercises',
          'Repeated-note exercises',
          'Chord exercises',
          'Inversion exercises',
          'Arpeggio exercises',
          'Speed and accuracy exercises',
          'Finger independence drills',
        ],
      },
      {
        label: 'Pedal Technique',
        icon: Footprints,
        accent: 'rose',
        description: 'The damper, soft and sostenuto pedals, pedal timing and changes.',
        under: [
          'Damper pedal',
          'Soft pedal',
          'Sostenuto pedal',
          'Pedal timing',
          'Overlapping pedal',
          'Pedal changes',
          'Pedal coordination',
        ],
      },
      {
        label: 'Ornaments & Special Techniques',
        icon: Sparkles,
        accent: 'scales',
        description: 'Grace notes, trills, turns, mordents, tremolos and glissandos.',
        under: [
          'Grace notes',
          'Trills',
          'Turns',
          'Mordents',
          'Tremolos',
          'Glissandos',
          'Rolled chords',
          'Octave passages',
        ],
      },
    ]),
  },
  {
    id: 'musical-expression',
    label: 'Musical Expression',
    icon: AudioLines,
    description: 'Play with dynamics, articulation and phrasing.',
    accent: 'arpeggios',
    // The user's outline of 2026-10-12, in its order and its words.
    sections: outlined({ icon: AudioLines, accent: 'arpeggios' }, [
      {
        label: 'Dynamics',
        icon: Volume2,
        accent: 'songs',
        description: 'Pianissimo to fortissimo, crescendo and diminuendo, contrast and balance.',
        under: [
          'Pianissimo (pp)',
          'Piano (p)',
          'Mezzo-piano (mp)',
          'Mezzo-forte (mf)',
          'Forte (f)',
          'Fortissimo (ff)',
          'Crescendo',
          'Diminuendo',
          'Dynamic contrast',
          'Melody and accompaniment balance',
        ],
      },
      {
        label: 'Articulation',
        icon: Ellipsis,
        accent: 'arpeggios',
        description: 'Legato, staccato, tenuto, marcato, accents and slurs, and touch control.',
        under: [
          'Legato',
          'Staccato',
          'Tenuto',
          'Marcato',
          'Accents',
          'Slurs',
          'Contrasting articulation',
          'Touch control',
        ],
      },
      {
        label: 'Musical Phrasing',
        icon: Spline,
        accent: 'exercises',
        description: 'Finding phrases, shaping melodies, breathing and lyrical playing.',
        under: [
          'Identifying phrases',
          'Phrase beginnings and endings',
          'Shaping melodies',
          'Musical breathing',
          'Lyrical playing',
          'Phrase development',
          'Expressive balance',
        ],
      },
      {
        label: 'Tempo & Interpretation',
        icon: Gauge,
        accent: 'rose',
        description: 'Tempo markings and changes, rubato, fermatas and interpretation.',
        under: [
          {
            label: 'Tempo markings',
            description: 'Largo to Presto.',
            under: ['Largo', 'Adagio', 'Andante', 'Moderato', 'Allegretto', 'Allegro', 'Presto'],
          },
          {
            label: 'Tempo changes',
            description: 'Accelerando, ritardando, rallentando and a tempo.',
            under: ['Accelerando', 'Ritardando', 'Rallentando', 'A tempo'],
          },
          'Rubato',
          'Fermatas',
          'Expressive timing',
          'Character markings',
          'Musical interpretation',
        ],
      },
    ]),
  },
  {
    id: 'musical-structure-and-styles',
    label: 'Musical Structure & Styles',
    icon: Music4,
    description: 'Discover song forms, genres and great composers.',
    accent: 'teal',
    // The user's outline of 2026-10-12, in its order and its words.
    sections: outlined({ icon: Music4, accent: 'teal' }, [
      {
        label: 'Musical Structure',
        icon: ListTree,
        accent: 'songs',
        description: 'Motifs, melodies and phrases, verse and chorus, and the musical forms.',
        under: [
          'Motifs',
          'Melodies',
          'Phrases',
          'Repetition and contrast',
          'Musical sequences',
          'Call and response',
          'Introductions and endings',
          'Verse and chorus',
          'Bridges',
          'Codas',
          {
            label: 'Musical forms',
            description: 'Binary, ternary, AABA, rondo, theme and variations, and sonata form.',
            under: [
              'Binary (AB)',
              'Ternary (ABA)',
              'AABA',
              'Rondo',
              'Theme and variations',
              'Sonata form',
            ],
          },
          'Canons and fugues',
        ],
      },
      {
        label: 'Musical Textures',
        icon: Layers2,
        accent: 'arpeggios',
        description: 'Monophony, homophony and polyphony, countermelodies and bass lines.',
        under: [
          'Monophony',
          'Homophony',
          'Polyphony',
          'Melody and accompaniment',
          'Harmonized melodies',
          'Countermelodies',
          'Bass lines',
          'Two-part writing',
        ],
      },
      {
        label: 'Accompaniment Patterns',
        icon: Repeat2,
        accent: 'exercises',
        description: 'Block and broken chords, bass patterns, stride and boogie-woogie.',
        under: [
          'Block-chord accompaniment',
          'Broken-chord accompaniment',
          'Arpeggiated accompaniment',
          'Root–fifth bass',
          'Alternating bass',
          'Walking bass',
          'Ostinato',
          'Alberti bass',
          'Stride piano',
          'Boogie-woogie patterns',
          'Rock and pop accompaniment',
        ],
      },
      {
        label: 'Arpeggios',
        icon: Waves,
        accent: 'rose',
        description:
          'Major, minor, diminished, augmented and seventh-chord arpeggios, ascending and descending.',
        under: [
          'Major arpeggios',
          'Minor arpeggios',
          'Diminished arpeggios',
          'Augmented arpeggios',
          'Seventh-chord arpeggios',
          'Ascending arpeggios',
          'Descending arpeggios',
          'One- and two-octave arpeggios',
          'Compound arpeggios',
          'Two-handed arpeggios',
        ],
      },
      {
        label: 'Musical Styles',
        icon: Disc3,
        accent: 'scales',
        description: 'Classical, blues and jazz, rock, pop, folk, Latin and film music.',
        under: [
          {
            label: 'Classical',
            description: 'Baroque, Classical period, Romantic and contemporary classical.',
            under: ['Baroque', 'Classical period', 'Romantic', 'Contemporary classical'],
          },
          {
            label: 'Blues',
            description: 'Traditional blues and boogie-woogie.',
            under: ['Traditional blues', 'Boogie-woogie'],
          },
          {
            label: 'Jazz',
            description: 'Ragtime, swing, bebop and contemporary jazz.',
            under: ['Ragtime', 'Swing', 'Bebop', 'Contemporary jazz'],
          },
          'Rock',
          'Pop',
          'Country',
          'Folk',
          'Soul',
          'Motown',
          'Funk',
          'Reggae',
          'Waltz',
          'Polka',
          'Marches',
          'Latin',
          'Film and contemporary music',
        ],
      },
      {
        label: 'Music History & Composers',
        icon: Landmark,
        accent: 'teal',
        description: 'The origins of the piano, its music through the periods, and its composers.',
        under: [
          'Origins of the piano',
          'Evolution of piano music',
          'Historical music periods',
          'Major classical composers',
          'Modern composers',
          'Contemporary composers',
          'Film and television composers',
          'Musical influences and traditions',
        ],
      },
    ]),
  },
  {
    id: 'practice-and-repertoire',
    label: 'Practice & Repertoire',
    icon: GraduationCap,
    description: 'Exercises, ear training, songs and track your progress.',
    accent: 'pink',
    // The user's outline of 2026-10-12, in its order and its words.
    sections: outlined({ icon: GraduationCap, accent: 'pink' }, [
      {
        label: 'Reading Practice',
        icon: Eye,
        accent: 'songs',
        description:
          'Note identification, clef drills, interval reading and sight-reading challenges.',
        under: [
          'Note identification',
          'Treble clef drills',
          'Bass clef drills',
          'Grand staff reading',
          'Interval reading',
          'Sight-reading challenges',
          'Pattern recognition',
          'Reading unfamiliar pieces',
        ],
      },
      {
        label: 'Rhythm Practice',
        icon: Drum,
        accent: 'arpeggios',
        description:
          'Beat recognition, clapping and counting, metronome and syncopation exercises.',
        under: [
          'Beat recognition',
          'Clapping and counting',
          'Rhythm identification',
          'Note-duration exercises',
          'Metronome challenges',
          'Syncopation exercises',
          'Hand coordination rhythms',
        ],
      },
      {
        label: 'Technical Practice',
        icon: Dumbbell,
        accent: 'exercises',
        description: 'Fingering, five-finger, scale, chord and arpeggio exercises, and etudes.',
        under: [
          'Fingering exercises',
          'Five-finger drills',
          'Scale exercises',
          'Chord exercises',
          'Inversion exercises',
          'Arpeggio exercises',
          'Hand coordination',
          'Etudes',
          'Speed and accuracy challenges',
        ],
      },
      {
        label: 'Theory Practice',
        icon: Brain,
        accent: 'rose',
        description:
          'Note writing, building scales and chords, and recognizing intervals and key signatures.',
        under: [
          'Note writing',
          'Interval identification',
          'Scale construction',
          'Chord construction',
          'Chord inversion exercises',
          'Key signature recognition',
          'Circle-of-fifths exercises',
          'Harmony exercises',
        ],
      },
      {
        label: 'Ear Training',
        icon: Ear,
        accent: 'scales',
        description:
          'Recognizing pitch, intervals, chords and rhythm, dictation, and playing by ear.',
        under: [
          'Pitch recognition',
          'High and low pitch recognition',
          'Interval recognition',
          'Major and minor recognition',
          'Chord recognition',
          'Rhythm recognition',
          'Melodic dictation',
          'Harmonic dictation',
          'Playing melodies by ear',
          'Listening and imitation',
        ],
      },
      {
        label: 'Practice Methods',
        icon: ClipboardList,
        accent: 'teal',
        description: 'Routines, slow and hands-separate practice, the metronome, and memorization.',
        under: [
          'Practice routines',
          'Short, consistent sessions',
          'Hands-separate practice',
          'Slow practice',
          'Metronome practice',
          'Gradual tempo increases',
          'Section-based practice',
          'Repetition and review',
          'Memorization',
          'Correcting difficult passages',
          'Backing-track practice',
        ],
      },
      {
        label: 'Songs & Repertoire',
        icon: Library,
        accent: 'pink',
        description: 'Beginner songs, classical, folk, popular, jazz and blues pieces, and duets.',
        under: [
          'Beginner songs',
          'Classical pieces',
          'Folk and traditional music',
          'Popular music',
          'Jazz and blues pieces',
          'Original compositions',
          'Duets',
          'Ensemble arrangements',
          'Play-along pieces',
          'Performance repertoire',
        ],
      },
      {
        label: 'Creativity & Composition',
        icon: Lightbulb,
        accent: 'progressions',
        description: 'Creating melodies, improvisation, playing by ear and writing songs.',
        under: [
          'Creating melodies',
          'Improvisation',
          'Chord-based improvisation',
          'Playing by ear',
          'Harmonizing melodies',
          'Writing original songs',
          'Song structure',
          'Combining melodies with lyrics',
          'Basic arranging',
        ],
      },
      {
        label: 'Progress & Assessment',
        icon: Trophy,
        accent: 'arpeggios',
        description: 'Lesson completion, skill challenges, assessments and milestones.',
        under: [
          'Lesson completion',
          'Skill challenges',
          'Topic mastery',
          'Accuracy assessments',
          'Timing assessments',
          'Speed assessments',
          'Performance evaluations',
          'Learning milestones',
          'Beginner, intermediate, and advanced achievements',
        ],
      },
    ]),
  },
]

/**
 * The bar along the bottom: the dashboard, and then these. None is on a card.
 * Songs is the area, and Practice has the other practice areas, which no
 * outline names. The other three are not built yet.
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
    description: 'Scales, chords, arpeggios, cadences, fingering exercises and daily routines.',
    accent: 'exercises',
    // The practice areas, which are in no outline. Each was under one of the
    // nine until that was laid out, and is here until the lessons that use it
    // say where it belongs.
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
        id: 'cadences',
        label: 'Cadences',
        icon: Milestone,
        description: 'The cadence of every key, in three positions: I – IV – I – V – I.',
        accent: 'exercises',
        opens: { kind: 'area', topic: 'progressions', progression: 'cadences' },
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
        id: 'daily-practice',
        label: 'Daily Practice',
        icon: CalendarCheck,
        description: 'Blocked, expanding and accelerating scales, the Grand Form, and more.',
        accent: 'exercises',
        opens: { kind: 'area', topic: 'exercises' },
      },
    ],
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
 * Where an area is filed: the place it is under, and the section that opens
 * it. Which is how the menu knows where you are while an area is open. Songs is
 * under nothing: it is a place in the bar itself.
 */
export function placeOf(
  topic: LearningTopic,
  progression: ProgressionType,
): { category: Category; section: Section } | null {
  for (const category of [...CATEGORIES, ...DESTINATIONS]) {
    const section = category.sections.find((entry) => leadsTo(entry, topic, progression))
    if (section) return { category, section }
  }
  return null
}

export const COMING_SOON = 'Coming soon'
