import * as React from 'react'
import {
  FINGERING_DRILL_DESCRIPTIONS,
  FINGERING_DRILL_LABELS,
  FINGERING_DRILLS,
  fingeringDrillHands,
  ROUTINE_DESCRIPTIONS,
  ROUTINE_LABELS,
  routineHands,
  routineHasMode,
  ROUTINES,
  type FingeringDrill,
  type Routine,
  type ScaleHands,
} from '@motius/shared'
import { Field, SegmentedControl, Select } from '@/ui/Controls'
import { Divider } from '@/ui/Display'
import { useLearningStore } from '@/state/learning-store'
import { OptionGroup } from '@/ui/Surface'
import { AreaTheoryLink, HAND_OPTIONS, HandsField, KeyFields } from './area-fields'

/** The options of the Exercises and Fingering Exercises areas: a routine or a drill, in a key. */

/** The options of the Exercises area. */
export function ExerciseOptions() {
  const spec = useLearningStore((state) => state.routineSpec)
  const update = useLearningStore((state) => state.updateRoutineSpec)
  const routineId = React.useId()
  // A routine written for two hands is played with two, whatever was last
  // chosen; the choice is kept for the routines that have one.
  const choosesHand = routineHands(spec.routine).length > 1

  return (
    <>
      <OptionGroup>
        <Field label="Routine" htmlFor={routineId} hint={ROUTINE_DESCRIPTIONS[spec.routine]}>
          <Select
            id={routineId}
            size="sm"
            value={spec.routine}
            onChange={(event) => update({ routine: event.target.value as Routine })}
            options={ROUTINES.map((routine) => ({
              value: routine,
              label: ROUTINE_LABELS[routine],
            }))}
          />
        </Field>
      </OptionGroup>
      <Divider />
      <OptionGroup>
        <KeyFields area="exercises" modes={routineHasMode(spec.routine)} />
      </OptionGroup>
      <Divider />
      <OptionGroup>
        {choosesHand ? (
          <HandsField area="exercises" />
        ) : (
          <Field label="Hands">
            <p className="text-body-sm text-[var(--ds-fg-secondary)]">
              Both — this routine is written for two hands.
            </p>
          </Field>
        )}
      </OptionGroup>
      <AreaTheoryLink />
    </>
  )
}

/** The options of the Fingering Exercises area. */
export function FingeringOptions() {
  const spec = useLearningStore((state) => state.fingeringSpec)
  const update = useLearningStore((state) => state.updateFingeringSpec)
  const drillId = React.useId()
  // The exercises that drill a crossing are one hand at a time: the hands
  // pass the thumb at different places in the same scale.
  const hands = fingeringDrillHands(spec.drill)
  const hand = hands.includes(spec.hand) ? spec.hand : hands[0]!

  return (
    <>
      <OptionGroup>
        <Field label="Exercise" htmlFor={drillId} hint={FINGERING_DRILL_DESCRIPTIONS[spec.drill]}>
          <Select
            id={drillId}
            size="sm"
            value={spec.drill}
            onChange={(event) => update({ drill: event.target.value as FingeringDrill })}
            options={FINGERING_DRILLS.map((drill) => ({
              value: drill,
              label: FINGERING_DRILL_LABELS[drill],
            }))}
          />
        </Field>
      </OptionGroup>
      <Divider />
      <OptionGroup>
        <KeyFields area="fingering" />
      </OptionGroup>
      <Divider />
      <OptionGroup>
        <Field
          label="Hands"
          hint={
            hands.length < 3
              ? 'One hand at a time: each passes the thumb in its own place.'
              : undefined
          }
        >
          <SegmentedControl<ScaleHands>
            label="Hands"
            value={hand}
            onChange={(next) => update({ hand: next })}
            options={HAND_OPTIONS.filter((option) => hands.includes(option.value))}
          />
        </Field>
      </OptionGroup>
      <AreaTheoryLink />
    </>
  )
}
