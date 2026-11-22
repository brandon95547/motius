import * as React from 'react'
import { pitchName, songTimeline, type TimedNote } from '@motius/shared'
import { useElementSize } from '@/lib/hooks'
import { fallingClock } from '@/state/falling-store'
import { useKeyboardStore } from '@/state/keyboard-store'
import { useLearningStore } from '@/state/learning-store'
import { useCurrentSong, useSongStore } from '@/state/song-store'
import { BEATS_SHOWN, FallingField, type Glow, type NoteState } from './FallingField'
import { useSongFallingClock } from './use-song-falling-clock'

/**
 * The open song as notes falling toward the keys that play them: the part
 * being played (both hands, or one), in the order it is heard, drawn as an
 * exercise's falling notes are (`FallingField`). The song's own clock leads
 * (`useSongFallingClock`); the song's controls on the bar play, pause and
 * slow it, as they do over the staff.
 *
 * In Learn the step asked for is marked at the keys and the steps played are
 * done; in Practice each step is ringed on time, early or late as it is
 * played, or marked missed. A held key whose bar is at the line lights that bar, and the line
 * glows above every key held.
 */
/** How near the line, in beats, a bar's key counts as playing it. */
const NEAR = 0.1

export function SongFallingNotes() {
  const song = useCurrentSong()
  const part = useSongStore((state) => state.part)
  const learning = useSongStore((state) => state.mode === 'learn' && state.learning)
  const stepIndex = useSongStore((state) => state.stepIndex)
  const results = useSongStore((state) =>
    state.mode === 'practice' ? state.practice.results : null,
  )
  const keyLabels = useLearningStore((state) => state.keyLabels)
  const held = useKeyboardStore((state) => state.active)
  const [fieldRef, size] = useElementSize<HTMLDivElement>()
  const trackRef = React.useRef<HTMLDivElement>(null)

  const timeline = React.useMemo(() => (song ? songTimeline(song, part) : null), [song, part])
  const beatPx = size.height / BEATS_SHOWN
  const beatMs = 60_000 / Math.max(1, song?.bpm ?? 120)
  useSongFallingClock(trackRef, timeline, beatPx, beatMs)

  const labelOf = (note: TimedNote) =>
    keyLabels === 'notes' ? pitchName(note.note) : keyLabels === 'fingers' ? note.finger : undefined
  // The beat at the keys, read when the keys change: which is when a bar can
  // light or go out.
  const at = fallingClock.now
  const stateOf = (note: TimedNote): NoteState => {
    // Practice: each step as it was judged, as an exercise's are.
    const result = results?.[note.step]
    if (results)
      return {
        done: result !== undefined && result !== 'missed',
        missed: result === 'missed',
        timing: result === 'missed' ? undefined : result,
        lit: held[note.note] !== undefined && result !== undefined && result !== 'missed',
      }
    return stateFor(note)
  }
  const stateFor = (note: TimedNote): NoteState => ({
    done: learning && note.step < stepIndex,
    now: learning && note.step === stepIndex,
    lit:
      held[note.note] !== undefined &&
      (learning
        ? note.step === stepIndex
        : note.start <= at + NEAR && note.start + note.beats >= at - NEAR),
  })
  const glowing: Glow[] = Object.keys(held)
    .filter((note) => held[Number(note)] !== undefined)
    .map((note) => [Number(note), null])

  return (
    <FallingField
      fieldRef={fieldRef}
      trackRef={trackRef}
      beatPx={beatPx}
      paused={false}
      notes={timeline?.notes ?? []}
      stateOf={stateOf}
      labelOf={labelOf}
      glowing={glowing}
    />
  )
}
