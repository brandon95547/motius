import * as React from 'react'
import { timelineOf, timingOf, type TimedNote, type Timing } from '@motius/shared'
import { useElementSize } from '@/lib/hooks'
import { useFallingStore } from '@/state/falling-store'
import { useKeyboardStore } from '@/state/keyboard-store'
import { useLearningStore } from '@/state/learning-store'
import { FallingControls } from './FallingControls'
import { BEATS_SHOWN, FallingField, type Glow, type NoteState } from './FallingField'
import { useFallingClock } from './use-falling-clock'

/**
 * The exercise as notes falling toward the keys that play them.
 *
 * Bars fall at a steady speed and reach the top of the keys on their beat;
 * notes that sound together arrive together, the rules every falling-notes app
 * keeps. How they look is `FallingField`'s; how they move, `useFallingClock`'s.
 *
 * What the player gets back, as those apps give it:
 * - a note pressed when it is due lights its bar, and its key in the bar's
 *   color, for as long as it is held, each key of a chord as it goes down; and
 *   the line at the keys glows above it;
 * - in Practice each played step is ringed on time, or early or late, and one
 *   that went by unplayed is marked missed.
 *
 * And what the player can do to it: tap it to pause and go on (Space does it
 * too, as it presses the bar's Play everywhere); drag it, or scroll it, to
 * move through the music; and loop a stretch, from the controls shown while
 * it is still.
 */

/** A press that moves less than this is a tap, not a drag. */
const TAP_SLOP_PX = 6

export function FallingNotes() {
  const exercise = useLearningStore((state) => state.exercise)
  const mode = useLearningStore((state) => state.mode)
  const session = useLearningStore((state) => state.session)
  const hits = useLearningStore((state) => state.hits)
  // The step the demonstration is playing, in Listen or wherever Play is pressed.
  const demoStep = useLearningStore((state) => state.demoStepIndex)
  const bpm = useLearningStore((state) => state.targetBpm)
  const held = useKeyboardStore((state) => state.active)
  const paused = useFallingStore((state) => state.paused)
  const playedAt = useFallingStore((state) => state.playedAt)
  const [fieldRef, size] = useElementSize<HTMLDivElement>()
  const trackRef = React.useRef<HTMLDivElement>(null)

  const timeline = React.useMemo(() => (exercise ? timelineOf(exercise) : null), [exercise])

  const beatPx = size.height / BEATS_SHOWN
  const beatMs = 60_000 / Math.max(1, bpm)
  const clock = useFallingClock(trackRef, timeline, beatPx, beatMs)

  // A tap pauses; a drag moves through the music, the notes under the finger.
  const press = React.useRef<{ y: number; moved: boolean } | null>(null)
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (useLearningStore.getState().demoStepIndex !== null) return
    press.current = { y: event.clientY, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const at = press.current
    if (!at || beatPx <= 0) return
    const dy = event.clientY - at.y
    if (!at.moved && Math.abs(dy) < TAP_SLOP_PX) return
    at.moved = true
    at.y = event.clientY
    clock.moveBy(dy / beatPx)
  }
  const onPointerUp = () => {
    const at = press.current
    press.current = null
    if (!at) return
    if (at.moved) clock.settle()
    else clock.togglePause()
  }
  // A scroll moves through the music too, settling once it stops.
  const settleTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (beatPx <= 0 || useLearningStore.getState().demoStepIndex !== null) return
    clock.moveBy(event.deltaY / beatPx)
    globalThis.clearTimeout(settleTimer.current)
    settleTimer.current = globalThis.setTimeout(clock.settle, 200)
  }

  // With nothing written to fall — free play, a lesson not written yet — the
  // field stays up all the same: the player chose falling notes, and the lanes
  // and the line at the keys still answer every key played.
  const notes = timeline?.notes ?? []

  const missed = new Set(session.missedSteps)
  // How each step played in Practice went, against its beat.
  const timings = new Map<number, Timing>()
  if (mode === 'practice' && timeline)
    for (const [step, beat] of Object.entries(playedAt)) {
      const due = timeline.stepStarts[Number(step)] ?? 0
      timings.set(Number(step), timingOf(beat * beatMs, due * beatMs))
    }
  const running = session.status === 'running'
  const passed = running || session.status === 'complete' ? session.completedSteps : 0
  const waitingOn = mode === 'learn' && running ? session.stepIndex : null
  const stateOf = (note: TimedNote): NoteState => ({
    done: note.step < passed && !missed.has(note.step),
    missed: missed.has(note.step),
    now: note.step === waitingOn,
    // Pressed when it was due, and still held — by the player, or by the
    // demonstration playing it. The demonstration lights its notes as a player
    // would, but is never counted as one (`use-scale-demo`).
    lit:
      held[note.note] !== undefined &&
      (hits[note.note]?.step === note.step || demoStep === note.step),
    timing: timings.get(note.step),
  })
  // With music to play, the keys played right, and the demonstration's; in
  // free play, every key held.
  const demoGlow: Glow[] =
    demoStep === null
      ? []
      : notes
          .filter((note) => note.step === demoStep && held[note.note] !== undefined)
          .map((note) => [note.note, { step: note.step, hand: note.hand }])
  const glowing: Glow[] = exercise
    ? [
        ...Object.entries(hits)
          .filter(([note]) => held[Number(note)] !== undefined)
          .map(([note, hit]): Glow => [Number(note), hit]),
        ...demoGlow,
      ]
    : Object.keys(held)
        .filter((note) => held[Number(note)] !== undefined)
        .map((note) => [Number(note), null])

  return (
    <FallingField
      fieldRef={fieldRef}
      trackRef={trackRef}
      beatPx={beatPx}
      paused={paused}
      notes={notes}
      stateOf={stateOf}
      glowing={glowing}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      <FallingControls />
    </FallingField>
  )
}
