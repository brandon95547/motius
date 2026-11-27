import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildSong, type SongNote } from '@motius/shared'
import { AudioProvider } from '@/audio/AudioProvider'
import { MidiProvider } from '@/midi/MidiProvider'
import { TopBar } from '@/components/TopBar'
import { SongExport } from '@/features/songs/SongExport'
import { pageActions, usePageStore, usePageSync } from '@/state/page-store'
import { usePanelStore } from '@/state/panel-store'
import { useSongStore } from '@/state/song-store'

/**
 * Export lives in the bar's menu, right under Import, and only while a song is
 * open in Songs. It opens one dialog that saves the song as MusicXML or MIDI.
 */

const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } })

function Bar() {
  usePageSync()
  return (
    <QueryClientProvider client={queries}>
      <AudioProvider>
        <MidiProvider>
          <TopBar />
        </MidiProvider>
      </AudioProvider>
    </QueryClientProvider>
  )
}

const note = (pitch: number, hand: 'left' | 'right'): SongNote => ({
  note: pitch,
  velocity: 80,
  hand,
  role: 'keyboard',
  startMs: 0,
  durationMs: 2000,
  startQ: 0,
  durationQ: 4,
})

const song = buildSong({
  id: 'export-test',
  title: 'Export Test',
  bpm: 120,
  beatsPerMeasure: 4,
  source: 'musicxml',
  handsInferred: false,
  rhythmFromScore: true,
  notes: [note(60, 'right'), note(48, 'left')],
})

afterEach(() => {
  cleanup()
  globalThis.location.hash = ''
  usePanelStore.getState().close()
  vi.restoreAllMocks()
})

/** A blob's bytes: jsdom's Blob reads only through a FileReader. */
const bytesOf = (blob: Blob) =>
  new Promise<Uint8Array>((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.readAsArrayBuffer(blob)
  })

const menuLabels = () =>
  within(screen.getByRole('menu'))
    .getAllByRole('menuitem')
    .map((item) => item.textContent?.trim())

describe('exporting the song on the stage', () => {
  it('offers Export under Import only once a song is open, and opens its dialog', async () => {
    render(<Bar />)
    act(() => pageActions.openArea('songs'))
    await waitFor(() => expect(usePageStore.getState().page).toBe('area'))
    act(() => usePanelStore.getState().close())

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    expect(menuLabels()).not.toContain('Export this song…')
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })

    act(() => useSongStore.getState().openBuiltIn(song))
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    const labels = menuLabels()
    expect(labels.indexOf('Export this song…')).toBe(labels.indexOf('Import a song…') + 1)

    fireEvent.click(screen.getByRole('menuitem', { name: 'Export this song…' }))
    expect(usePanelStore.getState().panel).toBe('export')
  })

  it('saves the song as MusicXML and as MIDI', async () => {
    act(() => useSongStore.getState().openBuiltIn(song))
    const saved: Blob[] = []
    globalThis.URL.createObjectURL = vi.fn((blob: Blob) => {
      saved.push(blob)
      return 'blob:test'
    })
    globalThis.URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    render(<SongExport open onClose={() => {}} />)
    const dialog = screen.getByRole('dialog', { name: 'Export Test' })
    fireEvent.click(within(dialog).getByRole('button', { name: /^\.musicxml\s*MusicXML/ }))
    fireEvent.click(within(dialog).getByRole('button', { name: /^\.mid\s*MIDI/ }))

    expect(saved.map((blob) => blob.type)).toEqual([
      'application/vnd.recordare.musicxml+xml',
      'audio/midi',
    ])
    expect(new TextDecoder().decode(await bytesOf(saved[0]!))).toContain('<staves>2</staves>')
    const midi = await bytesOf(saved[1]!)
    expect(String.fromCharCode(...midi.slice(0, 4))).toBe('MThd')
  })
})
