import * as React from 'react'
import {
  ARPEGGIO_CHORDS,
  CHORD_FORMS,
  CHORD_KIND_LABELS,
  CHORD_STYLE_LABELS,
  CHORD_STYLES,
  chordStylesFor,
  chordPositionName,
  SCALE_DIRECTIONS,
  type ArpeggioChord,
  type ChordForm,
  type ChordStyle,
  type ScaleDirection,
} from '@motius/shared'
import { Field, SegmentedControl, Select } from '@/ui/Controls'
import { Divider } from '@/ui/Display'
import { useLearningStore } from '@/state/learning-store'
import { OptionGroup } from '@/ui/Surface'
import { DIRECTION_SHORT } from './ScaleControls'
import { AreaTheoryLink, HandsField, KeyFields, seventhName } from './area-fields'

/**
 * The Chords and Arpeggios options, for the panel the bar's Options button
 * opens. Progressions is in `ProgressionControls`, Exercises and Fingering in
 * `RoutineControls`, and the fields they all share in `area-fields`.
 *
 * Built the way the Scales options are, so the areas read as one instrument:
 * what is played first, then the key it is played in, then which hand plays
 * it. Each setting is a field with its name over it, and the ones whose
 * choices need a sentence say it under the field, for the choice that is made.
 */

/** What each kind of chord is, said under the field that chooses it. */
const KIND_DESCRIPTIONS: Record<ChordForm, string> = {
  triad: 'Three notes: root position and both inversions.',
  'four-note': 'The triad with its octave added.',
  seventh: 'Root position and three inversions.',
  'key-triads': 'The triad on every note of the scale, up to the octave.',
}

const ARPEGGIO_CHORD_LABELS: Record<ArpeggioChord, string> = {
  triad: 'Triad',
  seventh: 'Seventh Chord',
}

/** The positions an arpeggio can start from: three for a triad, four for a seventh. */
const positionsOf = (chord: ArpeggioChord) => (chord === 'triad' ? [0, 1, 2] : [0, 1, 2, 3])

/** The options of the Chords area. */
export function ChordOptions() {
  const spec = useLearningStore((state) => state.chordSpec)
  const update = useLearningStore((state) => state.updateChordSpec)
  const chordId = React.useId()
  const playedId = React.useId()
  const kindLabel = (kind: ChordForm) =>
    kind === 'seventh' ? seventhName(spec.mode) : CHORD_KIND_LABELS[kind]
  // The style in force: a chord that cannot be broken the alternate way is
  // broken the plain way, and the control says so rather than lying.
  const styles = chordStylesFor(spec.chord)
  const style: ChordStyle = styles.includes(spec.style) ? spec.style : 'broken'
  const styleHelp: Record<ChordStyle, string> = {
    solid: 'Every note of the chord together.',
    broken:
      spec.chord === 'key-triads'
        ? 'A note at a time. With both hands, the left plays each chord and the right answers.'
        : 'A note at a time, up through the positions and back.',
    'broken-alternate': 'Bottom, third note, second, top: the hand rocks instead of running.',
  }

  return (
    <>
      <OptionGroup>
        <Field label="Chord" htmlFor={chordId} hint={KIND_DESCRIPTIONS[spec.chord]}>
          <Select
            id={chordId}
            size="sm"
            value={spec.chord}
            onChange={(event) => update({ chord: event.target.value as ChordForm })}
            options={CHORD_FORMS.map((kind) => ({ value: kind, label: kindLabel(kind) }))}
          />
        </Field>
        <Field label="Played" htmlFor={playedId} hint={styleHelp[style]}>
          <Select
            id={playedId}
            size="sm"
            value={style}
            onChange={(event) => update({ style: event.target.value as ChordStyle })}
            options={CHORD_STYLES.map((option) => ({
              value: option,
              // The one that is off says why, in the only place a native option can.
              label: styles.includes(option)
                ? CHORD_STYLE_LABELS[option]
                : `${CHORD_STYLE_LABELS[option]} (four-note chords)`,
              disabled: !styles.includes(option),
            }))}
          />
        </Field>
      </OptionGroup>
      <Divider />
      <OptionGroup>
        <KeyFields area="chords" />
      </OptionGroup>
      <Divider />
      <OptionGroup>
        <HandsField area="chords" />
      </OptionGroup>
      <AreaTheoryLink />
    </>
  )
}

/** The options of the Arpeggios area. */
export function ArpeggioOptions() {
  const spec = useLearningStore((state) => state.arpeggioSpec)
  const update = useLearningStore((state) => state.updateArpeggioSpec)
  const positionId = React.useId()
  const positions = positionsOf(spec.chord)
  const toneCount = positions.length
  // A triad has no third inversion; asked for one, it plays the root position.
  const position = spec.position % toneCount
  const chordLabel = (chord: ArpeggioChord) =>
    chord === 'seventh' ? seventhName(spec.mode) : ARPEGGIO_CHORD_LABELS[chord]

  return (
    <>
      <OptionGroup>
        <Field label="Chord">
          <SegmentedControl<ArpeggioChord>
            label="Chord"
            value={spec.chord}
            onChange={(chord) => update({ chord })}
            options={ARPEGGIO_CHORDS.map((chord) => ({ value: chord, label: chordLabel(chord) }))}
          />
        </Field>
        <Field label="Position" htmlFor={positionId}>
          <Select
            id={positionId}
            size="sm"
            value={String(position)}
            onChange={(event) => update({ position: Number(event.target.value) })}
            options={positions.map((at) => ({
              value: String(at),
              label: chordPositionName(toneCount, at),
            }))}
          />
        </Field>
        <Field label="Direction">
          <SegmentedControl<ScaleDirection>
            label="Direction"
            value={spec.direction}
            onChange={(direction) => update({ direction })}
            options={SCALE_DIRECTIONS.map((direction) => ({
              value: direction,
              label: DIRECTION_SHORT[direction],
            }))}
          />
        </Field>
      </OptionGroup>
      <Divider />
      <OptionGroup>
        <KeyFields area="arpeggios" />
      </OptionGroup>
      <Divider />
      <OptionGroup>
        <HandsField area="arpeggios" />
      </OptionGroup>
      <AreaTheoryLink />
    </>
  )
}
