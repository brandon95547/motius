import * as React from 'react'
import {
  playedStepTimes,
  practiceAt,
  practiceNoteOn,
  songSteps,
  type PracticeStep,
  type Song,
} from '@motius/shared'
import { useKeyboardStore } from '@/state/keyboard-store'
import { MAX_CARRY_MS, useSongStore } from '@/state/song-store'

/**
 * Practising a song: while it plays on at the tempo, every key the player puts
 * down is held up against the step being asked for, and a step that goes by
 * unplayed is missed. The judging is `song-practice.ts`'s; this only feeds it
 * the keys and the clock.
 *
 * The playback leaves the part being practised silent and unlit (see
 * `useSongPlayback`), so every key down is the player's own.
 */
export function useSongPractice(song: Song | null) {
  const mode = useSongStore((state) => state.mode)
  const part = useSongStore((state) => state.part)
  const playing = useSongStore((state) => state.playing)

  const steps = React.useMemo<PracticeStep[]>(() => {
    if (!song || mode !== 'practice') return []
    const written = songSteps(song, part)
    return playedStepTimes(song, written).map((played) => ({
      notes: [...new Set(written[played.index]!.notes.map((note) => note.note))],
      startMs: played.startMs,
    }))
  }, [song, mode, part])

  React.useEffect(() => {
    if (!playing || steps.length === 0) return
    let position = useSongStore.getState().positionMs
    let tickedAt = performance.now()
    /** Where the music is now: the last tick, carried on at the tempo. */
    const now = () => {
      const { tempoScale } = useSongStore.getState()
      return position + Math.min(performance.now() - tickedAt, MAX_CARRY_MS) * tempoScale
    }

    const stopSong = useSongStore.subscribe((state) => {
      if (state.positionMs === position) return
      position = state.positionMs
      tickedAt = performance.now()
      const next = practiceAt(state.practice, steps, position, state.tempoScale)
      if (next !== state.practice) state.setPractice(next)
    })

    let held = new Set(Object.keys(useKeyboardStore.getState().active).map(Number))
    const stopKeys = useKeyboardStore.subscribe((keys) => {
      const down = new Set(Object.keys(keys.active).map(Number))
      const struck = [...down].filter((note) => !held.has(note))
      held = down
      if (struck.length === 0) return
      const song = useSongStore.getState()
      let practice = song.practice
      for (const note of struck)
        practice = practiceNoteOn(practice, steps, note, now(), song.tempoScale)
      if (practice !== song.practice) song.setPractice(practice)
    })

    return () => {
      stopSong()
      stopKeys()
    }
  }, [playing, steps])
}
