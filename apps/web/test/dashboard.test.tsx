import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AudioProvider } from '@/audio/AudioProvider'
import { MidiProvider } from '@/midi/MidiProvider'
import { BottomNav } from '@/components/BottomNav'
import { TopBar } from '@/components/TopBar'
import { Dashboard } from '@/features/areas/Dashboard'
import { CATEGORIES, placeOf } from '@/features/areas/areas'
import { useLearningStore } from '@/state/learning-store'
import { pageActions, usePageStore, usePageSync } from '@/state/page-store'
import { usePanelStore } from '@/state/panel-store'

/**
 * The dashboard and the pages under it.
 *
 * Four categories where there were six areas, the sections of three of them a
 * page down, and a page for each place that is not built yet. What is pinned
 * is that every place in the table can be reached and says where it is — a
 * card that opens nothing, or a page with no way back, is a dead end in the
 * one part of the app whose whole job is getting somewhere else.
 *
 * And that they are laid out as the mock has them (new dashboard.png,
 * 2026-10-12): each place a numbered card, the nine lessons in their order,
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

const cards = () =>
  [...document.querySelectorAll<HTMLElement>('.area-card__name')].map((name) => name.textContent)
const numbers = () =>
  [...document.querySelectorAll<HTMLElement>('.area-card__number')].map((n) => n.textContent)
// A card, and not the place of the same name in the bar along the bottom.
const card = (name: string) =>
  within(screen.getByRole('main')).getByRole('button', { name: new RegExp(`^(Open )?${name}`) })
const trail = () =>
  [...document.querySelectorAll('.top-bar__trail > :not(svg)')].map((step) => step.textContent)
const at = async (hash: string) =>
  waitFor(() => expect(globalThis.location.hash).toBe(hash), { timeout: 3000 })

beforeEach(() => {
  globalThis.location.hash = ''
  usePageStore.setState({ page: 'dashboard', category: null, section: null })
  // Scales is what was last open, as it is when the app is first started.
  useLearningStore.getState().setTopic('scales')
})
afterEach(() => {
  cleanup()
  globalThis.location.hash = ''
  usePanelStore.getState().close()
})

describe('the dashboard', () => {
  it('has four categories, each a number, a name and a line about it', () => {
    render(<Pages />)
    expect(cards()).toEqual(['Songs', 'Lessons', 'Explore', 'Practice'])
    expect(numbers()).toEqual(['01', '02', '03', '04'])
    // What is in a category is on its page, not listed on its card.
    for (const { label, description } of CATEGORIES) {
      expect(card(label).querySelector('.area-card__description')!.textContent).toBe(description)
      expect(card(label).querySelectorAll('ul, li, .area-card__inside')).toHaveLength(0)
      expect(card(label).getAttribute('title')).toBe(`Open ${label}`)
    }
    expect(screen.queryByText('Sight-Reading')).toBeNull()
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

  it('opens Songs straight onto the songs, and the others onto their pages', async () => {
    render(<Pages />)
    fireEvent.click(card('Explore'))
    await at('#/explore')
    expect(usePageStore.getState()).toMatchObject({ page: 'category', category: 'explore' })

    act(() => pageActions.openDashboard())
    await waitFor(() => expect(usePageStore.getState().page).toBe('dashboard'))
    fireEvent.click(card('Songs'))
    await at('#/songs')
    expect(usePageStore.getState().page).toBe('area')
    expect(useLearningStore.getState().topic).toBe('songs')
  })
})

describe('a category’s page', () => {
  const open = async (id: 'lessons' | 'explore' | 'practice') => {
    render(<Pages />)
    act(() => pageActions.openCategory(CATEGORIES.find((category) => category.id === id)!))
    await at(`#/${id}`)
  }

  it('lists its sections, with the way back to the dashboard in the bar', async () => {
    await open('explore')
    expect(cards()).toEqual([
      'Scales',
      'Chords',
      'Arpeggios',
      'Progressions',
      'Cadences',
      'Intervals',
    ])
    expect(trail()).toEqual(['Dashboard', 'Explore'])
    expect(screen.getByRole('heading', { name: 'Explore' })).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }))
    await waitFor(() => expect(usePageStore.getState().page).toBe('dashboard'))
  })

  it('has the nine lessons of the mock, numbered in the order they are taught', async () => {
    await open('lessons')
    expect(cards()).toEqual([
      'Piano Foundations',
      'Music Notation & Reading',
      'Rhythm & Timing',
      'Scales, Intervals & Keys',
      'Chords & Harmony',
      'Piano Technique',
      'Musical Expression',
      'Musical Structure & Styles',
      'Practice & Repertoire',
    ])
    expect(numbers()).toEqual(['01', '02', '03', '04', '05', '06', '07', '08', '09'])
    // The number is the order, which a reader of the page already has.
    for (const number of document.querySelectorAll('.area-card__number'))
      expect(number.getAttribute('aria-hidden')).toBe('true')
  })

  it('draws a section still to come like the others, and says so where the pointer rests', async () => {
    await open('explore')
    const says = (name: string) => card(name).getAttribute('title')
    expect(says('Progressions')).toBe('Progressions — coming soon')
    expect(says('Intervals')).toBe('Intervals — coming soon')
    expect(says('Chords')).toBe('Open Chords')
    // Nothing on the card itself sets one apart: no status, no other ring.
    expect(document.querySelectorAll('.area-card__status, [data-coming]')).toHaveLength(0)
  })

  it.each([
    ['explore', 'Scales', '#/scales', 'scales'],
    ['explore', 'Chords', '#/chords', 'chords'],
    ['explore', 'Arpeggios', '#/arpeggios', 'arpeggios'],
    ['explore', 'Cadences', '#/progressions/cadences', 'progressions'],
    ['practice', 'Daily Practice', '#/exercises', 'exercises'],
    ['practice', 'Fingering Exercises', '#/fingering', 'fingering'],
  ] as const)('%s ▸ %s opens its area', async (category, section, hash, topic) => {
    await open(category)
    fireEvent.click(card(section))
    await at(hash)
    expect(usePageStore.getState().page).toBe('area')
    expect(useLearningStore.getState().topic).toBe(topic)
    expect(useLearningStore.getState().exercise).not.toBeNull()
  })

  it('opens Piano Foundations on the fundamentals, over the page it was opened from', async () => {
    await open('lessons')
    fireEvent.click(card('Piano Foundations'))
    expect(usePanelStore.getState().panel).toBe('fundamentals')
    expect(usePageStore.getState()).toMatchObject({ page: 'category', category: 'lessons' })
  })

  it.each([
    ['lessons', 'Music Notation & Reading', 'music-notation-and-reading'],
    ['lessons', 'Rhythm & Timing', 'rhythm-and-timing'],
    ['lessons', 'Scales, Intervals & Keys', 'scales-intervals-and-keys'],
    ['lessons', 'Chords & Harmony', 'chords-and-harmony'],
    ['lessons', 'Piano Technique', 'piano-technique'],
    ['lessons', 'Musical Expression', 'musical-expression'],
    ['lessons', 'Musical Structure & Styles', 'musical-structure-and-styles'],
    ['lessons', 'Practice & Repertoire', 'practice-and-repertoire'],
    ['explore', 'Progressions', 'progressions'],
    ['explore', 'Intervals', 'intervals'],
    ['practice', 'Sight-Reading', 'sight-reading'],
    ['practice', 'Rhythm', 'rhythm'],
  ] as const)(
    '%s ▸ %s has a page that says it is to come, and a way back',
    async (category, section, id) => {
      await open(category)
      fireEvent.click(card(section))
      await at(`#/${category}/${id}`)
      expect(usePageStore.getState()).toMatchObject({ page: 'section', category, section: id })

      const label = CATEGORIES.find((entry) => entry.id === category)!.label
      expect(trail()).toEqual(['Dashboard', label, section])
      const page = within(screen.getByRole('main'))
      expect(page.getByText('Coming soon')).toBeDefined()
      expect(screen.getByRole('main').getAttribute('aria-label')).toBe(section)

      fireEvent.click(page.getByRole('button', { name: `Back to ${label}` }))
      await at(`#/${category}`)
      expect(usePageStore.getState().page).toBe('category')
    },
  )
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

  it('goes to a category’s page, and marks it for as long as you are under it', async () => {
    render(<Pages />)
    fireEvent.click(bar().getByRole('button', { name: 'Lessons' }))
    await at('#/lessons')
    expect(here()).toEqual(['Lessons'])

    fireEvent.click(card('Rhythm & Timing'))
    await at('#/lessons/rhythm-and-timing')
    expect(here()).toEqual(['Lessons'])

    fireEvent.click(bar().getByRole('button', { name: 'Home' }))
    await waitFor(() => expect(usePageStore.getState().page).toBe('dashboard'))
    expect(here()).toEqual(['Home'])
  })

  it('keeps Home marked on Explore, which has no place of its own in it', async () => {
    render(<Pages />)
    fireEvent.click(card('Explore'))
    await at('#/explore')
    expect(here()).toEqual(['Home'])
  })

  it.each([
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
  it('finds every practice area a home under one of the four', () => {
    expect(placeOf('songs', 'cadences')?.category.id).toBe('songs')
    for (const topic of ['scales', 'chords', 'arpeggios', 'progressions'] as const)
      expect(placeOf(topic, 'cadences')?.category.id).toBe('explore')
    expect(placeOf('progressions', 'cadences')?.section?.label).toBe('Cadences')
    expect(placeOf('exercises', 'cadences')).toMatchObject({
      category: { id: 'practice' },
      section: { label: 'Daily Practice' },
    })
    expect(placeOf('fingering', 'cadences')?.section?.label).toBe('Fingering Exercises')
  })

  it('lists the dashboard and the four categories in the menu, and marks where you are', async () => {
    render(<Pages />)
    act(() => pageActions.openArea('fingering'))
    await at('#/fingering')

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    const menu = within(screen.getByRole('menu'))
    const places = ['Dashboard', 'Songs', 'Lessons', 'Explore', 'Practice']
    for (const place of places)
      expect(menu.getByRole('menuitemradio', { name: place })).toBeDefined()
    expect(menu.queryByRole('menuitemradio', { name: 'Scales' })).toBeNull()
    const checked = places.filter(
      (place) =>
        menu.getByRole('menuitemradio', { name: place }).getAttribute('aria-checked') === 'true',
    )
    expect(checked).toEqual(['Practice'])

    fireEvent.click(menu.getByRole('menuitemradio', { name: 'Explore' }))
    await at('#/explore')
  })
})
