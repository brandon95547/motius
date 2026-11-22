import * as React from 'react'
import {
  CADENCE_DOMINANTS,
  CADENCE_FORM_LABELS,
  CADENCE_FORMS,
  CADENCE_POSITION_NAMES,
  PROGRESSION_TYPE_DESCRIPTIONS,
  PROGRESSION_TYPE_LABELS,
  PROGRESSION_TYPES,
  type CadenceDominant,
  type CadenceForm,
  type CadenceSpec,
  type ProgressionType,
} from '@motius/shared'
import { Field, SegmentedControl, Select } from '@/ui/Controls'
import { Divider } from '@/ui/Display'
import { useLearningStore } from '@/state/learning-store'
import { pageActions } from '@/state/page-store'
import { OptionGroup } from '@/ui/Surface'
import { AreaTheoryLink, HandsField, KeyFields } from './area-fields'

/*
 * How the cadence is laid out between the hands — the panel calls it Voicing.
 *
 * It was labelled Cadence, which said nothing the area's name had not, and
 * its first option is Three Positions, right beside a setting called Position.
 * Two controls that both sounded like "position" read as one choice made
 * twice. Position is the inversion the tonic chord starts in; this is who
 * plays the chords and who plays the roots.
 */
const FORM_DESCRIPTIONS: Record<CadenceForm, string> = {
  positions: 'The chords in both hands, from each position of the tonic.',
  'root-in-bass': 'Right hand on the chords, left hand on the root of each.',
  'root-in-treble': 'Left hand on the chords, right hand on the root of each.',
}

type CadencePosition = CadenceSpec['position']
const POSITION_OPTIONS: readonly { value: CadencePosition; label: string }[] = [
  { value: 'all', label: 'All Three' },
  ...CADENCE_POSITION_NAMES.map((label, index) => ({ value: index as CadencePosition, label })),
]

const DOMINANT_LABELS: Record<CadenceDominant, string> = {
  V: 'Dominant triad',
  V7: 'Dominant seventh',
}
const DOMINANT_DESCRIPTIONS: Record<CadenceDominant, string> = {
  V: 'I – IV – I – V – I.',
  V7: 'I – IV – I – V7 – I.',
}

/**
 * The options of the Progressions area.
 *
 * Progressions is a category: what is practised in it is one of its types, and
 * each type brings its own settings. So the panel opens with the type, and the
 * rest of it is whatever that type needs — a type added later adds its own
 * settings here and leaves the others alone.
 */
export function ProgressionOptions() {
  const type = useLearningStore((state) => state.progressionType)
  const typeId = React.useId()

  return (
    <>
      <OptionGroup>
        <Field label="Progression" htmlFor={typeId} hint={PROGRESSION_TYPE_DESCRIPTIONS[type]}>
          <Select
            id={typeId}
            size="sm"
            value={type}
            // Through the address, so the type survives a reload and Back undoes it.
            onChange={(event) => pageActions.openProgression(event.target.value as ProgressionType)}
            options={PROGRESSION_TYPES.map((option) => ({
              value: option,
              label: PROGRESSION_TYPE_LABELS[option],
            }))}
          />
        </Field>
      </OptionGroup>
      <Divider />
      {type === 'cadences' && <CadenceOptions />}
      <AreaTheoryLink />
    </>
  )
}

/** Cadences: the settings of the first type of progression. */
function CadenceOptions() {
  const spec = useLearningStore((state) => state.cadenceSpec)
  const update = useLearningStore((state) => state.updateCadenceSpec)
  const formId = React.useId()
  const positionId = React.useId()
  // The rooted forms are two-handed by nature and play one position, with both
  // dominants in turn: those three settings belong to the three positions only,
  // and step aside for the forms that have already decided them.
  const positions = spec.form === 'positions'

  return (
    <>
      <OptionGroup>
        <KeyFields area="progressions" />
      </OptionGroup>
      <Divider />
      <OptionGroup>
        <Field label="Voicing" htmlFor={formId} hint={FORM_DESCRIPTIONS[spec.form]}>
          <Select
            id={formId}
            size="sm"
            value={spec.form}
            onChange={(event) => update({ form: event.target.value as CadenceForm })}
            options={CADENCE_FORMS.map((form) => ({
              value: form,
              label: CADENCE_FORM_LABELS[form],
            }))}
          />
        </Field>
        {positions && (
          <>
            <Field
              label="Position"
              htmlFor={positionId}
              hint={
                spec.position === 'all'
                  ? 'The cadence from each position of the tonic chord, in turn.'
                  : undefined
              }
            >
              <Select
                id={positionId}
                size="sm"
                value={String(spec.position)}
                onChange={(event) =>
                  update({
                    position:
                      event.target.value === 'all'
                        ? 'all'
                        : (Number(event.target.value) as CadencePosition),
                  })
                }
                options={POSITION_OPTIONS.map((option) => ({
                  value: String(option.value),
                  label: option.label,
                }))}
              />
            </Field>
            <Field label="Dominant" hint={DOMINANT_DESCRIPTIONS[spec.dominant]}>
              <SegmentedControl<CadenceDominant>
                label="Dominant"
                value={spec.dominant}
                onChange={(dominant) => update({ dominant })}
                options={CADENCE_DOMINANTS.map((chord) => ({
                  value: chord,
                  label: DOMINANT_LABELS[chord],
                }))}
              />
            </Field>
          </>
        )}
      </OptionGroup>
      {positions && (
        <>
          <Divider />
          <OptionGroup>
            <HandsField area="progressions" />
          </OptionGroup>
        </>
      )}
    </>
  )
}
