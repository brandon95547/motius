import * as React from 'react'
import { noteName, pitchClass, pitchName } from '@motius/shared'
import { useKeyboardStore } from '@/state/keyboard-store'
import { useLearningStore, type KeyLabels } from '@/state/learning-store'
import { useViewStore } from '@/state/view-store'
import { useKeyAnnotation } from './key-annotations'
import type { KeyGeometry } from '@/lib/keyboard-layout'

/**
 * One key.
 *
 * Subscribes to its own note and nothing else. That is the whole reason the
 * active notes live in a store instead of in React state: a trill sends thirty
 * events a second, and each one has to repaint one key rather than a keyboard
 * of eighty-eight.
 */

export interface PianoKeyProps {
  geometry: KeyGeometry
  /** Height of the black keys as a percentage of the keybed. */
  blackHeightPercent: number
  keyLabels: KeyLabels
  /**
   * Whether this is the key the Tab key lands on.
   *
   * Exactly one at a time — see the roving tabindex in `PianoKeyboard`. The
   * rest are reachable with the arrow keys and are not tab stops, because
   * eighty-eight of them are eighty-eight presses to get past the piano.
   */
  tabbable: boolean
  onPress: (note: number, event: React.PointerEvent<HTMLButtonElement>) => void
  onEnter: (note: number, event: React.PointerEvent<HTMLButtonElement>) => void
  onRelease: (note: number, event: React.PointerEvent<HTMLButtonElement>) => void
  onKeyDown: (note: number, event: React.KeyboardEvent<HTMLButtonElement>) => void
  onKeyUp: (note: number, event: React.KeyboardEvent<HTMLButtonElement>) => void
}

export const PianoKey = React.memo(function PianoKey({
  geometry,
  blackHeightPercent,
  keyLabels,
  tabbable,
  onPress,
  onEnter,
  onRelease,
  onKeyDown,
  onKeyUp,
}: PianoKeyProps) {
  const { note, black } = geometry
  const active = useKeyboardStore((state) => state.active[note])
  const annotation = useKeyAnnotation(note)
  // Pressed when it was due, and still held: lit in the color of the hand that
  // plays it, as its falling note is. Only with falling notes up, whose colors
  // these are.
  const hit = useLearningStore((state) => state.hits[note])
  const falling = useViewStore((state) => state.stageView === 'falling')
  const label = noteName(note)
  // Middle C is the one landmark every player navigates from.
  const isAnchor = note === 60

  /**
   * The one thing written on this key, if anything.
   *
   * Degrees exist only for keys the exercise knows about, and fingers are drawn
   * in their own layer above the keys rather than written here. With the labels
   * on notes, every white key carries its name (the black keys' are above the
   * keyboard, `NoteNamesAbove`): the exercise's spelling where it names the key
   * by a letter, its own letter otherwise, and on a C the octave marker that
   * says where you are.
   */
  const keyText = ((): { text: string; anchor?: boolean } | null => {
    if (keyLabels === 'off' || keyLabels === 'fingers') return null
    if (keyLabels === 'degrees') return annotation?.degree ? { text: annotation.degree } : null
    const spelled = annotation?.label && /^[A-G]/.test(annotation.label) ? annotation.label : null
    if (spelled) return { text: spelled }
    if (pitchClass(note) === 0) return { text: label, anchor: isAnchor }
    return black ? null : { text: pitchName(note) }
  })()

  const style: React.CSSProperties = black
    ? {
        left: `${geometry.leftPercent}%`,
        width: `${geometry.widthPercent}%`,
        height: `${blackHeightPercent}%`,
        ...(active ? { '--key-velocity': active.velocity / 127 } : {}),
      }
    : active
      ? ({ '--key-velocity': active.velocity / 127 } as React.CSSProperties)
      : {}

  return (
    <button
      type="button"
      // A key is not a toggle: aria-pressed would say it stays down. `data-active`
      // drives the paint, and the live region in the keyboard announces notes.
      aria-label={annotation?.finger ? `${label}, finger ${annotation.finger}` : label}
      tabIndex={tabbable ? 0 : -1}
      data-note={note}
      data-active={active ? 'true' : undefined}
      data-role={annotation?.role}
      data-hit={active && falling && hit ? (hit.hand ?? 'right') : undefined}
      data-hand={falling ? annotation?.hand : undefined}
      data-group={annotation?.group}
      className={black ? 'piano-key piano-key--black' : 'piano-key piano-key--white'}
      style={style}
      onPointerDown={(event) => onPress(note, event)}
      onPointerEnter={(event) => onEnter(note, event)}
      onPointerUp={(event) => onRelease(note, event)}
      onPointerCancel={(event) => onRelease(note, event)}
      onKeyDown={(event) => onKeyDown(note, event)}
      onKeyUp={(event) => onKeyUp(note, event)}
      // Dragging a key would start a native drag and swallow the glissando.
      draggable={false}
    >
      {/* An annotated key shows the note it IS — `E♭`, not `E♭4` — because in
          a scale you are reading letters, not octaves. Unannotated keys keep
          the octave marker on every C, which is how you find your place. */}
      {keyText !== null && !black && (
        <span className={`piano-key__label${keyText.anchor ? ' piano-key__label--anchor' : ''}`}>
          {keyText.text}
        </span>
      )}
    </button>
  )
})
