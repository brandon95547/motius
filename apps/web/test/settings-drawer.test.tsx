import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { buildSong } from '@motius/shared'
import { AudioProvider } from '@/audio/AudioProvider'
import { MidiProvider } from '@/midi/MidiProvider'
import { SettingsDrawer } from '@/components/SettingsDrawer'
import { TopBar } from '@/components/TopBar'
import { pageActions, usePageSync } from '@/state/page-store'
import { panelActions } from '@/state/panel-store'
import { useSongStore } from '@/state/song-store'

/**
 * Settings: what holds on every screen is there on every screen, and nothing
 * on the bar is repeated in it — the tempo and the metronome only where the
 * bar has folded them away, and Record not at all (it folds into the menu).
 */

const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } })

function Screen() {
  usePageSync()
  return (
    <QueryClientProvider client={queries}>
      <AudioProvider>
        <MidiProvider>
          <TopBar />
          <SettingsDrawer
            instruments={[]}
            selectedId={null}
            onSelectInstrument={() => {}}
            catalogueFailed={false}
          />
        </MidiProvider>
      </AudioProvider>
    </QueryClientProvider>
  )
}

const song = buildSong({
  id: 'settings',
  title: 'Settings',
  bpm: 100,
  beatsPerMeasure: 4,
  notes: [{ note: 60, velocity: 80, startMs: 0, durationMs: 500, hand: 'right', role: 'keyboard' }],
  source: 'midi',
  handsInferred: false,
})

const open = async (area: 'scales' | 'songs') => {
  render(<Screen />)
  act(() => pageActions.openArea(area))
  await waitFor(() => expect(globalThis.location.hash).toBe(`#/${area}`))
  act(() => panelActions.open('settings'))
  return screen.getByRole('dialog', { name: 'Settings' })
}

afterEach(() => {
  act(() => panelActions.close())
  cleanup()
})

describe('Settings', () => {
  it('chooses the fingering system on a song too, which fingers what its file did not', async () => {
    useSongStore.setState({ library: [song], currentId: song.id })
    const settings = await open('songs')
    expect(within(settings).getByLabelText('Fingering system')).toBeDefined()
  })

  it('has the fingering system with an exercise', async () => {
    const settings = await open('scales')
    expect(within(settings).getByLabelText('Fingering system')).toBeDefined()
  })

  it('repeats nothing on the bar: tempo and metronome only where it folds them, no Record', async () => {
    for (const area of ['scales', 'songs'] as const) {
      useSongStore.setState({ library: [song], currentId: song.id })
      const settings = await open(area)
      expect(within(settings).queryByRole('button', { name: /record/i })).toBeNull()
      const tempo = within(settings).getByText('Tempo').closest('div')!
      const click = within(settings).getByText('Metronome').closest('div')!
      expect(tempo.classList.contains('panel-only-xs')).toBe(true)
      // A song's lives in a section shown only as narrow; an exercise's beside auto tempo.
      expect(
        click.classList.contains('panel-only-mid') || click.closest('.panel-only-mid') !== null,
      ).toBe(true)
      act(() => panelActions.close())
      cleanup()
    }
  })

  it('has no Hand position button on a song: the fingers are on the keys', async () => {
    useSongStore.setState({ library: [song], currentId: song.id })
    await open('songs')
    expect(screen.queryByRole('button', { name: 'Hand position' })).toBeNull()
    cleanup()
    await open('scales')
    expect(screen.getByRole('button', { name: 'This run' })).toBeDefined()
  })
})
