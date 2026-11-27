import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Instrument } from '@motius/shared'
import { AudioProvider } from '@/audio/AudioProvider'
import { AppShell } from '@/components/AppShell'
import { MidiProvider } from '@/midi/MidiProvider'
import { api } from '@/lib/api'
import { useAccountStore } from '@/state/account-store'

/**
 * The piano a player hears on arrival: the one they chose last, or the
 * server's default. Only their own choice is remembered, so one who never
 * chose hears the default as it changes.
 */

const piano = (id: string, name: string): Instrument => ({
  id,
  name,
  description: name,
  family: 'acoustic',
  character: [],
  engine: { kind: 'synth' },
  voicing: {
    partials: [{ ratio: 1, gain: 1, decay: 1 }],
    attack: 0.01,
    release: 0.3,
    brightness: 6000,
    detune: 0,
    hammer: 0,
  },
  gainDb: 0,
  range: { low: 21, high: 108 },
})

const KEY = 'motius:instrument'

// The piano the sound loads, which is the pick made. Kept from the real sound,
// which jsdom cannot play.
const loaded = vi.hoisted(() => vi.fn())
vi.mock('@/audio/AudioProvider', async (actual) => {
  const real = await actual<typeof import('@/audio/AudioProvider')>()
  return { ...real, useAudio: () => ({ ...real.useAudio(), loadInstrument: loaded }) }
})

const arrive = async () => {
  const listed = vi.spyOn(api, 'listInstruments').mockResolvedValue({
    items: [piano('bright-upright', 'Bright Upright'), piano('concert-grand', 'Concert Grand')],
    defaultInstrumentId: 'concert-grand',
  })
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <AudioProvider>
        <MidiProvider>
          <AppShell />
        </MidiProvider>
      </AudioProvider>
    </QueryClientProvider>,
  )
  await waitFor(() => expect(listed).toHaveBeenCalled())
  await waitFor(() => expect(loaded).toHaveBeenCalled())
  return (loaded.mock.calls[0]![0] as Instrument).id
}

beforeEach(() => {
  loaded.mockClear()
  globalThis.localStorage.clear()
  useAccountStore.setState({
    status: 'signed-in',
    user: { email: 'player@example.com', name: 'Someone', picture: null, isAdmin: false },
    error: null,
  })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('the piano on arrival', () => {
  it('plays the default without remembering it as the player’s choice', async () => {
    expect(await arrive()).toBe('concert-grand')
    expect(globalThis.localStorage.getItem(KEY)).toBeNull()
  })

  it('keeps the piano the player chose last', async () => {
    globalThis.localStorage.setItem(KEY, 'bright-upright')
    expect(await arrive()).toBe('bright-upright')
    expect(globalThis.localStorage.getItem(KEY)).toBe('bright-upright')
  })
})
