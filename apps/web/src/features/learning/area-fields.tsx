import * as React from 'react'
import {
  findScaleType,
  KEY_MODE_LABELS,
  KEY_MODES,
  scaleSpellings,
  SCALE_TYPES,
  spellScale,
  type KeyMode,
  type ScaleHands,
} from '@motius/shared'
import { Field, SegmentedControl, Select } from '@/ui/Controls'
import { Divider } from '@/ui/Display'
import { useLearningStore } from '@/state/learning-store'
import { theoryTitle } from '@/lib/theory-titles'
import { TheoryLink } from './ScaleControls'

/**
 * The fields the Chords, Arpeggios, Progressions and Exercises options share:
 * the key, the hands, and the way to the theory.
 */

export type Area = 'chords' | 'arpeggios' | 'progressions' | 'exercises' | 'fingering'

/** The area's settings and the action that changes them, whichever area it is. */
function useKey(area: Area) {
  const chord = useLearningStore((state) => state.chordSpec)
  const arpeggio = useLearningStore((state) => state.arpeggioSpec)
  // Progressions keeps a spec for each of its types. Cadences is the only one
  // so far; the next adds its own here, chosen by the type the area is on.
  const cadence = useLearningStore((state) => state.cadenceSpec)
  const routine = useLearningStore((state) => state.routineSpec)
  const fingering = useLearningStore((state) => state.fingeringSpec)
  const updateChord = useLearningStore((state) => state.updateChordSpec)
  const updateArpeggio = useLearningStore((state) => state.updateArpeggioSpec)
  const updateCadence = useLearningStore((state) => state.updateCadenceSpec)
  const updateRoutine = useLearningStore((state) => state.updateRoutineSpec)
  const updateFingering = useLearningStore((state) => state.updateFingeringSpec)
  const spec = {
    chords: chord,
    arpeggios: arpeggio,
    progressions: cadence,
    exercises: routine,
    fingering,
  }[area]
  // The fields the areas share. Each action takes its own area's patch; a key,
  // a mode and a hand are part of all of them.
  const update = {
    chords: updateChord,
    arpeggios: updateArpeggio,
    progressions: updateCadence,
    exercises: updateRoutine,
    fingering: updateFingering,
  }[area] as (patch: {
    rootPitchClass?: number
    tonic?: string
    mode?: KeyMode
    hand?: ScaleHands
  }) => void
  return { spec, update }
}

/** The scale a key's notes are spelled from: its harmonic form, in a minor key. */
const keyScale = (mode: KeyMode) =>
  findScaleType(mode === 'major' ? 'major' : 'harmonic-minor') ?? SCALE_TYPES[0]!

export const HAND_OPTIONS: readonly { value: ScaleHands; label: string }[] = [
  { value: 'right', label: 'Right' },
  { value: 'left', label: 'Left' },
  { value: 'both', label: 'Both' },
]

/** What the seventh chord of a key is: dominant in a major key, diminished in a minor. */
export const seventhName = (mode: KeyMode) =>
  mode === 'major' ? 'Dominant seventh' : 'Diminished seventh'

/**
 * The key: its tonic, major or minor, and which name it is written under.
 */
export function KeyFields({
  area,
  modes = true,
}: {
  area: Area
  /** False where what is played is built on a note rather than in a key. */
  modes?: boolean
}) {
  const { spec, update } = useKey(area)
  const rootId = React.useId()

  // Built on a note, it is named as the major key on that note is.
  const mode: KeyMode = modes ? spec.mode : 'major'
  const type = keyScale(mode)
  const roots = Array.from({ length: 12 }, (_, pitchClass) => ({
    value: String(pitchClass),
    label: spellScale(pitchClass, type, pitchClass === spec.rootPitchClass ? spec.tonic : undefined)
      .root.name,
  }))
  const key = roots[spec.rootPitchClass]?.label ?? ''
  const names = scaleSpellings(spec.rootPitchClass, type).map((scale) => scale.root.name)

  return (
    <>
      <Field label={modes ? 'Key' : 'Root'} htmlFor={rootId}>
        <div className="flex gap-2">
          <div className={modes ? 'w-[4.75rem] shrink-0' : 'min-w-0 flex-1'}>
            <Select
              id={rootId}
              size="sm"
              value={String(spec.rootPitchClass)}
              // A new key starts under its usual name.
              onChange={(event) =>
                update({ rootPitchClass: Number(event.target.value), tonic: undefined })
              }
              options={roots}
            />
          </div>
          {modes && (
            <SegmentedControl<KeyMode>
              label="Major or minor"
              className="min-w-0 flex-1"
              value={spec.mode}
              // The other mode on the same tonic is a different key, with its
              // own names: D♯ minor's major is E♭.
              onChange={(next) => update({ mode: next, tonic: undefined })}
              options={KEY_MODES.map((option) => ({
                value: option,
                label: KEY_MODE_LABELS[option],
              }))}
            />
          )}
        </div>
      </Field>
      {names.length > 1 && (
        <Field label="Written as">
          <SegmentedControl
            label="Written as"
            value={key}
            onChange={(tonic) => update({ tonic })}
            options={names.map((name) => ({ value: name, label: name }))}
          />
        </Field>
      )}
    </>
  )
}

export function HandsField({ area }: { area: Area }) {
  const { spec, update } = useKey(area)
  return (
    <Field label="Hands">
      <SegmentedControl<ScaleHands>
        label="Hands"
        value={spec.hand}
        onChange={(hand) => update({ hand })}
        options={HAND_OPTIONS}
      />
    </Field>
  )
}

/** The way to the theory of what the area has on the keys, once it has something. */
export function AreaTheoryLink() {
  const kind = useLearningStore((state) => state.exercise?.kind)
  const topic = useLearningStore((state) => state.topic)
  if (!kind) return null
  return (
    <>
      <Divider />
      <TheoryLink>{theoryTitle(topic, kind)}</TheoryLink>
    </>
  )
}
