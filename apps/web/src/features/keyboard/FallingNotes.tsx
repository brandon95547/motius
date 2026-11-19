import * as React from 'react'
import { pitchClass, timelineOf, timingOf, type Timing } from '@motius/shared'
import { useElementSize } from '@/lib/hooks'
import { useFallingStore } from '@/state/falling-store'
import { useKeyboardStore } from '@/state/keyboard-store'
import { useLearningStore } from '@/state/learning-store'
import { useViewStore } from '@/state/view-store'
import { FallingControls } from './FallingControls'
import { buildLayout, type KeyGeometry } from './keyboard-layout'
import { useFallingClock } from './use-falling-clock'

/**
 * The exercise as notes falling toward the keys that play them.
 *
 * Each note is a bar in its key's column, as wide as the key (a black key's
 * narrower and off-centre, as the key is), as long as the note is held, and
 * in its hand's color with its label on it — the note's name, its degree or
 * its finger, whichever the keys are labeled with. Bars fall at a steady speed and
 * reach the top of the keys on their beat; notes that sound together arrive
 * together. The rules every falling-notes app keeps, so a player who has used
 * one can read this one. How they move is `useFallingClock`'s.
 *
 * What the player gets back, as those apps give it:
 * - a note pressed when it is due lights its bar, and its key in the bar's
 *   color, for as long as it is held, each key of a chord as it goes down; and
 *   the line at the keys glows above it;
 * - in Practice each played step is ringed on time, or early or late, and one
 *   that went by unplayed is marked missed.
 *
 * And what the player can do to it: tap it (or press Space) to pause and go
 * on; drag it, or scroll it, to move through the music; and loop a stretch,
 * from the controls shown while it is still.
 */

/** How many beats of music the field shows above the keys. */
const BEATS_SHOWN = 4
/** A press that moves less than this is a tap, not a drag. */
const TAP_SLOP_PX = 6

export function FallingNotes() {
  const exercise = useLearningStore((state) => state.exercise)
  const mode = useLearningStore((state) => state.mode)
  const session = useLearningStore((state) => state.session)
  const hits = useLearningStore((state) => state.hits)
  const bpm = useLearningStore((state) => state.targetBpm)
  // What a bar says is what the keys say: one setting, Key labels, for both.
  const keyLabels = useLearningStore((state) => state.keyLabels)
  const held = useKeyboardStore((state) => state.active)
  const loop = useFallingStore((state) => state.loop)
  const paused = useFallingStore((state) => state.paused)
  const playedAt = useFallingStore((state) => state.playedAt)
  const keyWindow = useViewStore((state) => state.window)
  const [fieldRef, size] = useElementSize<HTMLDivElement>()
  const trackRef = React.useRef<HTMLDivElement>(null)

  const layout = React.useMemo(() => buildLayout(keyWindow), [keyWindow])
  const keys = React.useMemo(() => {
    const byNote = new Map<number, KeyGeometry>()
    for (const key of [...layout.whiteKeys, ...layout.blackKeys]) byNote.set(key.note, key)
    return byNote
  }, [layout])
  const timeline = React.useMemo(() => (exercise ? timelineOf(exercise) : null), [exercise])

  const beatPx = size.height / BEATS_SHOWN
  const beatMs = 60_000 / Math.max(1, bpm)
  const clock = useFallingClock(trackRef, timeline, beatPx, beatMs)

  // Space pauses and goes on during a run, as it does in every player — even
  // with focus left on a button the mouse just pressed (Start, say, which is
  // Stop while a run goes, and would end it). Not in a field Space types into,
  // nor inside a menu or a dialog, nor on a control reached by the keyboard:
  // there Space presses what it is on, as a keyboard user expects.
  React.useEffect(() => {
    let taken = false
    // How focus last moved: a press of the mouse or a finger, or a key (Tab,
    // an arrow). Space is the keyboard's on a control the keyboard went to.
    let byPointer = true
    const onPointerDown = () => {
      byPointer = true
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') {
        byPointer = false
        return
      }
      if (event.repeat) return
      if (useLearningStore.getState().session.status !== 'running') return
      const target = event.target as Element | null
      if (
        target?.closest?.(
          'input, select, textarea, [contenteditable], [role="dialog"], [role="menu"]',
        )
      )
        return
      if (target?.closest?.('button, [role]') && !byPointer) return
      // Taken before the button sees it: a button presses on Space's release.
      event.preventDefault()
      event.stopPropagation()
      taken = true
      clock.togglePause()
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || !taken) return
      taken = false
      event.preventDefault()
      event.stopPropagation()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('keyup', onKeyUp, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('keyup', onKeyUp, true)
    }
  }, [clock])

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

  if (!exercise || !timeline) return null

  const labelOf = (note: { note: number; finger?: number }) =>
    keyLabels === 'notes'
      ? exercise.pitchNames[pitchClass(note.note)]
      : keyLabels === 'degrees'
        ? exercise.pitchDegrees?.[pitchClass(note.note)]
        : keyLabels === 'fingers'
          ? note.finger
          : undefined

  const missed = new Set(session.missedSteps)
  // How each step played in Practice went, against its beat.
  const timings = new Map<number, Timing>()
  if (mode === 'practice')
    for (const [step, beat] of Object.entries(playedAt)) {
      const due = timeline.stepStarts[Number(step)] ?? 0
      timings.set(Number(step), timingOf(beat * beatMs, due * beatMs))
    }
  const running = session.status === 'running'
  const passed = running || session.status === 'complete' ? session.completedSteps : 0
  const waitingOn = mode === 'learn' && running ? session.stepIndex : null
  // Keys pressed when they were due, and still held.
  const lit = (note: number, step: number) => held[note] !== undefined && hits[note]?.step === step
  const glowing = Object.entries(hits).filter(([note]) => held[Number(note)] !== undefined)

  return (
    <div
      ref={fieldRef}
      className="falling"
      data-paused={paused}
      style={{ '--beat': `${beatPx}px` } as React.CSSProperties}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      {/* A faint lane line up from the edge of every white key, so a bar can be
          followed down to its key; a little stronger at each C, where an
          octave begins. */}
      {layout.whiteKeys.slice(1).map((key) => (
        <span
          key={key.note}
          className="falling__lane"
          data-octave={key.note % 12 === 0}
          aria-hidden
          style={{ left: `${key.leftPercent}%` }}
        />
      ))}
      <div ref={trackRef} className="falling__track" aria-hidden>
        {loop && (
          <span
            className="falling__loop"
            style={{ '--start': loop.from, '--length': loop.to - loop.from } as React.CSSProperties}
          />
        )}
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
              data-lit={lit(note.note, note.step)}
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
              {labelOf(note)}
            </span>
          )
        })}
      </div>
      {/* The line the notes are played at, glowing above each key played right. */}
      <span className="falling__line" aria-hidden />
      {glowing.map(([note, hit]) => {
        const key = keys.get(Number(note))
        if (!key) return null
        return (
          <span
            key={`${note}:${hit.step}`}
            className="falling__glow"
            aria-hidden
            data-hand={hit.hand}
            style={{ left: `${key.leftPercent}%`, width: `${key.widthPercent}%` }}
          />
        )
      })}
      <FallingControls timeline={timeline} />
    </div>
  )
}
