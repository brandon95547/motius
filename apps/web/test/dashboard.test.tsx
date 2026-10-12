import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AudioProvider } from '@/audio/AudioProvider'
import { MidiProvider } from '@/midi/MidiProvider'
import { BottomNav } from '@/components/BottomNav'
import { TopBar } from '@/components/TopBar'
import { Dashboard } from '@/features/areas/Dashboard'
import {
  CATEGORIES,
  findCategory,
  placeOf,
  type CategoryId,
  type Section,
} from '@/features/areas/areas'
import { useLearningStore } from '@/state/learning-store'
import { pageActions, usePageStore, usePageSync } from '@/state/page-store'
import { usePanelStore } from '@/state/panel-store'

/**
 * The dashboard and the pages under it.
 *
 * Nine categories, as the mock has them (new dashboard.png, 2026-10-12), in
 * place of the four there were; what those held filed under the nine; and a
 * page for each place that is not built yet. What is pinned is that every
 * place in the table can be reached and says where it is — a card that opens
 * nothing, or a page with no way back, is a dead end in the one part of the
 * app whose whole job is getting somewhere else.
 *
 * And that they are laid out as the mock has them: each place a numbered card,
 * and the bar along the bottom under all of it.
 */

const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } })

function Pages() {
  usePageSync()
  const page = usePageStore((state) => state.page)
  return (
    <QueryClientProvider client={queries}>
      <AudioProvider>
        <MidiProvider>
          <TopBar />
          {page !== 'area' && (
            <>
              <Dashboard />
              <BottomNav />
            </>
          )}
        </MidiProvider>
      </AudioProvider>
    </QueryClientProvider>
  )
}

/** The practice areas, in the order they were moved to the bar's Practice. */
const PRACTICE_AREAS = [
  'Scales',
  'Chords',
  'Arpeggios',
  'Cadences',
  'Fingering Exercises',
  'Daily Practice',
]

const NINE = [
  'Piano Foundations',
  'Music Notation & Reading',
  'Rhythm & Timing',
  'Scales, Intervals & Keys',
  'Chords & Harmony',
  'Piano Technique',
  'Musical Expression',
  'Musical Structure & Styles',
  'Practice & Repertoire',
]

const cards = () =>
  [...document.querySelectorAll<HTMLElement>('.area-card__name')].map((name) => name.textContent)
const numbers = () =>
  [...document.querySelectorAll<HTMLElement>('.area-card__number')].map((n) => n.textContent)
// A card, and not the place of the same name in the bar along the bottom. By
// its name as written: `Cut time (2/2)` is not a pattern.
const card = (name: string) =>
  within(screen.getByRole('main')).getByRole('button', {
    name: new RegExp(`^(Open )?${name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}`),
  })
const trail = () =>
  [...document.querySelectorAll('.top-bar__trail > :not(svg)')].map((step) => step.textContent)
const at = async (hash: string) =>
  waitFor(() => expect(globalThis.location.hash).toBe(hash), { timeout: 3000 })
const category = (id: CategoryId) => findCategory(id)!

beforeEach(() => {
  globalThis.location.hash = ''
  usePageStore.setState({ page: 'dashboard', category: null, path: [] })
  // Scales is what was last open, as it is when the app is first started.
  useLearningStore.getState().setTopic('scales')
})
afterEach(() => {
  cleanup()
  globalThis.location.hash = ''
  usePanelStore.getState().close()
})

describe('the dashboard', () => {
  it('has the nine categories of the mock, each a number, a name and a line about it', () => {
    render(<Pages />)
    expect(cards()).toEqual(NINE)
    expect(numbers()).toEqual(['01', '02', '03', '04', '05', '06', '07', '08', '09'])
    // The number is the order, which a reader of the page already has.
    for (const number of document.querySelectorAll('.area-card__number'))
      expect(number.getAttribute('aria-hidden')).toBe('true')
    // What is in a category is on its page, not listed on its card.
    for (const { label, description } of CATEGORIES) {
      expect(card(label).querySelector('.area-card__description')!.textContent).toBe(description)
      expect(card(label).querySelectorAll('ul, li, .area-card__inside')).toHaveLength(0)
    }
    expect(screen.queryByText('Fingering Exercises')).toBeNull()
  })

  it('has none of the four categories there were: what they held is under the nine', () => {
    render(<Pages />)
    for (const gone of ['Songs', 'Lessons', 'Explore', 'Practice'])
      expect(cards()).not.toContain(gone)
    expect(findCategory('explore')).toBeNull()
  })

  it('is named in the bar, and has no heading or other words of its own', () => {
    render(<Pages />)
    const headings = screen.getAllByRole('heading')
    expect(headings.map((heading) => heading.textContent)).toEqual(['Dashboard'])
    expect(headings[0]!.closest('.top-bar')).not.toBeNull()
    expect(screen.queryByText(/Pick an area/)).toBeNull()
    expect(screen.queryByText(/New to this/)).toBeNull()
    // The page still says what it is, to something that cannot see the bar.
    expect(screen.getByRole('main').getAttribute('aria-label')).toBe('Dashboard')
  })

  it('has every one of the nine laid out: each opens onto its sections', () => {
    render(<Pages />)
    for (const name of NINE) expect(card(name).getAttribute('title')).toBe(`Open ${name}`)
    for (const { sections } of CATEGORIES) expect(sections.length).toBeGreaterThan(0)
    // Nothing on a card sets one apart: no status, no other ring.
    expect(document.querySelectorAll('.area-card__status, [data-coming]')).toHaveLength(0)
  })

  it('opens a category with something in it onto its page', async () => {
    render(<Pages />)
    fireEvent.click(card('Chords & Harmony'))
    await at('#/chords-and-harmony')
    expect(usePageStore.getState()).toMatchObject({
      page: 'category',
      category: 'chords-and-harmony',
    })
  })
})

describe('a category’s page', () => {
  const open = async (id: CategoryId) => {
    render(<Pages />)
    act(() => pageActions.openCategory(category(id)))
    await at(`#/${id}`)
  }

  it('lists its sections, numbered, with the way back to the dashboard in the bar', async () => {
    await open('chords-and-harmony')
    expect(cards()).toEqual(Object.keys(CHORDS))
    expect(numbers()).toEqual(['01', '02', '03', '04', '05', '06', '07', '08', '09'])
    expect(trail()).toEqual(['Dashboard', 'Chords & Harmony'])
    expect(screen.getByRole('heading', { name: 'Chords & Harmony' })).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }))
    await waitFor(() => expect(usePageStore.getState().page).toBe('dashboard'))
  })

  it('has the practice areas, which no outline names, in the bar’s Practice', async () => {
    await open('practice')
    expect(cards()).toEqual(PRACTICE_AREAS)
    expect(numbers()).toEqual(['01', '02', '03', '04', '05', '06'])
    for (const area of PRACTICE_AREAS) expect(card(area).getAttribute('title')).toBe(`Open ${area}`)
  })

  it.each([
    ['Scales', '#/scales', 'scales'],
    ['Chords', '#/chords', 'chords'],
    ['Arpeggios', '#/arpeggios', 'arpeggios'],
    ['Cadences', '#/progressions/cadences', 'progressions'],
    ['Fingering Exercises', '#/fingering', 'fingering'],
    ['Daily Practice', '#/exercises', 'exercises'],
  ] as const)('Practice ▸ %s opens its area', async (section, hash, topic) => {
    await open('practice')
    fireEvent.click(card(section))
    await at(hash)
    expect(usePageStore.getState().page).toBe('area')
    expect(useLearningStore.getState().topic).toBe(topic)
    expect(useLearningStore.getState().exercise).not.toBeNull()
  })

  it('keeps an outlined category to its outline: the practice areas it held are not on it', async () => {
    await open('scales-intervals-and-keys')
    expect(cards()).toEqual(Object.keys(SCALES_KEYS))
    expect(cards()).not.toContain('Scales')
    cleanup()

    // Cadences is on both: there the lessons about them, in Practice the area that plays them.
    await open('chords-and-harmony')
    fireEvent.click(card('Cadences'))
    await at('#/chords-and-harmony/cadences')
    expect(usePageStore.getState().page).toBe('section')
    expect(cards()).toEqual(CHORDS.Cadences)
  })
})

/**
 * Piano Foundations, as the user outlined it (2026-10-12): four sections, two
 * of them in topics, and the lessons under those. The outline is the user's,
 * word for word and in their order, and the table has to be that outline — not
 * one like it.
 */
const FOUNDATIONS = {
  'Keyboard Layout': {
    'White and black keys': [
      'Two-black-key groups',
      'Three-black-key groups',
      'Recognizing keyboard patterns',
    ],
    'Musical alphabet': ['Notes A through G', 'Repeating note names', 'Finding C and F'],
    'Keyboard navigation': [
      'Finding Middle C',
      'Locating notes across the keyboard',
      'Moving left and right',
      'Recognizing octaves',
    ],
  },
  'Understanding Pitch': [
    'High and low notes',
    'Ascending and descending notes',
    'Repeated notes',
    'Octave relationships',
    'Pitch direction',
    'Recognizing pitch changes',
  ],
  'Fingers & Hand Positions': {
    'Finger numbering': ['Right hand (1–5)', 'Left hand (1–5)'],
    'Starting positions': [
      'Middle C position',
      'C position',
      'G position',
      'Five-finger positions',
    ],
    'Hand movement': [
      'Moving between positions',
      'Extended hand positions',
      'Moving between octaves',
    ],
  },
  'Playing Your First Notes': [
    'Playing individual notes',
    'Playing consecutive notes',
    'Playing repeated notes',
    'Playing ascending and descending sequences',
    'Playing with the right hand',
    'Playing with the left hand',
    'Playing with both hands',
    'Playing simple melodies',
  ],
}

/** Music Notation & Reading, as outlined the same day. A name with `[]` under it is a lesson among topics. */
const NOTATION = {
  'Musical Staff': {
    'Staff lines and spaces': [],
    'Treble clef': ['Line notes', 'Space notes'],
    'Bass clef': ['Line notes', 'Space notes'],
    'Grand staff': ['Treble and bass staff relationships', 'Middle C on the grand staff'],
    'Ledger lines': ['Notes above the staff', 'Notes below the staff'],
  },
  'Notes & Notation': [
    'Note heads',
    'Stems',
    'Flags',
    'Beams',
    'Note placement',
    'Notes written simultaneously',
    'Stem direction',
  ],
  'Musical Symbols': {
    Accidentals: ['Sharps', 'Flats', 'Naturals', 'Enharmonic notes'],
    'Key signatures': [],
    'Bar lines': ['Single bar lines', 'Double bar lines', 'Final bar lines'],
    'Repetition symbols': [
      'Repeat signs',
      'First and second endings',
      'Da Capo',
      'Dal Segno',
      'Fine',
      'Coda',
    ],
    'Additional symbols': ['Ties', 'Slurs', 'Fermatas', 'Octave signs (8va and 8vb)'],
  },
  'Sight-Reading': [
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
  'Music Writing': [
    'Writing notes on the staff',
    'Writing accidentals',
    'Writing key signatures',
    'Writing simple melodies',
    'Writing two-part music',
    'Converting letter notes into notation',
    'Transcribing melodies',
  ],
}

/** Rhythm & Timing, likewise. */
const RHYTHM = {
  'Beat & Counting': [
    'Understanding pulse',
    'Strong and weak beats',
    'Counting beats',
    'Counting aloud',
    'Subdividing beats',
    'Keeping a steady pulse',
  ],
  'Tempo & Metronome': [
    'Understanding tempo',
    'Beats per minute (BPM)',
    'Using a metronome',
    'Slow and fast tempos',
    'Maintaining consistent timing',
    'Changing tempo',
  ],
  'Time Signatures': {
    'Measures and bar lines': [],
    'Simple meter': ['2/4', '3/4', '4/4'],
    'Compound meter': ['6/8'],
    'Common time': [],
    'Cut time (2/2)': [],
    'Changing time signatures': [],
    'Beat groupings': [],
  },
  'Note Values': {
    'Whole notes': [],
    'Half notes': [],
    'Quarter notes': [],
    'Eighth notes': [],
    'Sixteenth notes': [],
    'Dotted notes': ['Dotted half notes', 'Dotted quarter notes', 'Dotted eighth notes'],
    Triplets: [],
    'Note-duration relationships': [],
  },
  Rests: [
    'Whole rests',
    'Half rests',
    'Quarter rests',
    'Eighth rests',
    'Sixteenth rests',
    'Dotted rests',
    'Counting silence',
  ],
  'Rhythm Patterns': [
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
  'Rhythm Exercises': [
    'Clapping rhythms',
    'Tapping beats',
    'Counting note values',
    'Recognizing rhythm patterns',
    'Metronome challenges',
    'Playing rhythms on the keyboard',
  ],
}

/** Scales, Intervals & Keys. */
const SCALES_KEYS = {
  Intervals: {
    'Half steps': [],
    'Whole steps': [],
    'Melodic intervals': [],
    'Harmonic intervals': [],
    'Interval sizes': [
      'Unison',
      'Seconds',
      'Thirds',
      'Fourths',
      'Fifths',
      'Sixths',
      'Sevenths',
      'Octaves',
    ],
    'Interval qualities': ['Perfect', 'Major', 'Minor', 'Augmented', 'Diminished'],
    'Interval recognition': [],
    'Interval construction': [],
  },
  'Keys & Tonality': [
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
  'Circle of Fifths': [
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
  'Major Scales': [
    'Major scale formula',
    'Tetrachords',
    'All 12 major scales',
    'Ascending and descending scales',
    'Scale degrees',
    'Major scale fingering',
  ],
  'Minor Scales': [
    'Natural minor',
    'Harmonic minor',
    'Melodic minor',
    'Relative minor relationships',
    'Minor scale formulas',
    'Minor scale fingering',
  ],
  'Additional Scales': [
    'Chromatic scales',
    'Whole-tone scales',
    'Major pentatonic',
    'Minor pentatonic',
    'Blues scales',
  ],
  'Diatonic Modes': [
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
  'Scale Technique': [
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
}

/** Chords & Harmony. */
const CHORDS = {
  'Chord Foundations': [
    'What is a chord?',
    'Root notes',
    'Chord tones',
    'Intervals within chords',
    'Chord construction formulas',
    'Diatonic harmony',
  ],
  Triads: {
    'Major triads': [],
    'Minor triads': [],
    'Diminished triads': [],
    'Augmented triads': [],
    'Suspended chords': ['Sus2', 'Sus4'],
    'Diatonic triads': [],
  },
  'Seventh & Extended Chords': [
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
  'Chord Inversions': [
    'Root position',
    'First inversion',
    'Second inversion',
    'Third inversion (seventh chords)',
    'Inverting major triads',
    'Inverting minor triads',
    'Inverting seventh chords',
    'Smooth inversion transitions',
  ],
  'Chord Voicings': [
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
  'Chord Progressions': {
    'Roman numeral notation': [],
    'Primary chords': ['I', 'IV', 'V', 'V7'],
    'Common progressions': ['I–IV–V', 'I–V–vi–IV', 'ii–V–I', '12-bar blues'],
    'Circle-of-fifths progressions': [],
    Turnarounds: [],
    'Chord substitutions': [],
    'Progressions in major keys': [],
    'Progressions in minor keys': [],
  },
  Cadences: [
    'Authentic cadences',
    'Perfect authentic cadences',
    'Imperfect authentic cadences',
    'Half cadences',
    'Plagal cadences',
    'Deceptive cadences',
    'Cadence recognition',
  ],
  'Harmonic Relationships': [
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
  'Chord Application': [
    'Reading chord symbols',
    'Reading chord charts',
    'Left-hand accompaniment',
    'Harmonizing melodies',
    'Changing chords smoothly',
    'Accompaniment in different keys',
    'Playing chords by ear',
  ],
}

/** Piano Technique. */
const TECHNIQUE = {
  Fingering: [
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
  'Hand Coordination': [
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
  'Technical Exercises': [
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
  'Pedal Technique': [
    'Damper pedal',
    'Soft pedal',
    'Sostenuto pedal',
    'Pedal timing',
    'Overlapping pedal',
    'Pedal changes',
    'Pedal coordination',
  ],
  'Ornaments & Special Techniques': [
    'Grace notes',
    'Trills',
    'Turns',
    'Mordents',
    'Tremolos',
    'Glissandos',
    'Rolled chords',
    'Octave passages',
  ],
}

/** Musical Expression. */
const EXPRESSION = {
  Dynamics: [
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
  Articulation: [
    'Legato',
    'Staccato',
    'Tenuto',
    'Marcato',
    'Accents',
    'Slurs',
    'Contrasting articulation',
    'Touch control',
  ],
  'Musical Phrasing': [
    'Identifying phrases',
    'Phrase beginnings and endings',
    'Shaping melodies',
    'Musical breathing',
    'Lyrical playing',
    'Phrase development',
    'Expressive balance',
  ],
  'Tempo & Interpretation': {
    'Tempo markings': ['Largo', 'Adagio', 'Andante', 'Moderato', 'Allegretto', 'Allegro', 'Presto'],
    'Tempo changes': ['Accelerando', 'Ritardando', 'Rallentando', 'A tempo'],
    Rubato: [],
    Fermatas: [],
    'Expressive timing': [],
    'Character markings': [],
    'Musical interpretation': [],
  },
}

/** Musical Structure & Styles. */
const STRUCTURE = {
  'Musical Structure': {
    Motifs: [],
    Melodies: [],
    Phrases: [],
    'Repetition and contrast': [],
    'Musical sequences': [],
    'Call and response': [],
    'Introductions and endings': [],
    'Verse and chorus': [],
    Bridges: [],
    Codas: [],
    'Musical forms': [
      'Binary (AB)',
      'Ternary (ABA)',
      'AABA',
      'Rondo',
      'Theme and variations',
      'Sonata form',
    ],
    'Canons and fugues': [],
  },
  'Musical Textures': [
    'Monophony',
    'Homophony',
    'Polyphony',
    'Melody and accompaniment',
    'Harmonized melodies',
    'Countermelodies',
    'Bass lines',
    'Two-part writing',
  ],
  'Accompaniment Patterns': [
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
  Arpeggios: [
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
  'Musical Styles': {
    Classical: ['Baroque', 'Classical period', 'Romantic', 'Contemporary classical'],
    Blues: ['Traditional blues', 'Boogie-woogie'],
    Jazz: ['Ragtime', 'Swing', 'Bebop', 'Contemporary jazz'],
    Rock: [],
    Pop: [],
    Country: [],
    Folk: [],
    Soul: [],
    Motown: [],
    Funk: [],
    Reggae: [],
    Waltz: [],
    Polka: [],
    Marches: [],
    Latin: [],
    'Film and contemporary music': [],
  },
  'Music History & Composers': [
    'Origins of the piano',
    'Evolution of piano music',
    'Historical music periods',
    'Major classical composers',
    'Modern composers',
    'Contemporary composers',
    'Film and television composers',
    'Musical influences and traditions',
  ],
}

/** Practice & Repertoire. */
const REPERTOIRE = {
  'Reading Practice': [
    'Note identification',
    'Treble clef drills',
    'Bass clef drills',
    'Grand staff reading',
    'Interval reading',
    'Sight-reading challenges',
    'Pattern recognition',
    'Reading unfamiliar pieces',
  ],
  'Rhythm Practice': [
    'Beat recognition',
    'Clapping and counting',
    'Rhythm identification',
    'Note-duration exercises',
    'Metronome challenges',
    'Syncopation exercises',
    'Hand coordination rhythms',
  ],
  'Technical Practice': [
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
  'Theory Practice': [
    'Note writing',
    'Interval identification',
    'Scale construction',
    'Chord construction',
    'Chord inversion exercises',
    'Key signature recognition',
    'Circle-of-fifths exercises',
    'Harmony exercises',
  ],
  'Ear Training': [
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
  'Practice Methods': [
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
  'Songs & Repertoire': [
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
  'Creativity & Composition': [
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
  'Progress & Assessment': [
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
}

type Outline = readonly string[] | { readonly [label: string]: Outline }
/** The names under a place, as far down as they go: a list at the bottom, a table above it. */
const outlineOf = (sections: readonly Section[]): Outline =>
  sections.every((section) => !section.sections?.length)
    ? sections.map((section) => section.label)
    : Object.fromEntries(
        sections.map((section) => [section.label, outlineOf(section.sections ?? [])]),
      )

describe('Piano Foundations', () => {
  const foundations = () => category('piano-foundations')
  const open = async (hash: string) => {
    render(<Pages />)
    act(() => {
      globalThis.location.hash = hash
    })
    await at(hash)
    await waitFor(() => expect(usePageStore.getState().page).not.toBe('dashboard'))
  }

  it('is the outline it was given, in its order and its words', () => {
    expect(outlineOf(foundations().sections)).toEqual(FOUNDATIONS)
    // In the order written, which a table compared key by key would not say.
    expect(foundations().sections.map((section) => section.label)).toEqual(Object.keys(FOUNDATIONS))
  })

  it('has its four sections as cards, numbered, each with a line about it', async () => {
    await open('#/piano-foundations')
    expect(cards()).toEqual(Object.keys(FOUNDATIONS))
    expect(numbers()).toEqual(['01', '02', '03', '04'])
    for (const name of Object.keys(FOUNDATIONS)) {
      expect(card(name).querySelector('.area-card__description')!.textContent).not.toBe('')
      expect(card(name).getAttribute('title')).toBe(`Open ${name}`)
    }
  })

  it('opens a section onto its topics, and a topic onto its lessons', async () => {
    await open('#/piano-foundations')
    fireEvent.click(card('Keyboard Layout'))
    await at('#/piano-foundations/keyboard-layout')
    expect(usePageStore.getState()).toMatchObject({
      page: 'section',
      category: 'piano-foundations',
      path: ['keyboard-layout'],
    })
    expect(cards()).toEqual(Object.keys(FOUNDATIONS['Keyboard Layout']))
    expect(trail()).toEqual(['Dashboard', 'Piano Foundations', 'Keyboard Layout'])
    expect(screen.getByRole('main').getAttribute('aria-label')).toBe('Keyboard Layout')

    fireEvent.click(card('White and black keys'))
    await at('#/piano-foundations/keyboard-layout/white-and-black-keys')
    expect(cards()).toEqual(FOUNDATIONS['Keyboard Layout']['White and black keys'])
    expect(numbers()).toEqual(['01', '02', '03'])
    expect(trail()).toEqual([
      'Dashboard',
      'Piano Foundations',
      'Keyboard Layout',
      'White and black keys',
    ])
  })

  it('opens a section with no topics straight onto its lessons', async () => {
    await open('#/piano-foundations/understanding-pitch')
    expect(cards()).toEqual(FOUNDATIONS['Understanding Pitch'])
    expect(numbers()).toEqual(['01', '02', '03', '04', '05', '06'])
  })

  it('draws a lesson as a card with its name and no line about it, still to come', async () => {
    await open('#/piano-foundations/keyboard-layout/white-and-black-keys')
    const lesson = card('Two-black-key groups')
    expect(lesson.querySelector('.area-card__description')).toBeNull()
    expect(lesson.getAttribute('title')).toBe('Two-black-key groups — coming soon')
  })

  it('gives a lesson a page that says it is to come, and the way back to its topic', async () => {
    await open('#/piano-foundations/keyboard-layout/white-and-black-keys')
    fireEvent.click(card('Two-black-key groups'))
    const address = '#/piano-foundations/keyboard-layout/white-and-black-keys/two-black-key-groups'
    await at(address)
    expect(usePageStore.getState().path).toEqual([
      'keyboard-layout',
      'white-and-black-keys',
      'two-black-key-groups',
    ])

    const page = within(screen.getByRole('main'))
    expect(screen.getByRole('main').getAttribute('aria-label')).toBe('Two-black-key groups')
    expect(page.getByText('Coming soon')).toBeDefined()
    expect(trail()).toEqual([
      'Dashboard',
      'Piano Foundations',
      'Keyboard Layout',
      'White and black keys',
      'Two-black-key groups',
    ])

    fireEvent.click(page.getByRole('button', { name: 'Back to White and black keys' }))
    await at('#/piano-foundations/keyboard-layout/white-and-black-keys')
    expect(cards()).toEqual(FOUNDATIONS['Keyboard Layout']['White and black keys'])
  })

  it('makes every step of the way down a way back to it', async () => {
    await open('#/piano-foundations/fingers-and-hand-positions/starting-positions/g-position')
    const bar = within(screen.getByRole('navigation', { name: 'You are here' }))

    fireEvent.click(bar.getByRole('button', { name: 'Starting positions' }))
    await at('#/piano-foundations/fingers-and-hand-positions/starting-positions')
    fireEvent.click(bar.getByRole('button', { name: 'Fingers & Hand Positions' }))
    await at('#/piano-foundations/fingers-and-hand-positions')
    expect(cards()).toEqual(Object.keys(FOUNDATIONS['Fingers & Hand Positions']))
    fireEvent.click(bar.getByRole('button', { name: 'Piano Foundations' }))
    await at('#/piano-foundations')
    fireEvent.click(bar.getByRole('button', { name: 'Dashboard' }))
    await waitFor(() => expect(usePageStore.getState().page).toBe('dashboard'))
  })

  it('says how far up each step back is, for the bar to fold the furthest first', async () => {
    await open('#/piano-foundations/keyboard-layout/musical-alphabet/finding-c-and-f')
    const steps = [...document.querySelectorAll<HTMLElement>('.top-bar__crumb')].map((step) => [
      step.textContent,
      step.dataset.up,
    ])
    expect(steps).toEqual([
      ['Dashboard', '4'],
      ['Piano Foundations', '3'],
      ['Keyboard Layout', '2'],
      ['Musical alphabet', '1'],
    ])
  })
})

describe('the categories outlined after it', () => {
  const open = async (hash: string) => {
    render(<Pages />)
    act(() => {
      globalThis.location.hash = hash
    })
    await at(hash)
    await waitFor(() => expect(usePageStore.getState().page).not.toBe('dashboard'))
  }
  /** Every name in order, a level at a time: what a table compared key by key does not check. */
  const inOrder = (sections: readonly Section[]): unknown[] =>
    sections.map((section) =>
      section.sections?.length ? [section.label, inOrder(section.sections)] : section.label,
    )
  const written = (outline: Outline): unknown[] =>
    Array.isArray(outline)
      ? [...outline]
      : Object.entries(outline).map(([label, under]) =>
          Array.isArray(under) && under.length === 0 ? label : [label, written(under)],
        )

  it.each([
    ['music-notation-and-reading', NOTATION],
    ['rhythm-and-timing', RHYTHM],
    ['scales-intervals-and-keys', SCALES_KEYS],
    ['chords-and-harmony', CHORDS],
    ['piano-technique', TECHNIQUE],
    ['musical-expression', EXPRESSION],
    ['musical-structure-and-styles', STRUCTURE],
    ['practice-and-repertoire', REPERTOIRE],
  ] as const)('%s is the outline it was given, in its order and its words', (id, outline) => {
    expect(outlineOf(category(id).sections)).toEqual(outline)
    expect(inOrder(category(id).sections)).toEqual(written(outline))
  })

  it.each([
    ['piano-foundations', 33],
    ['music-notation-and-reading', 51],
    ['rhythm-and-timing', 53],
    ['scales-intervals-and-keys', 77],
    ['chords-and-harmony', 77],
    ['piano-technique', 44],
    ['musical-expression', 41],
    ['musical-structure-and-styles', 77],
    ['practice-and-repertoire', 81],
  ] as const)('%s has every one of its %i lessons still to come', (id, count) => {
    const leaves = (sections: readonly Section[]): Section[] =>
      sections.flatMap((section) =>
        section.sections?.length ? leaves(section.sections) : [section],
      )
    const lessons = leaves(category(id).sections)
    expect(lessons).toHaveLength(count)
    // A page with its name on it, and nothing to open or to say yet.
    for (const lesson of lessons) {
      expect(lesson.opens).toBeUndefined()
      expect(lesson.description).toBeUndefined()
    }
  })

  it('has Music Notation & Reading’s five sections as cards, and Rhythm & Timing’s seven', async () => {
    await open('#/music-notation-and-reading')
    expect(cards()).toEqual(Object.keys(NOTATION))
    expect(numbers()).toEqual(['01', '02', '03', '04', '05'])
    cleanup()

    await open('#/rhythm-and-timing')
    expect(cards()).toEqual(Object.keys(RHYTHM))
    expect(numbers()).toEqual(['01', '02', '03', '04', '05', '06', '07'])
  })

  it('has lessons and topics side by side where the outline does', async () => {
    await open('#/rhythm-and-timing/time-signatures')
    expect(cards()).toEqual(Object.keys(RHYTHM['Time Signatures']))
    // A topic says what is in it and opens; a lesson has only its name, and is to come.
    expect(card('Simple meter').querySelector('.area-card__description')!.textContent).toBe(
      '2/4, 3/4 and 4/4.',
    )
    expect(card('Simple meter').getAttribute('title')).toBe('Open Simple meter')
    expect(card('Cut time (2/2)').querySelector('.area-card__description')).toBeNull()
    expect(card('Cut time (2/2)').getAttribute('title')).toBe('Cut time (2/2) — coming soon')

    fireEvent.click(card('Simple meter'))
    await at('#/rhythm-and-timing/time-signatures/simple-meter')
    expect(cards()).toEqual(['2/4', '3/4', '4/4'])
  })

  it('gives a lesson named in figures an address, and a page that says it is to come', async () => {
    await open('#/rhythm-and-timing/time-signatures/simple-meter')
    fireEvent.click(card('3/4'))
    await at('#/rhythm-and-timing/time-signatures/simple-meter/3-4')
    expect(trail()).toEqual([
      'Dashboard',
      'Rhythm & Timing',
      'Time Signatures',
      'Simple meter',
      '3/4',
    ])
    expect(within(screen.getByRole('main')).getByText('Coming soon')).toBeDefined()
  })

  it('gives a lesson named in numerals or with a question mark an address of its own', async () => {
    await open('#/chords-and-harmony/chord-progressions/common-progressions')
    expect(cards()).toEqual(['I–IV–V', 'I–V–vi–IV', 'ii–V–I', '12-bar blues'])
    fireEvent.click(card('I–V–vi–IV'))
    await at('#/chords-and-harmony/chord-progressions/common-progressions/i-v-vi-iv')
    expect(trail().slice(-1)).toEqual(['I–V–vi–IV'])
    cleanup()

    await open('#/chords-and-harmony/chord-progressions/primary-chords')
    fireEvent.click(card('V7'))
    await at('#/chords-and-harmony/chord-progressions/primary-chords/v7')
    cleanup()

    await open('#/chords-and-harmony/chord-foundations')
    fireEvent.click(card('What is a chord?'))
    await at('#/chords-and-harmony/chord-foundations/what-is-a-chord')
  })

  it('gives a lesson named with a comma or a mark in brackets an address of its own', async () => {
    await open('#/practice-and-repertoire/practice-methods')
    fireEvent.click(card('Short, consistent sessions'))
    await at('#/practice-and-repertoire/practice-methods/short-consistent-sessions')
    cleanup()

    await open('#/musical-expression/dynamics')
    fireEvent.click(card('Mezzo-forte (mf)'))
    await at('#/musical-expression/dynamics/mezzo-forte-mf')
    cleanup()

    await open('#/musical-structure-and-styles/musical-styles/classical')
    expect(cards()).toEqual(['Baroque', 'Classical period', 'Romantic', 'Contemporary classical'])
  })

  it('keeps apart two lessons of the same name under different topics', async () => {
    await open('#/music-notation-and-reading/musical-staff/bass-clef/line-notes')
    expect(trail().slice(-2)).toEqual(['Bass clef', 'Line notes'])
    fireEvent.click(
      within(screen.getByRole('main')).getByRole('button', { name: 'Back to Bass clef' }),
    )
    await at('#/music-notation-and-reading/musical-staff/bass-clef')
    expect(cards()).toEqual(['Line notes', 'Space notes'])
  })

  it('has a topic wear its section’s icon and color unless it was given its own', () => {
    const staff = category('music-notation-and-reading').sections[0]!
    for (const under of staff.sections!) {
      expect(under.icon).toBe(staff.icon)
      expect(under.accent).toBe(staff.accent)
    }
    const symbols = category('music-notation-and-reading').sections[2]!
    const [accidentals, keySignatures] = symbols.sections!
    expect(accidentals!.icon).not.toBe(symbols.icon)
    expect(accidentals!.accent).toBe(symbols.accent)
    expect(keySignatures!.icon).toBe(symbols.icon)
    // And a lesson wears its topic's.
    expect(accidentals!.sections![0]!.icon).toBe(accidentals!.icon)
  })
})

describe('the bar along the bottom', () => {
  const bar = () => within(screen.getByRole('navigation', { name: 'Primary' }))
  const here = () =>
    bar()
      .getAllByRole('button')
      .filter((item) => item.getAttribute('aria-current') === 'page')
      .map((item) => item.textContent)

  it('has the six places of the mock, in its order, each with its word', () => {
    render(<Pages />)
    expect(
      bar()
        .getAllByRole('button')
        .map((item) => item.textContent),
    ).toEqual(['Home', 'Lessons', 'Songs', 'Practice', 'Progress', 'Search'])
    expect(here()).toEqual(['Home'])
  })

  it('keeps Home marked on a category’s page, which is a page under the dashboard', async () => {
    render(<Pages />)
    fireEvent.click(card('Chords & Harmony'))
    await at('#/chords-and-harmony')
    expect(here()).toEqual(['Home'])

    fireEvent.click(card('Chord Progressions'))
    await at('#/chords-and-harmony/chord-progressions')
    expect(here()).toEqual(['Home'])

    fireEvent.click(bar().getByRole('button', { name: 'Home' }))
    await waitFor(() => expect(usePageStore.getState().page).toBe('dashboard'))
  })

  it('opens Practice on the practice areas no outline names, and marks it', async () => {
    render(<Pages />)
    fireEvent.click(bar().getByRole('button', { name: 'Practice' }))
    await at('#/practice')
    expect(here()).toEqual(['Practice'])
    expect(trail()).toEqual(['Dashboard', 'Practice'])
    expect(cards()).toEqual(PRACTICE_AREAS)
  })

  it.each([
    ['Lessons', '#/lessons'],
    ['Progress', '#/progress'],
    ['Search', '#/search'],
  ] as const)('opens %s on a page that says it is to come', async (name, hash) => {
    render(<Pages />)
    fireEvent.click(bar().getByRole('button', { name }))
    await at(hash)
    expect(here()).toEqual([name])
    expect(trail()).toEqual(['Dashboard', name])

    const page = within(screen.getByRole('main'))
    expect(screen.getByRole('main').getAttribute('aria-label')).toBe(name)
    expect(page.getByText('Coming soon')).toBeDefined()
    fireEvent.click(page.getByRole('button', { name: 'Back to Dashboard' }))
    await waitFor(() => expect(usePageStore.getState().page).toBe('dashboard'))
  })

  it('opens Songs as the area it is, where the bar gives way to the keys', async () => {
    render(<Pages />)
    fireEvent.click(bar().getByRole('button', { name: 'Songs' }))
    await at('#/songs')
    expect(usePageStore.getState().page).toBe('area')
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull()
  })
})

describe('where an area is filed', () => {
  it('finds every practice area in the bar’s Practice, and Songs under nothing', () => {
    const filed = (topic: Parameters<typeof placeOf>[0]) => {
      const place = placeOf(topic, 'cadences')
      return [place?.category.label, place?.section.label]
    }
    expect(filed('scales')).toEqual(['Practice', 'Scales'])
    expect(filed('chords')).toEqual(['Practice', 'Chords'])
    expect(filed('arpeggios')).toEqual(['Practice', 'Arpeggios'])
    expect(filed('progressions')).toEqual(['Practice', 'Cadences'])
    expect(filed('fingering')).toEqual(['Practice', 'Fingering Exercises'])
    expect(filed('exercises')).toEqual(['Practice', 'Daily Practice'])
    // Songs is a place in the bar itself, not a section of one.
    expect(placeOf('songs', 'cadences')).toBeNull()
  })

  it('lists the dashboard, Songs, Practice and the nine categories in the menu, and marks where you are', async () => {
    render(<Pages />)
    act(() => pageActions.openArea('fingering'))
    await at('#/fingering')

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    const menu = within(screen.getByRole('menu'))
    const places = ['Dashboard', 'Songs', 'Practice', ...NINE]
    for (const place of places)
      expect(menu.getByRole('menuitemradio', { name: place })).toBeDefined()
    expect(menu.queryByRole('menuitemradio', { name: 'Scales' })).toBeNull()
    expect(menu.queryByRole('menuitemradio', { name: 'Explore' })).toBeNull()
    const checked = places.filter(
      (place) =>
        menu.getByRole('menuitemradio', { name: place }).getAttribute('aria-checked') === 'true',
    )
    expect(checked).toEqual(['Practice'])

    fireEvent.click(menu.getByRole('menuitemradio', { name: 'Chords & Harmony' }))
    await at('#/chords-and-harmony')
  })

  it('marks Practice in the menu while one of its areas is open', async () => {
    render(<Pages />)
    act(() => pageActions.openArea('chords'))
    await at('#/chords')

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    const menu = within(screen.getByRole('menu'))
    const checked = menu
      .getAllByRole('menuitemradio')
      .filter((item) => item.getAttribute('aria-checked') === 'true')
      .map((item) => item.textContent)
    expect(checked).toEqual(['Practice'])

    fireEvent.click(menu.getByRole('menuitemradio', { name: 'Practice' }))
    await at('#/practice')
  })

  it('marks Songs in the menu while a song is open, and not the category it is filed under', async () => {
    render(<Pages />)
    act(() => pageActions.openArea('songs'))
    await at('#/songs')

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    const menu = within(screen.getByRole('menu'))
    const checked = menu
      .getAllByRole('menuitemradio')
      .filter((item) => item.getAttribute('aria-checked') === 'true')
      .map((item) => item.textContent)
    expect(checked).toEqual(['Songs'])
  })
})
