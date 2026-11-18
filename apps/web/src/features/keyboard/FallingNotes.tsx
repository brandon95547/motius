import * as React from 'react'
import { ON_TIME_MS, timelineOf, timingOf, type Timing } from '@motius/shared'
import { useElementSize, useMediaQuery } from '@/lib/hooks'
import { learningActions, useLearningStore } from '@/state/learning-store'
import { useViewStore } from '@/state/view-store'
import { buildLayout, type KeyGeometry } from './keyboard-layout'

/**
 * The exercise as notes falling toward the keys that play them.
 *
 * Each note is a bar in its key's column, as wide as the key (a black key's
 * narrower and off-centre, as the key is), as long as the note is held, and
 * in its hand's color with the finger on it. Bars fall at a steady speed and
 * reach the top of the keys on their beat; notes that sound together arrive
 * together. The rules every falling-notes app keeps, so a player who has used
 * one can read this one.
 *
 * How they fall follows the mode:
 * - **Explore**: still, the first notes waiting at the keys.
 * - **Learn** (wait mode): they fall at the tempo and stop when a note reaches
 *   the keys, until it is played; then they fall on to the next.
 * - **Practice**: they fall at the tempo from Start, after a four-beat lead-in
 *   in time with the click, and wait for no one. A step played is ringed on
 *   time, or early or late; one that goes by unplayed is missed, and the run
 *   moves on without it.
 * - **Hear**: they fall with the demonstration.
 *
 * A step played flashes at the keys. The whole field moves as one: a single
 * transform on the track, written once a frame, so a frame costs a composite
 * and no layout, and no React render.
 */

/** How many beats of music the field shows above the keys. */
const BEATS_SHOWN = 4
/** Practice starts this many beats before the first note reaches the keys. */
const LEAD_IN = 4

export function FallingNotes() {
  const exercise = useLearningStore((state) => state.exercise)
  const mode = useLearningStore((state) => state.mode)
  const session = useLearningStore((state) => state.session)
  const demoing = useLearningStore((state) => state.demoStepIndex !== null)
  const bpm = useLearningStore((state) => state.targetBpm)
  const keyWindow = useViewStore((state) => state.window)
  const [fieldRef, size] = useElementSize<HTMLDivElement>()
  const trackRef = React.useRef<HTMLDivElement>(null)
  // The beat at the keys right now. Kept across frames, never rendered.
  const nowRef = React.useRef(0)
  // Without motion the notes step to where they are due instead of falling there.
  const still = useMediaQuery('(prefers-reduced-motion: reduce)')

  const layout = React.useMemo(() => buildLayout(keyWindow), [keyWindow])
  const keys = React.useMemo(() => {
    const byNote = new Map<number, KeyGeometry>()
    for (const key of [...layout.whiteKeys, ...layout.blackKeys]) byNote.set(key.note, key)
    return byNote
  }, [layout])
  const timeline = React.useMemo(() => (exercise ? timelineOf(exercise) : null), [exercise])

  const beatPx = size.height / BEATS_SHOWN
  const beatMs = 60_000 / Math.max(1, bpm)
  const running = session.status === 'running'
  const flowing = mode === 'practice' && running
  const runStart = session.startedAt

  // Practice keeps the click's time: its first beat is the run's first.
  React.useEffect(() => {
    if (flowing && runStart !== null) learningActions.syncPulse()
  }, [flowing, runStart])

  React.useEffect(() => {
    const track = trackRef.current
    if (!track || !timeline) return
    const starts = timeline.stepStarts
    const place = (beats: number) => {
      nowRef.current = beats
      track.style.transform = `translateY(${beats * beatPx}px)`
    }

    if (!running && !demoing) {
      // Waiting to begin: Practice with its lead-in above, so Start does not
      // jump; a finished run where it ended.
      if (session.status === 'idle') place(mode === 'practice' ? -LEAD_IN : 0)
      else place(nowRef.current)
      return
    }

    let frame = 0
    let last = performance.now()
    const tick = (time: number) => {
      const elapsed = (time - last) / beatMs
      last = time
      const state = useLearningStore.getState()
      const at = state.session.stepIndex
      let now = nowRef.current

      if (flowing && runStart !== null) {
        now = (Date.now() - runStart) / beatMs - LEAD_IN
        // Gone by: the next step is due, and a margin more, and this one is
        // still unplayed. The run moves on without it.
        const passed = (starts[at + 1] ?? starts[at]! + 1) + ON_TIME_MS / beatMs
        if (state.session.status === 'running' && now > passed) state.missStep()
      } else if (state.demoStepIndex !== null) {
        const from = starts[state.demoStepIndex] ?? 0
        const to = starts[state.demoStepIndex + 1] ?? from
        now = still ? from : Math.min(Math.max(now, from) + elapsed, to)
      } else {
        // Wait mode: fall to the step being asked for, and stop there.
        const due = starts[at] ?? 0
        now = still ? due : Math.min(now + elapsed, due)
      }
      place(now)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [timeline, beatPx, beatMs, flowing, runStart, running, demoing, mode, session.status, still])

  if (!exercise || !timeline) return null

  const missed = new Set(session.missedSteps)
  // How each step played in Practice went: against when it reached the keys.
  const timings = new Map<number, Timing>()
  if (mode === 'practice' && runStart !== null)
    session.stepTimes.forEach((playedAt, step) => {
      if (missed.has(step)) return
      const due = runStart + ((timeline.stepStarts[step] ?? 0) + LEAD_IN) * beatMs
      timings.set(step, timingOf(playedAt, due))
    })
  const passed = running || session.status === 'complete' ? session.completedSteps : 0
  const waitingOn = mode === 'learn' && running ? session.stepIndex : null

  return (
    <div
      ref={fieldRef}
      className="falling"
      aria-hidden
      style={{ '--beat': `${beatPx}px` } as React.CSSProperties}
    >
      {/* An octave marker at every C, as the field's only ruling. */}
      {layout.whiteKeys
        .filter((key) => key.note % 12 === 0)
        .map((key) => (
          <span
            key={key.note}
            className="falling__octave"
            style={{ left: `${key.leftPercent}%` }}
          />
        ))}
      <div ref={trackRef} className="falling__track">
        {timeline.notes.map((note, index) => {
          const key = keys.get(note.note)
          if (!key) return null
          return (
            <span
              key={index}
              className="falling__note"
              data-hand={note.hand}
              data-black={key.black}
              data-done={note.step < passed && !missed.has(note.step)}
              data-missed={missed.has(note.step)}
              data-now={note.step === waitingOn}
              data-timing={timings.get(note.step)}
              style={
                {
                  left: `${key.leftPercent}%`,
                  width: `${key.widthPercent}%`,
                  '--start': note.start,
                  '--length': note.beats,
                } as React.CSSProperties
              }
            >
              {note.finger}
            </span>
          )
        })}
      </div>
    </div>
  )
}
