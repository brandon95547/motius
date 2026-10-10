import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SONG_GENRES, SONG_MOODS, type SongGenre, type SongMood } from '@sonara/shared'
import { SONG_CATALOG } from '@/features/songs/catalog'
import { SongPicker, showMySongs } from '@/features/songs/SongPicker'
import { useSongStore } from '@/state/song-store'

/**
 * The song chooser: the dialog Songs opens on.
 *
 * It is the only way to a song, so what is pinned is the way through it: the
 * genres are shelves, the moods narrow a shelf, a search looks past both, and
 * pressing a built-in song fetches its score, opens it and gets out of the way.
 */

// jsdom has no layout and so no media queries; the dialog asks one to know
// whether it is on a phone. Nothing matches, which is the desktop it is drawn for.
globalThis.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  addEventListener: () => {},
  removeEventListener: () => {},
})) as unknown as typeof globalThis.matchMedia

const score = (id: string) =>
  new Uint8Array(readFileSync(path.join(import.meta.dirname, '..', 'public', 'songs', `${id}.mxl`)))

type Change = { songId: string; genre?: string; moods?: string[] }
type Stored = { songId: string; genre: string | null; moods: string[] | null }

/**
 * Answers what the chooser asks for: a built-in score, from the folder the app
 * serves, and the server's list of songs that have been changed, which it also
 * takes changes into the way the server does: what a change leaves out stays.
 */
const serveScores = (stored: Stored[] = [], changes: Change[] = []) =>
  vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
    const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body })
    const changing = /songs\/([a-z0-9-]+)\/category$/.exec(url)
    if (changing) {
      const change: Change = { songId: changing[1]!, ...JSON.parse(init!.body!) }
      changes.push(change)
      const earlier = stored.find((item) => item.songId === change.songId)
      const now = {
        songId: change.songId,
        genre: change.genre ?? earlier?.genre ?? null,
        moods: change.moods ?? earlier?.moods ?? null,
      }
      stored.splice(0, stored.length, ...stored.filter((item) => item !== earlier), now)
      return json(now)
    }
    if (url.endsWith('/songs/categories')) return json({ items: [...stored] })
    const bytes = score(/songs\/(.+)\.mxl$/.exec(url)![1]!)
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () =>
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    }
  })

/** The scores a fetch stub was asked for, leaving out what was asked of the server. */
const scoresAsked = (fetched: ReturnType<typeof serveScores>) =>
  fetched.mock.calls.map((call) => String(call[0])).filter((url) => url.endsWith('.mxl'))

/** The chooser as the app mounts it: inside the thing that asks the server. */
const show = (onClose: () => void = () => {}) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <SongPicker open onClose={onClose} />
    </QueryClientProvider>,
  )

// Found by where they are rather than by role: working out the accessible name
// of every row to find one of them takes jsdom a second a query.
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')!
const starting = (selector: string, text: string) =>
  [...dialog().querySelectorAll<HTMLElement>(selector)].find((element) =>
    element.textContent?.startsWith(text),
  )!
const shelf = (name: string) => starting('[aria-label="Show"] button', name) as HTMLButtonElement
const mood = (name: string) => starting('[aria-label="Moods"] button', name) as HTMLButtonElement
const song = (title: string) => starting('li button', title)
const rows = () => [...dialog().querySelectorAll('li')]
const headings = () => [...dialog().querySelectorAll('h3')].map((heading) => heading.textContent)
/** A row as the list writes it: the title, then who wrote it and which score. */
const written = (entry: (typeof SONG_CATALOG)[number]) =>
  `${entry.title}${entry.composer}${entry.edition ? ` · ${entry.edition}` : ''}`
const inGenre = (genre: SongGenre) => SONG_CATALOG.filter((entry) => entry.genre === genre)
const withMood = (id: SongMood, songs: readonly (typeof SONG_CATALOG)[number][] = SONG_CATALOG) =>
  songs.filter((entry) => entry.moods.includes(id))
const label = (id: SongMood) => SONG_MOODS.find((each) => each.id === id)!.label

beforeEach(() => {
  vi.stubGlobal('fetch', serveScores())
  useSongStore.setState({ library: [], builtIn: [], currentId: null })
  // The chooser keeps the shelf it was left on; each case starts on the first.
  show()
  fireEvent.click(shelf('All songs'))
  cleanup()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('the song chooser', () => {
  it('lists every built-in song under its genre', () => {
    show()
    expect(screen.getByRole('dialog', { name: 'Choose a song' })).toBe(dialog())
    expect(rows()).toHaveLength(SONG_CATALOG.length)
    expect(headings()).toEqual(
      SONG_GENRES.filter((genre) => inGenre(genre.id).length > 0).map((genre) => genre.label),
    )
  })

  it('names every genre down the side with how many it holds, and holds back the empty ones', () => {
    show()
    for (const genre of SONG_GENRES) {
      const count = inGenre(genre.id).length
      expect(shelf(genre.label).textContent, genre.id).toBe(`${genre.label}${count}`)
      expect(shelf(genre.label).disabled, genre.id).toBe(count === 0)
    }
    // The player's own are never held back: that shelf is where importing is.
    expect(shelf('My songs').disabled).toBe(false)
  })

  it('lays one genre out mood by mood, with a song under each mood it has', () => {
    show()
    fireEvent.click(shelf('Classical'))
    expect(shelf('Classical').getAttribute('aria-pressed')).toBe('true')
    const classical = inGenre('classical')
    expect(headings()).toEqual(
      SONG_MOODS.filter((each) => withMood(each.id, classical).length > 0).map(
        (each) => each.label,
      ),
    )
    // More rows than songs: the Ballade is dramatic and tells a story.
    const listings = classical.reduce((sum, entry) => sum + entry.moods.length, 0)
    expect(listings).toBeGreaterThan(classical.length)
    expect(rows()).toHaveLength(listings)
    expect(rows().filter((row) => row.textContent?.startsWith('Ballade No. 1'))).toHaveLength(2)
  })

  it('narrows a genre to the moods switched on, and widens it again', () => {
    show()
    fireEvent.click(shelf('Classical'))
    const classical = inGenre('classical')
    const dreamy = withMood('dreamy', classical)
    expect(dreamy.length).toBeGreaterThan(1)
    // Each mood says how many of this genre it would show.
    expect(mood('Dreamy').textContent).toBe(`${label('dreamy')}${dreamy.length}`)

    fireEvent.click(mood('Dreamy'))
    expect(mood('Dreamy').getAttribute('aria-pressed')).toBe('true')
    expect(headings()).toEqual([label('dreamy')])
    // The catalog's own Dreamy songs, in its order, and no other mood's.
    expect(rows().map((row) => row.textContent)).toEqual(dreamy.map(written))

    // A second mood adds its songs rather than asking for both at once.
    fireEvent.click(mood('Romantic'))
    expect(headings()).toEqual([label('dreamy'), label('romantic')])
    expect(rows()).toHaveLength(dreamy.length + withMood('romantic', classical).length)

    fireEvent.click(starting('[aria-label="Moods"] button', 'Clear'))
    expect(mood('Dreamy').getAttribute('aria-pressed')).toBe('false')
    expect(headings().length).toBeGreaterThan(2)
  })

  it('shows a mood across every genre from All songs, each song once', () => {
    show()
    fireEvent.click(mood('Storytelling'))
    const stories = withMood('storytelling')
    expect(new Set(stories.map((entry) => entry.genre)).size).toBeGreaterThan(1)
    expect(headings()).toEqual(
      SONG_GENRES.filter((genre) => withMood('storytelling', inGenre(genre.id)).length > 0).map(
        (genre) => genre.label,
      ),
    )
    expect(rows()).toHaveLength(stories.length)
  })

  it('starts another shelf with every mood, and holds back a mood nothing there has', () => {
    show()
    fireEvent.click(shelf('Classical'))
    fireEvent.click(mood('Ominous'))
    expect(mood('Ominous').getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(shelf('Jazz'))
    expect(withMood('ominous', inGenre('jazz'))).toEqual([])
    expect(mood('Ominous').getAttribute('aria-pressed')).toBe('false')
    expect(mood('Ominous').disabled).toBe(true)
    expect(mood('Playful').disabled).toBe(false)
  })

  it('changes the moods of a song, and tells the server', async () => {
    const changes: Change[] = []
    vi.stubGlobal('fetch', serveScores([], changes))
    show()
    fireEvent.click(shelf('Classical'))
    fireEvent.click(mood('Dreamy'))
    fireEvent.click(starting('footer button', 'Edit categories'))
    // Each row is now two choices rather than a song to open, and each song is
    // there once however many moods it has.
    const dreamy = withMood('dreamy', inGenre('classical'))
    expect(rows()).toHaveLength(dreamy.length)

    const arabesque = 'Arabesque No. 1 in E Major'
    const listed = () => rows().some((row) => row.textContent?.startsWith(arabesque))
    fireEvent.click(within(dialog()).getByLabelText(`Moods for ${arabesque}: ${label('dreamy')}`))
    const choice = (name: string) =>
      starting(`[aria-label="Moods for ${arabesque}"] button`, name) as HTMLButtonElement

    fireEvent.click(choice('Romantic'))
    await waitFor(() =>
      expect(changes).toEqual([
        { songId: 'debussy-arabesque-no-1', moods: ['dreamy', 'romantic'] },
      ]),
    )
    // Switched off the mood it was found under, it stays while it is being changed.
    fireEvent.click(choice('Dreamy'))
    await waitFor(() =>
      expect(changes[1]).toEqual({ songId: 'debussy-arabesque-no-1', moods: ['romantic'] }),
    )
    expect(listed()).toBe(true)
    // A song keeps one mood: the last is not to be switched off.
    expect(choice('Romantic').getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(choice('Romantic'))
    expect(changes).toHaveLength(2)

    fireEvent.click(starting('footer button', 'Done'))
    expect(listed()).toBe(false)
    fireEvent.click(mood('Dreamy'))
    fireEvent.click(mood('Romantic'))
    expect(listed()).toBe(true)
  })

  it('moves a song to another genre, and tells the server', async () => {
    const changes: Change[] = []
    vi.stubGlobal('fetch', serveScores([], changes))
    show()
    expect(inGenre('jazz').map((entry) => entry.title)).toEqual([
      'The Entertainer',
      'Maple Leaf Rag',
    ])
    expect(shelf('Blues').disabled).toBe(true)
    fireEvent.click(shelf('Jazz'))
    fireEvent.click(starting('footer button', 'Edit categories'))

    fireEvent.change(within(dialog()).getByLabelText('Genre for Maple Leaf Rag'), {
      target: { value: 'blues' },
    })
    await waitFor(() =>
      expect(changes).toEqual([{ songId: 'joplin-maple-leaf-rag', genre: 'blues' }]),
    )
    // Gone from this shelf, and on the other, which is no longer empty.
    expect(rows().map((row) => row.textContent?.slice(0, 15))).toEqual(['The Entertainer'])
    expect(shelf('Blues').textContent).toBe('Blues1')
    expect(shelf('Blues').disabled).toBe(false)

    // The last song out leaves the shelf empty, and still the one being looked at.
    fireEvent.change(within(dialog()).getByLabelText('Genre for The Entertainer'), {
      target: { value: 'blues' },
    })
    await waitFor(() => expect(changes).toHaveLength(2))
    expect(rows()).toHaveLength(0)
    expect(dialog().textContent).toContain('Nothing in Jazz yet.')
    expect(shelf('Jazz').disabled).toBe(false)

    fireEvent.click(starting('footer button', 'Done'))
    fireEvent.click(shelf('Blues'))
    expect(shelf('Jazz').disabled).toBe(true)
    expect(rows().some((row) => row.textContent?.startsWith('Maple Leaf Rag'))).toBe(true)
  })

  it('files a song where the server says it was changed to, and leaves the rest of it alone', async () => {
    vi.stubGlobal(
      'fetch',
      serveScores([
        { songId: 'joplin-maple-leaf-rag', genre: 'blues', moods: ['dreamy'] },
        // Only its moods were changed: it is still in the genre it came in.
        { songId: 'debussy-arabesque-no-1', genre: null, moods: ['playful'] },
      ]),
    )
    show()
    await waitFor(() => expect(shelf('Blues').disabled).toBe(false))
    fireEvent.click(shelf('Blues'))
    expect(headings()).toEqual([label('dreamy')])
    expect(rows().map((row) => row.textContent)).toEqual(['Maple Leaf RagScott Joplin'])

    fireEvent.click(shelf('Classical'))
    fireEvent.click(mood('Playful'))
    expect(rows().some((row) => row.textContent?.startsWith('Arabesque No. 1'))).toBe(true)
  })

  it('searches every genre and mood at once, without minding accents', () => {
    show()
    fireEvent.click(shelf('Jazz'))
    fireEvent.click(mood('Playful'))
    const search = within(dialog()).getByLabelText('Search songs')
    fireEvent.change(search, { target: { value: 'fur elise' } })
    // Every edition of it, however many the catalog holds, and nothing else.
    const editions = SONG_CATALOG.filter((song) => song.title === 'Für Elise').length
    expect(editions).toBeGreaterThan(1)
    expect(rows()).toHaveLength(editions)
    for (const row of rows()) expect(row.textContent).toContain('Für Elise')
    // The moods are put away: a search looks past them.
    expect(dialog().querySelector('[aria-label="Moods"]')).toBeNull()

    fireEvent.change(search, { target: { value: 'no such piece' } })
    expect(rows()).toHaveLength(0)
    expect(dialog().textContent).toContain('No song matches “no such piece”.')
  })

  it('fetches a built-in song when it is pressed, opens it, and closes', async () => {
    const fetched = serveScores()
    vi.stubGlobal('fetch', fetched)
    const onClose = vi.fn()
    show(onClose)

    fireEvent.click(song('Maple Leaf Rag'))
    await waitFor(() => expect(onClose).toHaveBeenCalled())

    expect(scoresAsked(fetched)).toEqual([
      expect.stringMatching(/songs\/joplin-maple-leaf-rag\.mxl$/),
    ])
    const state = useSongStore.getState()
    expect(state.currentId).toBe('catalog:joplin-maple-leaf-rag')
    expect(state.builtIn.map((song) => song.title)).toEqual(['Maple Leaf Rag'])
    // It came with the app, so it is not one of the player's own, and not stored.
    expect(state.library).toEqual([])
  })

  it('opens a song it already has without fetching it again, and marks it as the open one', async () => {
    const fetched = serveScores()
    vi.stubGlobal('fetch', fetched)
    const onClose = vi.fn()
    show(onClose)
    const maple = () => song('Maple Leaf Rag')

    fireEvent.click(maple())
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(maple().getAttribute('aria-current')).toBe('true')
    expect(maple().textContent).toContain('Open')

    fireEvent.click(maple())
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(scoresAsked(fetched)).toHaveLength(1)
  })

  it('opens a quick song at ninety, and a slow one at its own tempo', async () => {
    vi.stubGlobal('fetch', serveScores())
    const onClose = vi.fn()
    show(onClose)

    // Maple Leaf Rag is written at a hundred.
    fireEvent.click(song('Maple Leaf Rag'))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    const rag = useSongStore.getState()
    expect(rag.builtIn[0]!.bpm).toBe(100)
    expect(rag.builtIn[0]!.bpm * rag.tempoScale).toBeCloseTo(90, 5)

    // Ave Maria at forty: nothing to slow down, and nothing carried over from
    // the rag, whose nine tenths would have made it thirty-six.
    fireEvent.click(song('Ave Maria'))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(2))
    expect(useSongStore.getState().tempoScale).toBe(1)
  })

  it('says so when a score does not arrive, and stays open', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/songs/categories')
          ? { ok: true, status: 200, json: async () => ({ items: [] }) }
          : { ok: false, status: 404 },
      ),
    )
    const onClose = vi.fn()
    show(onClose)

    fireEvent.click(song('Swan Lake'))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Could not load Swan Lake')
    expect(onClose).not.toHaveBeenCalled()
    expect(useSongStore.getState().currentId).toBeNull()
  })

  it('turns to the player’s own songs when asked, which is where importing is', () => {
    showMySongs()
    show()
    expect(shelf('My songs').getAttribute('aria-pressed')).toBe('true')
    expect(dialog().textContent).toContain('Nothing imported yet.')
    expect(starting('footer button', 'Import a song')).toBeTruthy()
    // Their songs have no moods to narrow by.
    expect(dialog().querySelector('[aria-label="Moods"]')).toBeNull()
  })
})
