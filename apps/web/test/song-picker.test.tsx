import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  SONG_GENRES,
  SONG_MOODS,
  buildSong,
  type SongGenre,
  type SongMood,
  type SongNote,
} from '@sonara/shared'
import { SONG_CATALOG } from '@/features/songs/catalog'
import { SongPicker, showMySongs } from '@/features/songs/SongPicker'
import { shortKey, songKey, sortKeys } from '@/features/songs/song-keys'
import { useSongStore } from '@/state/song-store'

/**
 * The song chooser: the dialog Songs opens on.
 *
 * It is the only way to a song, so what is pinned is the way through it: the
 * genres are shelves, one mood and one key at a time narrow a shelf, a search
 * looks past all three, and pressing a built-in song fetches its score, opens
 * it and gets out of the way.
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
/** The moods, which are a dropdown: all of them, or the one chosen. */
const moods = () => dialog().querySelector<HTMLSelectElement>('select[aria-label="Mood"]')!
/** A mood as the dropdown lists it: its name, and how many it would show. */
const mood = (name: string) =>
  [...moods().options].find((option) => option.textContent?.startsWith(name))!
const chooseMood = (name: string) =>
  fireEvent.change(moods(), { target: { value: mood(name).value } })
/** A key's button, by what it reads: "Cm" and how many, so "C" alone is asked for with its count. */
const key = (name: string) => starting('[aria-label="Key"] button', name) as HTMLButtonElement
const keys = () => [...dialog().querySelectorAll<HTMLButtonElement>('[aria-label="Key"] button')]
const inKey = (name: string, songs: readonly (typeof SONG_CATALOG)[number][] = SONG_CATALOG) =>
  songs.filter((entry) => entry.key === name)
/** The songs as All songs lists them: genre by genre, and in the catalog's order under each. */
const byGenre = (songs: readonly (typeof SONG_CATALOG)[number][]) =>
  SONG_GENRES.flatMap((genre) => songs.filter((entry) => entry.genre === genre.id))
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
/** A piece and which score of it: what the controls of its row are named for. */
const named = (entry: (typeof SONG_CATALOG)[number]) =>
  `${entry.title}${entry.edition ? `, ${entry.edition}` : ''}`
/** The shelf with the fewest songs, and another to move them to: an empty one if there is one. */
const shelvesToMoveBetween = () => {
  const held = SONG_GENRES.map((genre) => ({ genre, songs: inGenre(genre.id) }))
  const from = held
    .filter((each) => each.songs.length > 0)
    .sort((a, b) => a.songs.length - b.songs.length)[0]!
  const others = held.filter((each) => each !== from)
  return { from, to: others.find((each) => each.songs.length === 0) ?? others[0]! }
}

beforeEach(() => {
  vi.stubGlobal('fetch', serveScores())
  useSongStore.setState({ library: [], builtIn: [], currentId: null })
  // The chooser keeps the shelf and the key it was left on; each case starts
  // on the first shelf, in any key.
  show()
  fireEvent.click(shelf('All songs'))
  fireEvent.click(key('All keys'))
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
    // More rows than songs: Swan Lake is dramatic and tells a story.
    const listings = classical.reduce((sum, entry) => sum + entry.moods.length, 0)
    expect(listings).toBeGreaterThan(classical.length)
    expect(rows()).toHaveLength(listings)
    expect(rows().filter((row) => row.textContent?.startsWith('Swan Lake'))).toHaveLength(2)
  })

  it('narrows a genre to one mood at a time, and All widens it again', () => {
    show()
    fireEvent.click(shelf('Classical'))
    const classical = inGenre('classical')
    const dreamy = withMood('dreamy', classical)
    expect(dreamy.length).toBeGreaterThan(1)
    // Every mood to begin with, and each says how many of this genre it would show.
    expect(moods().value).toBe('')
    expect(mood('All moods').textContent).toBe(`All moods (${classical.length})`)
    expect(mood('Dreamy').textContent).toBe(`${label('dreamy')} (${dreamy.length})`)

    chooseMood('Dreamy')
    expect(moods().value).toBe('dreamy')
    expect(headings()).toEqual([label('dreamy')])
    // The catalog's own Dreamy songs, in its order, and no other mood's.
    expect(rows().map((row) => row.textContent)).toEqual(dreamy.map(written))

    // Another mood takes its place rather than joining it.
    chooseMood('Romantic')
    expect(moods().value).toBe('romantic')
    expect(headings()).toEqual([label('romantic')])
    expect(rows().map((row) => row.textContent)).toEqual(
      withMood('romantic', classical).map(written),
    )

    chooseMood('All moods')
    expect(moods().value).toBe('')
    expect(headings().length).toBeGreaterThan(2)
  })

  it('shows a mood across every genre from All songs, each song once', () => {
    show()
    chooseMood('Storytelling')
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
    chooseMood('Ominous')
    expect(moods().value).toBe('ominous')

    // A shelf that has songs, and a mood none of them has.
    const lacking = SONG_GENRES.flatMap((genre) =>
      SONG_MOODS.filter(
        (each) => inGenre(genre.id).length > 0 && withMood(each.id, inGenre(genre.id)).length === 0,
      ).map((each) => ({ genre, missing: each })),
    )[0]!
    const had = SONG_MOODS.find((each) => withMood(each.id, inGenre(lacking.genre.id)).length > 0)!
    fireEvent.click(shelf(lacking.genre.label))
    expect(moods().value).toBe('')
    expect(mood(lacking.missing.label).disabled).toBe(true)
    expect(mood(had.label).disabled).toBe(false)
  })

  it('changes the moods of a song, and tells the server', async () => {
    const changes: Change[] = []
    vi.stubGlobal('fetch', serveScores([], changes))
    show()
    fireEvent.click(shelf('Classical'))
    chooseMood('Dreamy')
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
    chooseMood('Romantic')
    expect(listed()).toBe(true)
  })

  it('moves a song to another genre, and tells the server', async () => {
    const changes: Change[] = []
    vi.stubGlobal('fetch', serveScores([], changes))
    show()
    const { from, to } = shelvesToMoveBetween()
    const arriving = (count: number) => `${to.genre.label}${to.songs.length + count}`
    expect(shelf(to.genre.label).textContent).toBe(arriving(0))
    fireEvent.click(shelf(from.genre.label))
    fireEvent.click(starting('footer button', 'Edit categories'))
    expect(rows()).toHaveLength(from.songs.length)

    // One at a time, each gone from this shelf and on the other as it is moved.
    for (const [index, entry] of from.songs.entries()) {
      fireEvent.change(within(dialog()).getByLabelText(`Genre for ${named(entry)}`), {
        target: { value: to.genre.id },
      })
      await waitFor(() => expect(changes).toHaveLength(index + 1))
      expect(changes[index]).toEqual({ songId: entry.id, genre: to.genre.id })
      expect(rows()).toHaveLength(from.songs.length - index - 1)
      expect(shelf(to.genre.label).textContent).toBe(arriving(index + 1))
      expect(shelf(to.genre.label).disabled).toBe(false)
    }
    // The last song out leaves the shelf empty, and still the one being looked at.
    expect(dialog().textContent).toContain(`Nothing in ${from.genre.label} yet.`)
    expect(shelf(from.genre.label).disabled).toBe(false)

    fireEvent.click(starting('footer button', 'Done'))
    fireEvent.click(shelf(to.genre.label))
    expect(shelf(from.genre.label).disabled).toBe(true)
    for (const entry of from.songs) {
      expect(rows().some((row) => row.textContent?.startsWith(entry.title))).toBe(true)
    }
  })

  it('files a song where the server says it was changed to, and leaves the rest of it alone', async () => {
    const { from, to } = shelvesToMoveBetween()
    const moved = from.songs[0]!
    vi.stubGlobal(
      'fetch',
      serveScores([
        { songId: moved.id, genre: to.genre.id, moods: ['dreamy'] },
        // Only its moods were changed: it is still in the genre it came in.
        { songId: 'debussy-arabesque-no-1', genre: null, moods: ['playful'] },
      ]),
    )
    show()
    await waitFor(() =>
      expect(shelf(to.genre.label).textContent).toBe(`${to.genre.label}${to.songs.length + 1}`),
    )
    fireEvent.click(shelf(to.genre.label))
    chooseMood('Dreamy')
    expect(headings()).toEqual([label('dreamy')])
    expect(rows().map((row) => row.textContent)).toContain(written(moved))

    fireEvent.click(shelf('Classical'))
    chooseMood('Playful')
    expect(rows().some((row) => row.textContent?.startsWith('Arabesque No. 1'))).toBe(true)
    chooseMood('Dreamy')
    expect(rows().some((row) => row.textContent?.startsWith('Arabesque No. 1'))).toBe(false)
  })

  it('searches every genre, mood and key at once, without minding accents', () => {
    show()
    fireEvent.click(shelf('Jazz'))
    chooseMood('Playful')
    fireEvent.click(
      keys().find((each) => each.getAttribute('aria-pressed') === 'false' && !each.disabled)!,
    )
    const search = within(dialog()).getByLabelText('Search songs')
    fireEvent.change(search, { target: { value: 'fur elise' } })
    // Every edition of it, however many the catalog holds, and nothing else.
    const editions = SONG_CATALOG.filter((song) => song.title === 'Für Elise').length
    expect(editions).toBeGreaterThan(1)
    expect(rows()).toHaveLength(editions)
    for (const row of rows()) expect(row.textContent).toContain('Für Elise')
    // The moods and the keys are put away: a search looks past them.
    expect(dialog().querySelector('[aria-label="Mood"]')).toBeNull()
    expect(dialog().querySelector('[aria-label="Key"]')).toBeNull()

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

  it('opens every song at its own tempo, however quick, and carries nothing over', async () => {
    vi.stubGlobal('fetch', serveScores())
    const onClose = vi.fn()
    show(onClose)

    // Maple Leaf Rag is written at a hundred, and opens at a hundred.
    fireEvent.click(song('Maple Leaf Rag'))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    const rag = useSongStore.getState()
    expect(rag.builtIn[0]!.bpm).toBe(100)
    expect(rag.tempoScale).toBe(1)

    // Turned down to half, which is the rag's and not the next song's: Ave
    // Maria at forty would have opened at twenty.
    act(() => useSongStore.getState().setTempoScale(0.5))
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
    // Their songs have no moods to narrow by, and their shelf is all of them.
    expect(dialog().querySelector('[aria-label="Mood"]')).toBeNull()
    expect(dialog().querySelector('[aria-label="Key"]')).toBeNull()
  })
})

describe('the keys of the song chooser', () => {
  const catalogKeys = sortKeys(SONG_CATALOG.map((entry) => entry.key))

  it('sorts keys A through G, and says a minor key with an m', () => {
    expect(
      sortKeys([
        'G minor',
        'C major',
        'A♭ major',
        'C♯ minor',
        'A minor',
        'C minor',
        'D♭ major',
        'D major',
        'C major',
      ]),
    ).toEqual([
      'A minor',
      'A♭ major',
      'C major',
      'C minor',
      'C♯ minor',
      'D major',
      'D♭ major',
      'G minor',
    ])
    expect(['E♭ major', 'C minor', 'F♯ minor', 'G major'].map(shortKey)).toEqual([
      'E♭',
      'Cm',
      'F♯m',
      'G',
    ])
  })

  it('has a button for every key a song is in, with how many it would show', () => {
    show()
    expect(catalogKeys.length).toBeGreaterThan(7)
    expect(keys().map((each) => each.textContent)).toEqual([
      `All keys${SONG_CATALOG.length}`,
      ...catalogKeys.map((name) => `${shortKey(name)}${inKey(name).length}`),
    ])
    expect(key('All keys').getAttribute('aria-pressed')).toBe('true')
    // Said in full to someone who cannot see the button.
    const first = catalogKeys[0]!
    expect(keys()[1]!.getAttribute('aria-label')).toMatch(new RegExp(`^${first}, \\d+ songs?$`))
  })

  it('narrows the list to one key at a time, and All keys widens it again', () => {
    show()
    const [one, another] = catalogKeys.filter((name) => inKey(name).length > 1)
    fireEvent.click(key(`${shortKey(one!)}${inKey(one!).length}`))
    expect(key(`${shortKey(one!)}${inKey(one!).length}`).getAttribute('aria-pressed')).toBe('true')
    expect(key('All keys').getAttribute('aria-pressed')).toBe('false')
    // The catalog's own songs in that key, each once, and no other key's.
    expect(rows().map((row) => row.textContent)).toEqual(byGenre(inKey(one!)).map(written))

    // Another key takes its place rather than joining it.
    fireEvent.click(key(`${shortKey(another!)}${inKey(another!).length}`))
    expect(keys().filter((each) => each.getAttribute('aria-pressed') === 'true')).toHaveLength(1)
    expect(rows().map((row) => row.textContent)).toEqual(byGenre(inKey(another!)).map(written))

    fireEvent.click(key('All keys'))
    expect(rows()).toHaveLength(SONG_CATALOG.length)
  })

  it('counts each mood in the key chosen, and each key in the mood chosen', () => {
    show()
    // A key whose songs do not have every mood between them.
    const name = catalogKeys.find(
      (each) =>
        inKey(each).length > 1 &&
        SONG_MOODS.some((mood) => withMood(mood.id, inKey(each)).length === 0),
    )!
    const songs = inKey(name)
    fireEvent.click(key(`${shortKey(name)}${songs.length}`))
    expect(mood('All moods').textContent).toBe(`All moods (${songs.length})`)
    for (const each of SONG_MOODS) {
      const count = withMood(each.id, songs).length
      expect(mood(each.label).textContent, each.id).toBe(`${each.label} (${count})`)
      expect(mood(each.label).disabled, each.id).toBe(count === 0)
    }

    const had = SONG_MOODS.find((each) => withMood(each.id, songs).length > 0)!
    chooseMood(had.label)
    expect(rows().map((row) => row.textContent)).toEqual(
      byGenre(withMood(had.id, songs)).map(written),
    )
    // The keys now count that mood's songs, and one none of them is in is held back.
    const moody = withMood(had.id)
    expect(key('All keys').textContent).toBe(`All keys${moody.length}`)
    for (const [index, each] of catalogKeys.entries()) {
      const count = inKey(each, moody).length
      expect(keys()[index + 1]!.textContent, each).toBe(`${shortKey(each)}${count}`)
      expect(keys()[index + 1]!.disabled, each).toBe(count === 0 && each !== name)
    }
  })

  it('keeps the key from shelf to shelf, where the mood is let go, and says so when nothing is in it', () => {
    show()
    // A key classical has, and a genre with songs and none in that key.
    const pick = catalogKeys.flatMap((name) => {
      const without = SONG_GENRES.find(
        (genre) => inGenre(genre.id).length > 0 && inKey(name, inGenre(genre.id)).length === 0,
      )
      return inKey(name, inGenre('classical')).length > 0 && without ? [{ name, without }] : []
    })[0]!
    fireEvent.click(shelf('Classical'))
    const classical = inKey(pick.name, inGenre('classical'))
    fireEvent.click(key(`${shortKey(pick.name)}${classical.length}`))
    const had = SONG_MOODS.find((each) => withMood(each.id, classical).length > 0)!
    chooseMood(had.label)
    expect(headings()).toEqual([had.label])

    fireEvent.click(shelf(pick.without.label))
    expect(moods().value).toBe('')
    const still = keys().find((each) => each.getAttribute('aria-pressed') === 'true')!
    expect(still.textContent).toBe(`${shortKey(pick.name)}0`)
    // Chosen, it is not held back, though it has nothing to show here.
    expect(still.disabled).toBe(false)
    expect(rows()).toHaveLength(0)
    expect(dialog().textContent).toContain(`No song here is in ${pick.name}.`)
  })

  it('lists the player’s own songs in a key with the built-in ones', () => {
    const notes: SongNote[] = [60, 62, 64, 65, 67, 69, 71, 72, 67, 64, 60].map((note, at) => ({
      note,
      velocity: 80,
      startMs: at * 400,
      durationMs: 400,
      hand: 'right',
      role: 'keyboard',
    }))
    const own = buildSong({
      id: 'own',
      title: 'A scale of my own',
      bpm: 150,
      beatsPerMeasure: 4,
      notes,
      source: 'midi',
      handsInferred: false,
    })
    const name = songKey(own)!
    expect(name).toBe('C major')
    useSongStore.setState({ library: [own] })
    show()

    // Counted with the built-in songs of its key, and listed among them.
    const count = inKey(name).length + 1
    expect(key('All keys').textContent).toBe(`All keys${SONG_CATALOG.length + 1}`)
    fireEvent.click(key(`${shortKey(name)}${count}`))
    expect(headings()[0]).toBe('My songs')
    expect(rows()).toHaveLength(count)
    expect(rows()[0]!.textContent).toContain('A scale of my own')

    // In another key it is not, and neither is its shelf's heading.
    const other = catalogKeys.find((each) => each !== name && inKey(each).length > 0)!
    fireEvent.click(key(`${shortKey(other)}${inKey(other).length}`))
    expect(headings()).not.toContain('My songs')
    expect(rows()).toHaveLength(inKey(other).length)
  })
})
