import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildSong, type SongNote } from '@motius/shared'
import { AudioProvider } from '@/audio/AudioProvider'
import { MidiProvider } from '@/midi/MidiProvider'
import { PlayControls } from '@/components/PlayControls'
import { useLearningStore } from '@/state/learning-store'
import { useSongStore } from '@/state/song-store'

/**
 * The bar's one Play button, and what each mode makes of it: Listen plays the
 * music to you, Learn and Practice start a run. Once something is going it is
 * Pause and Go on, with the way back to the start beside it. Space presses it.
 */

const learning = () => useLearningStore.getState()
const songs = () => useSongStore.getState()
const button = (name: string | RegExp) => screen.getByRole('button', { name })
const space = (target: Element = document.body) => {
  fireEvent.keyDown(target, { code: 'Space', key: ' ' })
  fireEvent.keyUp(target, { code: 'Space', key: ' ' })
}
const bar = () =>
  render(
    <AudioProvider>
      <QueryClientProvider client={new QueryClient()}>
        <MidiProvider>
          <PlayControls />
        </MidiProvider>
      </QueryClientProvider>
    </AudioProvider>,
  )

afterEach(() => {
  cleanup()
  act(() => {
    learning().reset()
    songs().setMode('listen')
  })
})

describe('an exercise', () => {
  beforeEach(() =>
    act(() => {
      learning().setTopic('scales')
      learning().setMode('listen')
    }),
  )

  it('in Listen, plays the exercise to you, and pauses and goes back to the start', () => {
    bar()
    fireEvent.click(button('Play the scale'))
    expect(button('Pause')).toBeDefined()
    expect(button('Back to the start')).toBeDefined()
    fireEvent.click(button('Pause'))
    expect(button('Go on')).toBeDefined()
    expect(learning().session.status).toBe('idle')
  })

  it('plays and pauses on Space, as Play does', () => {
    bar()
    space()
    expect(button('Pause')).toBeDefined()
    space()
    expect(button('Go on')).toBeDefined()
  })

  it('leaves Space alone in a field, and never stops a run with it', () => {
    act(() => learning().setMode('learn'))
    render(<input aria-label="Search" />)
    bar()
    space(screen.getByRole('textbox', { name: 'Search' }))
    expect(learning().session.status).toBe('idle')
    space()
    expect(learning().session.status).toBe('running')
    // Over the staff a Learn run has no pause, only Stop: Space leaves it be.
    space()
    expect(learning().session.status).toBe('running')
  })

  it('in Learn and Practice, starts a run', () => {
    act(() => learning().setMode('practice'))
    bar()
    fireEvent.click(button('Start'))
    expect(learning().session.status).toBe('running')
  })
})

describe('a song', () => {
  const note = (pitch: number, startMs: number): SongNote => ({
    note: pitch,
    velocity: 80,
    startMs,
    durationMs: 400,
    hand: 'right',
    role: 'keyboard',
  })
  beforeEach(() => {
    const song = buildSong({
      id: 'bar',
      title: 'Bar',
      bpm: 120,
      beatsPerMeasure: 4,
      notes: [note(60, 0), note(62, 500)],
      source: 'midi',
      handsInferred: false,
    })
    act(() => {
      learning().setTopic('songs')
      useSongStore.setState({ library: [song], currentId: song.id, positionMs: 0, playing: false })
      songs().setMode('listen')
    })
  })

  it('in Listen, plays the song, and pauses where it is', () => {
    bar()
    fireEvent.click(button('Play the song'))
    expect(songs().playing).toBe(true)
    fireEvent.click(button('Pause'))
    expect(songs().playing).toBe(false)
  })

  it('plays and pauses the song on Space', () => {
    bar()
    space()
    expect(songs().playing).toBe(true)
    space()
    expect(songs().playing).toBe(false)
  })

  it('in Practice, starts a run from a lead-in before the first note', () => {
    act(() => songs().setMode('practice'))
    bar()
    fireEvent.click(button('Start'))
    expect(songs().playing).toBe(true)
    expect(songs().positionMs).toBe(-2000)
    expect(button('Back to the start')).toBeDefined()
  })

  it('in Learn, starts a run that waits for you', () => {
    act(() => songs().setMode('learn'))
    bar()
    fireEvent.click(button('Start'))
    expect(songs().learning).toBe(true)
    expect(button('Stop')).toBeDefined()
  })

  it('says why there is nothing to play with no song open', () => {
    act(() => useSongStore.setState({ currentId: null }))
    bar()
    expect((button('Open a song first') as HTMLButtonElement).disabled).toBe(true)
  })
})
