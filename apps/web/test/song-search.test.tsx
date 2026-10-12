import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildSong, type SongNote } from '@motius/shared'
import { SONG_CATALOG } from '@/features/songs/catalog'
import { SongSearch } from '@/features/songs/SongSearch'
import { MATCH_LIMIT, findSongs } from '@/features/songs/song-search'
import { useSongStore } from '@/state/song-store'

/**
 * The bar's song search: a few letters, the songs that have them, and the one
 * chosen opened without the chooser ever being on screen.
 */

const note = (pitch: number, startMs: number): SongNote => ({
  note: pitch,
  velocity: 80,
  startMs,
  durationMs: 400,
  hand: 'right',
  role: 'keyboard',
})
const own = buildSong({
  id: 'own',
  title: 'Moonrise of my own',
  bpm: 100,
  beatsPerMeasure: 4,
  notes: [note(60, 0), note(62, 400)],
  source: 'midi',
  handsInferred: false,
})

describe('finding a song by some of its name', () => {
  const titles = (query: string, library = [own]) =>
    findSongs(query, library).matches.map((match) => match.title)

  it('finds nothing until something is typed', () => {
    expect(findSongs('', [own])).toEqual({ matches: [], more: 0 })
    expect(findSongs('   ', [own])).toEqual({ matches: [], more: 0 })
  })

  it('puts a title that begins with it first, the player’s own before the catalog’s', () => {
    expect(titles('moon')).toEqual([
      'Moonrise of my own',
      ...SONG_CATALOG.filter((entry) => entry.title.startsWith('Moonlight')).map(
        (entry) => entry.title,
      ),
    ])
  })

  it('does not mind accents or capitals, and finds a song by who wrote it', () => {
    expect(titles('fur elise').every((title) => title === 'Für Elise')).toBe(true)
    expect(titles('FUR ELISE').length).toBeGreaterThan(1)
    // Found by the composer, after any found by the title.
    const satie = findSongs('satie', []).matches
    expect(satie.map((match) => match.title)).toEqual(['Gnossienne No. 1', 'Gymnopédie No. 1'])
    expect(satie[0]!.detail).toBe('Erik Satie')
  })

  it('says which score of a piece each is, and that a song is the player’s', () => {
    const elise = findSongs('für elise', [own]).matches.map((match) => match.detail)
    expect(elise).toContain('Ludwig van Beethoven · Easy')
    expect(findSongs('moonrise', [own]).matches[0]).toMatchObject({
      id: 'own',
      detail: 'Your song',
    })
  })

  it('lists a handful and says how many it left out', () => {
    const wide = findSongs('a', [])
    expect(wide.matches).toHaveLength(MATCH_LIMIT)
    expect(wide.more).toBeGreaterThan(0)
    // Titles that begin with it come before titles that only have it.
    expect(wide.matches[0]!.title.toLowerCase().startsWith('a')).toBe(true)
  })
})

const score = (id: string) =>
  new Uint8Array(readFileSync(path.join(import.meta.dirname, '..', 'public', 'songs', `${id}.mxl`)))
const serveScores = () =>
  vi.fn(async (url: string) => {
    const bytes = score(/songs\/(.+)\.mxl$/.exec(url)![1]!)
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () =>
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    }
  })

const field = () => screen.getByRole('combobox', { name: 'Search songs' }) as HTMLInputElement
const type = (text: string) => {
  fireEvent.focus(field())
  fireEvent.change(field(), { target: { value: text } })
}
const options = () => screen.queryAllByRole('option').map((option) => option.textContent)

beforeEach(() => {
  vi.stubGlobal('fetch', serveScores())
  useSongStore.setState({ library: [], builtIn: [], currentId: null })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('the song search on the bar', () => {
  it('is one empty field until something is typed, and then lists the songs that match', () => {
    render(<SongSearch />)
    expect(field().value).toBe('')
    expect(field().getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('listbox')).toBeNull()

    type('gymno')
    expect(field().getAttribute('aria-expanded')).toBe('true')
    expect(options()).toEqual(['Gymnopédie No. 1Erik Satie'])
  })

  it('opens the song chosen with Enter, fetching its score, and puts the field back', async () => {
    const fetched = serveScores()
    vi.stubGlobal('fetch', fetched)
    render(<SongSearch />)
    type('maple')
    fireEvent.keyDown(field(), { key: 'Enter' })

    await waitFor(() =>
      expect(useSongStore.getState().currentId).toBe('catalog:joplin-maple-leaf-rag'),
    )
    expect(fetched).toHaveBeenCalledTimes(1)
    expect(useSongStore.getState().builtIn.map((song) => song.title)).toEqual(['Maple Leaf Rag'])
    await waitFor(() => expect(field().value).toBe(''))
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('moves through the list with the arrows, and opens the one pressed', async () => {
    render(<SongSearch />)
    type('moonlight')
    const [first, second] = screen.getAllByRole('option')
    expect(first!.dataset.active).toBe('true')
    fireEvent.keyDown(field(), { key: 'ArrowDown' })
    expect(second!.dataset.active).toBe('true')
    expect(field().getAttribute('aria-activedescendant')).toBe(second!.id)
    // No further than the last.
    fireEvent.keyDown(field(), { key: 'ArrowDown' })
    expect(second!.dataset.active).toBe('true')

    fireEvent.click(first!)
    const wanted = SONG_CATALOG.find((entry) => entry.title.startsWith('Moonlight'))!
    await waitFor(() => expect(useSongStore.getState().currentId).toBe(`catalog:${wanted.id}`))
  })

  it('opens a song it already has, and one of the player’s own, without fetching', async () => {
    const fetched = serveScores()
    vi.stubGlobal('fetch', fetched)
    useSongStore.setState({ library: [own] })
    render(<SongSearch />)

    type('moonrise')
    expect(options()).toEqual(['Moonrise of my ownYour song'])
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(useSongStore.getState().currentId).toBe('own')
    expect(fetched).not.toHaveBeenCalled()

    type('maple')
    fireEvent.keyDown(field(), { key: 'Enter' })
    await waitFor(() =>
      expect(useSongStore.getState().currentId).toBe('catalog:joplin-maple-leaf-rag'),
    )
    type('moonrise')
    fireEvent.keyDown(field(), { key: 'Enter' })
    type('maple')
    // Marked as the one it was, and opened again from what is held.
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(useSongStore.getState().currentId).toBe('catalog:joplin-maple-leaf-rag')
    expect(fetched).toHaveBeenCalledTimes(1)
  })

  it('says so when nothing matches, and when a score does not arrive', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404 })),
    )
    render(<SongSearch />)
    type('no such piece')
    expect(options()).toEqual([])
    expect(screen.getByRole('listbox').textContent).toContain('No song matches “no such piece”.')

    type('swan lake')
    fireEvent.keyDown(field(), { key: 'Enter' })
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Could not load Swan Lake')
    expect(useSongStore.getState().currentId).toBeNull()
    // Still there to be chosen again.
    expect(field().value).toBe('swan lake')
  })

  it('clears what was typed on Escape, and shuts its list when the field is left', () => {
    render(<SongSearch />)
    type('bach')
    expect(options().length).toBeGreaterThan(1)
    fireEvent.keyDown(field(), { key: 'Escape' })
    expect(field().value).toBe('')
    expect(screen.queryByRole('listbox')).toBeNull()

    type('bach')
    fireEvent.blur(field())
    expect(screen.queryByRole('listbox')).toBeNull()
    // What was typed is kept for coming back to.
    expect(field().value).toBe('bach')
  })
})
