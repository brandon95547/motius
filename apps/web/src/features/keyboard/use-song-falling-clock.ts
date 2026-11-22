import * as React from 'react'
import { LEAD_IN_BEATS, type ExerciseTimeline } from '@motius/shared'
import { fallingClock } from '@/state/falling-store'
import { MAX_CARRY_MS, useSongStore } from '@/state/song-store'

/**
 * Where a song's falling notes are, frame by frame: the beat at the keys,
 * written straight onto the track as a transform, never rendered.
 *
 * The song's own clock leads; this one only draws it:
 * - **Playing** (Listen, Practice): the playhead, which the player moves on a
 *   tick, carried on smoothly between ticks at the tempo it plays at.
 * - **Learn**: the music falls at the tempo until the step being asked for
 *   reaches the keys, and waits there until it is played (wait mode, as an
 *   exercise's Learn does). A step gone back to is snapped back to.
 * - **Otherwise** it stands where the playhead stands — Practice, waiting to
 *   begin, with its lead-in above it.
 *
 * Beats are the song's as written (`songTimeline`), so a slower tempo is the
 * same bars falling more slowly. Like the exercise's clock it moves whatever
 * the system's motion setting: the player chose falling notes.
 */

export function useSongFallingClock(
  trackRef: React.RefObject<HTMLElement | null>,
  timeline: ExerciseTimeline | null,
  beatPx: number,
  beatMs: number,
): void {
  React.useEffect(() => {
    if (!timeline || beatPx <= 0) return
    const starts = timeline.stepStarts
    let beat = useSongStore.getState().positionMs / beatMs
    let lastPosition = Number.NaN
    let tickedAt = 0
    let frameAt = performance.now()
    let frame = 0

    const draw = () => {
      const now = performance.now()
      const elapsed = now - frameAt
      frameAt = now
      const song = useSongStore.getState()
      if (song.positionMs !== lastPosition) {
        lastPosition = song.positionMs
        tickedAt = now
      }
      if (song.mode === 'learn' && song.learning) {
        const target = starts[Math.min(song.stepIndex, starts.length - 1)] ?? 0
        beat = Math.min(target, beat + (elapsed * song.tempoScale) / beatMs)
      } else if (song.playing) {
        const carried = Math.min(now - tickedAt, MAX_CARRY_MS) * song.tempoScale
        beat = (song.positionMs + carried) / beatMs
      } else if (song.mode === 'practice' && song.positionMs === 0) {
        // Waiting to begin, its lead-in above, so Start does not jump.
        beat = -LEAD_IN_BEATS
      } else {
        beat = song.positionMs / beatMs
      }
      fallingClock.now = beat
      const track = trackRef.current
      if (track) track.style.transform = `translateY(${beat * beatPx}px)`
      frame = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(frame)
  }, [trackRef, timeline, beatPx, beatMs])
}
