import * as React from 'react'
import { crossingNotes, type Hand, type TimedNote, type Timing } from '@motius/shared'
import { useViewStore } from '@/state/view-store'
import { buildLayout, type KeyGeometry } from '@/lib/keyboard-layout'

/**
 * The field the notes fall down, drawn once for whatever falls in it: an
 * exercise (`FallingNotes`) or a song (`SongFallingNotes`). Each is its own
 * clock and its own idea of which notes are done; how a bar, a lane, the line
 * at the keys and a glow look is this one's, so the two never drift apart.
 *
 * Each note is a bar in its key's column, as wide as the key (a black key's
 * narrower and off-centre, as the key is), as long as the note is held, in its
 * hand's color with its label on it. The track holding them is moved by its
 * clock, a transform written each frame onto `trackRef`; nothing here renders
 * per frame.
 */

/** How many beats of music the field shows above the keys. */
export const BEATS_SHOWN = 4

/** How a bar stands: played, missed, the one asked for, held down, how it was timed. */
export interface NoteState {
  done?: boolean
  missed?: boolean
  now?: boolean
  lit?: boolean
  timing?: Timing | undefined
}

/** A key glowing at the line: the step and hand it was played right for, or null in free play. */
export type Glow = readonly [note: number, hit: { step: number; hand?: Hand } | null]

export function FallingField({
  fieldRef,
  trackRef,
  beatPx,
  paused,
  notes,
  stateOf,
  glowing,
  children,
  ...handlers
}: {
  fieldRef: React.Ref<HTMLDivElement>
  trackRef: React.Ref<HTMLDivElement>
  beatPx: number
  paused: boolean
  notes: readonly TimedNote[]
  stateOf: (note: TimedNote) => NoteState
  glowing: readonly Glow[]
  children?: React.ReactNode
} & Pick<
  React.HTMLAttributes<HTMLDivElement>,
  'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel' | 'onWheel'
>) {
  const keyWindow = useViewStore((state) => state.window)
  const layout = React.useMemo(() => buildLayout(keyWindow), [keyWindow])
  const keys = React.useMemo(() => {
    const byNote = new Map<number, KeyGeometry>()
    for (const key of [...layout.whiteKeys, ...layout.blackKeys]) byNote.set(key.note, key)
    return byNote
  }, [layout])
  // A note the hand crosses to — the thumb under, or a finger over — is violet
  // all the way down, in every lesson, exercise and song, so the crossing is
  // seen coming (the user, 2026-11-23).
  const crossing = React.useMemo(() => crossingNotes(notes), [notes])

  return (
    <div
      ref={fieldRef}
      className="falling"
      data-paused={paused}
      style={{ '--beat': `${beatPx}px` } as React.CSSProperties}
      {...handlers}
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
        {notes.map((note, index) => {
          const key = keys.get(note.note)
          if (!key) return null
          const state = stateOf(note)
          return (
            <span
              key={index}
              className="falling__note"
              data-hand={note.hand}
              data-black={key.black}
              data-done={!!state.done}
              data-missed={!!state.missed}
              data-now={!!state.now}
              data-crossing={crossing.has(note)}
              data-lit={!!state.lit}
              data-timing={state.timing}
              style={
                {
                  left: `${key.leftPercent}%`,
                  width: `${key.widthPercent}%`,
                  '--start': note.start,
                  '--length': note.beats,
                } as React.CSSProperties
              }
            >
              {/* Its finger, whatever the keys say: the keyboard names the key,
                  the bar says how to play it. The hand is its color. */}
              <span className="falling__label">{note.finger}</span>
            </span>
          )
        })}
      </div>
      {/* The line the notes are played at, glowing above each key played right. */}
      <span className="falling__line" aria-hidden />
      {glowing.map(([note, hit]) => {
        const key = keys.get(note)
        if (!key) return null
        return (
          <span
            key={`${note}:${hit?.step ?? 'free'}`}
            className="falling__glow"
            aria-hidden
            data-hand={hit?.hand}
            data-free={hit === null}
            style={{ left: `${key.leftPercent}%`, width: `${key.widthPercent}%` }}
          />
        )
      })}
      {children}
    </div>
  )
}
