import * as React from 'react'
import { LEAD_IN_BEATS, ON_TIME_MS, stepAtBeat, type ExerciseTimeline } from '@motius/shared'
import { fallingClock, useFallingStore } from '@/state/falling-store'
import { learningActions, useLearningStore } from '@/state/learning-store'

/**
 * Where the falling notes are in the music, frame by frame, and the ways the
 * player moves them: pausing, and dragging through the music.
 *
 * The position is a beat — the one at the keys right now — written straight
 * onto the track as a transform, never rendered. What moves it follows the mode:
 * - **Learn** (wait mode): the music goes on at the tempo until the step being
 *   asked for reaches the keys, and waits there until it is played.
 * - **Practice**: the music goes on at the tempo whatever is played. A step
 *   that goes by unplayed is missed, and where each played step was played is
 *   kept, to judge it against its beat.
 * - **Listen**: it goes with the demonstration.
 *
 * The music moves whatever the system's motion setting: falling notes are
 * motion by nature, and the player chose them over the staff, which is the
 * choice Reduce Motion is there to ask for. (The small flourishes — the flash
 * of a played note, the glow coming up — still keep to the setting.)
 *
 * Paused, it stands still, and goes on from exactly there. Dragged, it moves to
 * wherever it is let go, and the run goes on from the step there (the score
 * starting again, as from a new place).
 */

/** Practice starts this many beats before the first note reaches the keys. */
const LEAD_IN = LEAD_IN_BEATS

export interface FallingClock {
  /** Move the music by this many beats, holding it there: a drag or a scroll. */
  moveBy: (beats: number) => void
  /** Let go after a move: the run goes on from the step at the keys. */
  settle: () => void
  togglePause: () => void
}

export function useFallingClock(
  trackRef: React.RefObject<HTMLElement | null>,
  timeline: ExerciseTimeline | null,
  beatPx: number,
  beatMs: number,
): FallingClock {
  const mode = useLearningStore((state) => state.mode)
  const status = useLearningStore((state) => state.session.status)
  const demoing = useLearningStore((state) => state.demoStepIndex !== null)
  // Practice's clock: the beat it was at, and when.
  const origin = React.useRef({ beat: 0, ms: 0 })
  const moving = React.useRef(false)
  const counted = React.useRef(0)

  const starts = timeline?.stepStarts
  const last = starts ? starts[starts.length - 1]! : 0

  const place = React.useCallback(
    (beats: number) => {
      fallingClock.now = beats
      const track = trackRef.current
      if (track) track.style.transform = `translateY(${beats * beatPx}px)`
    },
    [trackRef, beatPx],
  )

  const stepAt = React.useCallback(
    (beat: number) => (timeline ? stepAtBeat(timeline, beat) : 0),
    [timeline],
  )

  /** Go on from a beat: Practice's clock restarts there. */
  const runFrom = React.useCallback(
    (beat: number) => {
      origin.current = { beat, ms: Date.now() }
      place(beat)
      if (useLearningStore.getState().mode === 'practice') learningActions.syncPulse()
    },
    [place],
  )

  // A run begins — Start, or Again after one ended: from wherever the music
  // was left before the first, from the top after one.
  const previous = React.useRef(status)
  React.useEffect(() => {
    const before = previous.current
    previous.current = status
    const begun = before !== 'running' && status === 'running'
    if (status !== 'running') useFallingStore.getState().setPaused(false)
    if (!begun || !starts) return
    useFallingStore.getState().setPaused(false)
    useFallingStore.getState().clearPlayed()
    const practice = mode === 'practice'
    const from = before === 'idle' ? fallingClock.now + (practice ? LEAD_IN : 0) : 0
    const step = stepAt(Math.max(0, from))
    if (step > 0) useLearningStore.getState().seekStep(step)
    counted.current = step
    runFrom(practice ? starts[step]! - LEAD_IN : starts[step]!)
  }, [status, mode, starts, stepAt, runFrom])

  // Going on after a pause, from anywhere that paused it (a tap, Space, the
  // bar's button): Practice's clock picks up exactly where the music stood.
  const paused = useFallingStore((state) => state.paused)
  const wasPaused = React.useRef(paused)
  React.useEffect(() => {
    const resumed = wasPaused.current && !paused
    wasPaused.current = paused
    const { session, mode: now } = useLearningStore.getState()
    if (resumed && session.status === 'running' && now === 'practice') runFrom(fallingClock.now)
  }, [paused, runFrom])

  // Waiting to begin: Practice with its lead-in above, so Start does not jump.
  React.useEffect(() => {
    if (status === 'idle' && !demoing && timeline) place(mode === 'practice' ? -LEAD_IN : 0)
  }, [status, demoing, mode, timeline, place])

  React.useEffect(() => {
    if (!starts || (status !== 'running' && !demoing)) {
      place(fallingClock.now)
      return
    }
    let frame = 0
    let then = performance.now()
    const tick = (time: number) => {
      const elapsed = (time - then) / beatMs
      then = time
      const learning = useLearningStore.getState()
      const { paused } = useFallingStore.getState()
      const at = learning.session.stepIndex
      let now = fallingClock.now

      if (learning.demoStepIndex !== null) {
        const from = starts[learning.demoStepIndex] ?? 0
        const to = starts[learning.demoStepIndex + 1] ?? from
        now = Math.min(Math.max(now, from) + elapsed, to)
      } else if (!paused && !moving.current && learning.session.status === 'running') {
        if (learning.mode === 'practice') {
          now = origin.current.beat + Math.max(0, Date.now() - origin.current.ms) / beatMs
          // Gone by: the next step is due, and a margin more, and this one is
          // still unplayed. Every step that has, at once: a frame that comes
          // late (a busy page, a tab in the background) must not leave the run
          // catching up a step a frame.
          for (let step = at; ; step++) {
            const session = useLearningStore.getState().session
            if (session.status !== 'running' || session.stepIndex !== step) break
            const passed = (starts[step + 1] ?? starts[step]! + 1) + ON_TIME_MS / beatMs
            if (now <= passed) break
            learning.missStep()
          }
        } else {
          const due = starts[at] ?? 0
          now = now >= due ? now : Math.min(now + elapsed, due)
        }

        // Where each step was played, on the music's clock.
        const { completedSteps, missedSteps } = useLearningStore.getState().session
        for (; counted.current < completedSteps; counted.current++)
          if (!missedSteps.includes(counted.current))
            useFallingStore.getState().markPlayed(counted.current, now)
      }
      place(now)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [starts, status, demoing, beatMs, place])

  return React.useMemo(
    () => ({
      moveBy: (beats) => {
        // Moving the music pauses a run, as it does in every falling-notes app:
        // it goes on from the new place when the player says so.
        if (useLearningStore.getState().session.status === 'running')
          useFallingStore.getState().setPaused(true)
        moving.current = true
        place(Math.max(-LEAD_IN, Math.min(fallingClock.now + beats, last)))
      },
      settle: () => {
        if (!moving.current) return
        moving.current = false
        if (useLearningStore.getState().session.status !== 'running') return
        // The step at the keys becomes the one being asked for. Practice stays
        // paused there; Learn falls to it.
        const step = stepAt(fallingClock.now)
        useLearningStore.getState().seekStep(step)
        useFallingStore.getState().clearPlayed()
        counted.current = step
        origin.current = { beat: fallingClock.now, ms: Date.now() }
      },
      togglePause: () => {
        if (useLearningStore.getState().session.status !== 'running') return
        const falling = useFallingStore.getState()
        falling.setPaused(!falling.paused)
      },
    }),
    [place, last, stepAt],
  )
}
