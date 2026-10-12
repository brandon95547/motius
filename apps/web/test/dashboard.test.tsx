import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AudioProvider } from '@/audio/AudioProvider'
import { MidiProvider } from '@/midi/MidiProvider'
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
 * page down, and a page for each section that is not built yet. What is pinned
 * is that every place in the table can be reached and says where it is — a
 * card that opens nothing, or a page with no way back, is a dead end in the
 * one part of the app whose whole job is getting somewhere else.
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
          {page !== 'area' && <Dashboard />}
        </MidiProvider>
      </AudioProvider>
    </QueryClientProvider>
  )
}

const cards = () =>
  [...document.querySelectorAll<HTMLElement>('.area-card__name')].map((name) => name.textContent)
const card = (name: string) => screen.getByRole('button', { name: new RegExp(`^(Open )?${name}`) })
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
  it('has four categories, each a name and a line about it', () => {
    render(<Pages />)
    expect(cards()).toEqual(['Songs', 'Lessons', 'Explore', 'Practice'])
    // What is in a category is on its page, not listed on its card.
    for (const { label, description } of CATEGORIES) {
      expect(card(label).querySelector('.area-card__description')!.textContent).toBe(description)
      expect(card(label).querySelectorAll('ul, li, .area-card__inside')).toHaveLength(0)
      expect(card(label).querySelector('.area-card__status')!.textContent).not.toBe('Coming soon')
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

  it('says which sections are still to come', async () => {
    await open('explore')
    const status = (name: string) => card(name).querySelector('.area-card__status')!.textContent
    expect(status('Progressions')).toBe('Coming soon')
    expect(status('Intervals')).toBe('Coming soon')
    expect(status('Chords')).toBe('Open')
    // The one that was last open says where it was left.
    expect(status('Scales')).toBe(useLearningStore.getState().exercise!.title)
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

  it('opens Getting Started on the fundamentals, over the page it was opened from', async () => {
    await open('lessons')
    fireEvent.click(card('Getting Started'))
    expect(usePanelStore.getState().panel).toBe('fundamentals')
    expect(usePageStore.getState()).toMatchObject({ page: 'category', category: 'lessons' })
  })

  it.each([
    ['lessons', 'Reading Sheet Music', 'reading-sheet-music'],
    ['lessons', 'Piano Technique', 'piano-technique'],
    ['lessons', 'Music Theory', 'music-theory'],
    ['lessons', 'Musical Expression', 'musical-expression'],
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
