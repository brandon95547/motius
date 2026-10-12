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

  it('draws a category still to come like the others, and says so where the pointer rests', () => {
    render(<Pages />)
    expect(card('Musical Expression').getAttribute('title')).toBe(
      'Musical Expression — coming soon',
    )
    expect(card('Chords & Harmony').getAttribute('title')).toBe('Open Chords & Harmony')
    // Nothing on the card itself sets one apart: no status, no other ring.
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
    expect(cards()).toEqual(['Chords', 'Arpeggios', 'Progressions', 'Cadences'])
    expect(numbers()).toEqual(['01', '02', '03', '04'])
    expect(trail()).toEqual(['Dashboard', 'Chords & Harmony'])
    expect(screen.getByRole('heading', { name: 'Chords & Harmony' })).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }))
    await waitFor(() => expect(usePageStore.getState().page).toBe('dashboard'))
  })

  it.each([
    ['scales-intervals-and-keys', ['Scales', 'Intervals']],
    ['piano-technique', ['Fingering Exercises']],
    ['practice-and-repertoire', ['Daily Practice', 'Songs']],
  ] as const)('%s holds what was moved to it', async (id, sections) => {
    await open(id)
    expect(cards()).toEqual(sections)
  })

  it('says which sections are still to come, where the pointer rests', async () => {
    await open('chords-and-harmony')
    const says = (name: string) => card(name).getAttribute('title')
    expect(says('Progressions')).toBe('Progressions — coming soon')
    expect(says('Chords')).toBe('Open Chords')
  })

  it.each([
    ['scales-intervals-and-keys', 'Scales', '#/scales', 'scales'],
    ['chords-and-harmony', 'Chords', '#/chords', 'chords'],
    ['chords-and-harmony', 'Arpeggios', '#/arpeggios', 'arpeggios'],
    ['chords-and-harmony', 'Cadences', '#/progressions/cadences', 'progressions'],
    ['piano-technique', 'Fingering Exercises', '#/fingering', 'fingering'],
    ['practice-and-repertoire', 'Daily Practice', '#/exercises', 'exercises'],
    ['practice-and-repertoire', 'Songs', '#/songs', 'songs'],
  ] as const)('%s ▸ %s opens its area', async (id, section, hash, topic) => {
    await open(id)
    fireEvent.click(card(section))
    await at(hash)
    expect(usePageStore.getState().page).toBe('area')
    expect(useLearningStore.getState().topic).toBe(topic)
    if (topic !== 'songs') expect(useLearningStore.getState().exercise).not.toBeNull()
  })

  it.each([
    ['scales-intervals-and-keys', 'Intervals', 'intervals'],
    ['chords-and-harmony', 'Progressions', 'progressions'],
  ] as const)(
    '%s ▸ %s has a page that says it is to come, and a way back',
    async (id, section, sectionId) => {
      await open(id)
      fireEvent.click(card(section))
      await at(`#/${id}/${sectionId}`)
      expect(usePageStore.getState()).toMatchObject({
        page: 'section',
        category: id,
        path: [sectionId],
      })

      const { label } = category(id)
      expect(trail()).toEqual(['Dashboard', label, section])
      const page = within(screen.getByRole('main'))
      expect(page.getByText('Coming soon')).toBeDefined()
      expect(screen.getByRole('main').getAttribute('aria-label')).toBe(section)

      fireEvent.click(page.getByRole('button', { name: `Back to ${label}` }))
      await at(`#/${id}`)
      expect(usePageStore.getState().page).toBe('category')
    },
  )

  it.each([
    ['musical-expression', 'Musical Expression'],
    ['musical-structure-and-styles', 'Musical Structure & Styles'],
  ] as const)('%s, with nothing in it yet, is a page that says so', async (id, label) => {
    render(<Pages />)
    fireEvent.click(card(label))
    await at(`#/${id}`)
    expect(usePageStore.getState()).toMatchObject({ page: 'category', category: id })

    expect(trail()).toEqual(['Dashboard', label])
    const page = within(screen.getByRole('main'))
    expect(screen.getByRole('main').getAttribute('aria-label')).toBe(label)
    expect(page.getByText('Coming soon')).toBeDefined()
    fireEvent.click(page.getByRole('button', { name: 'Back to Dashboard' }))
    await waitFor(() => expect(usePageStore.getState().page).toBe('dashboard'))
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
  ] as const)('%s is the outline it was given, in its order and its words', (id, outline) => {
    expect(outlineOf(category(id).sections)).toEqual(outline)
    expect(inOrder(category(id).sections)).toEqual(written(outline))
  })

  it.each([
    ['piano-foundations', 33],
    ['music-notation-and-reading', 51],
    ['rhythm-and-timing', 53],
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

    fireEvent.click(card('Progressions'))
    await at('#/chords-and-harmony/progressions')
    expect(here()).toEqual(['Home'])

    fireEvent.click(bar().getByRole('button', { name: 'Home' }))
    await waitFor(() => expect(usePageStore.getState().page).toBe('dashboard'))
  })

  it.each([
    ['Lessons', '#/lessons'],
    ['Practice', '#/practice'],
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
  it('finds every practice area a home under one of the nine', () => {
    const filed = (topic: Parameters<typeof placeOf>[0]) => {
      const place = placeOf(topic, 'cadences')
      return [place?.category.label, place?.section.label]
    }
    expect(filed('scales')).toEqual(['Scales, Intervals & Keys', 'Scales'])
    expect(filed('chords')).toEqual(['Chords & Harmony', 'Chords'])
    expect(filed('arpeggios')).toEqual(['Chords & Harmony', 'Arpeggios'])
    expect(filed('progressions')).toEqual(['Chords & Harmony', 'Cadences'])
    expect(filed('fingering')).toEqual(['Piano Technique', 'Fingering Exercises'])
    expect(filed('exercises')).toEqual(['Practice & Repertoire', 'Daily Practice'])
    expect(filed('songs')).toEqual(['Practice & Repertoire', 'Songs'])
  })

  it('lists the dashboard, Songs and the nine categories in the menu, and marks where you are', async () => {
    render(<Pages />)
    act(() => pageActions.openArea('fingering'))
    await at('#/fingering')

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    const menu = within(screen.getByRole('menu'))
    const places = ['Dashboard', 'Songs', ...NINE]
    for (const place of places)
      expect(menu.getByRole('menuitemradio', { name: place })).toBeDefined()
    expect(menu.queryByRole('menuitemradio', { name: 'Scales' })).toBeNull()
    expect(menu.queryByRole('menuitemradio', { name: 'Explore' })).toBeNull()
    const checked = places.filter(
      (place) =>
        menu.getByRole('menuitemradio', { name: place }).getAttribute('aria-checked') === 'true',
    )
    expect(checked).toEqual(['Piano Technique'])

    fireEvent.click(menu.getByRole('menuitemradio', { name: 'Chords & Harmony' }))
    await at('#/chords-and-harmony')
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
