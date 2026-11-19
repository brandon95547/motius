import type { NoteRange } from '../domain/device.js'
import type { Hand } from '../music/fingering.js'
import type { Exercise, ExerciseStep } from './exercise.js'
import { DEFAULT_PLAYABLE_RANGE } from './scale-exercise.js'

/**
 * The exercises the lessons play, one per lesson that has one.
 *
 * A lesson is taught as a teacher would teach it at the instrument, and the
 * exercise is what the student's hands do: Explore shows it on the keys, Learn
 * walks through it a step at a time, Practice takes the guidance away and
 * keeps score. Each is built from the keys the player has, like the others.
 */

export const LESSON_EXERCISES = ['two-black-key-groups', 'three-black-key-groups'] as const
export type LessonExerciseId = (typeof LESSON_EXERCISES)[number]

export interface LessonExerciseOptions {
  /** The keys the player has. A 61-key instrument when left out. */
  readonly range?: NoteRange
}

const MIDDLE_C = 60

/**
 * A group of black keys: its pitch classes, low to high, their names, and the
 * fingers each hand takes it with — low key first.
 */
interface BlackKeyGroup {
  readonly id: LessonExerciseId
  readonly title: string
  readonly pitchClasses: readonly number[]
  readonly names: readonly string[]
  readonly fingers: Readonly<Record<Hand, readonly number[]>>
}

/**
 * Fingering guide (`~/sites/piano knowledge`): Verbalis, *Natural Fingering*,
 * stage 1 "black keys first" (pp. 203–204), the one source that fingers these
 * groups — LH 4-3 and 4-3-2, RH 3-4 and 2-3-4, the long fingers keeping the
 * arm balanced toward the little-finger side; the left hand going up and the
 * right hand coming down, each group pressed as a block. Alfred Level 1 (p. 10)
 * likewise plays the groups as clusters, before any note has a name.
 */
const TWO: BlackKeyGroup = {
  id: 'two-black-key-groups',
  title: 'Two-black-key groups',
  pitchClasses: [1, 3],
  names: ['C♯', 'D♯'],
  fingers: { left: [4, 3], right: [3, 4] },
}
const THREE: BlackKeyGroup = {
  id: 'three-black-key-groups',
  title: 'Three-black-key groups',
  pitchClasses: [6, 8, 10],
  names: ['F♯', 'G♯', 'A♯'],
  fingers: { left: [4, 3, 2], right: [2, 3, 4] },
}

/**
 * Every group of one kind on the keyboard, each pressed as a block: the left
 * hand climbs from the bottom of the keyboard to middle C, then the right hand
 * comes down from the top to meet it. Each hand moves only toward the middle,
 * the way the guide has a beginner find the groups; together the two walks
 * cover the whole keyboard, so every group is found, and the hand that plays
 * each half of the keyboard is the one on that side.
 */
function blackKeyGroups(kind: BlackKeyGroup, range: NoteRange): Exercise {
  const groups: number[][] = []
  for (let octave = Math.floor(range.low / 12) * 12; octave <= range.high; octave += 12) {
    const group = kind.pitchClasses.map((pc) => octave + pc)
    if (group[0]! >= range.low && group[group.length - 1]! <= range.high) groups.push(group)
  }
  const handFor = (group: readonly number[]): Hand => (group[0]! < MIDDLE_C ? 'left' : 'right')
  // Left hand going up, then right hand coming down.
  const order = [
    ...groups.filter((group) => handFor(group) === 'left'),
    ...groups.filter((group) => handFor(group) === 'right').reverse(),
  ]

  const steps: ExerciseStep[] = order.map((group, index) => {
    const hand = handFor(group)
    const fingers = kind.fingers[hand]
    // Said once, where the hand that plays changes: on the first group of each.
    const first = index === 0 || handFor(order[index - 1]!) !== hand
    const cue = first
      ? hand === 'left'
        ? `Left hand, fingers ${fingers.join('-')}, going up`
        : `Right hand, fingers ${fingers.join('-')}, coming down`
      : undefined
    return {
      id: `group-${group[0]}`,
      notes: group,
      fingers: fingers.map((finger) => ({ finger, hand })),
      label: kind.names.join(' + '),
      noteLabels: kind.names,
      ...(cue && { cue }),
    }
  })
  const hands = (['left', 'right'] as const).filter((hand) =>
    groups.some((group) => handFor(group) === hand),
  )

  return {
    id: `lesson:${kind.id}`,
    kind: 'exercise',
    title: kind.title,
    subtitle: 'Left hand up · right hand down',
    steps,
    pitchClasses: kind.pitchClasses,
    rootPitchClass: null,
    pitchNames: Object.fromEntries(kind.pitchClasses.map((pc, i) => [pc, kind.names[i]!])),
    notes: steps.flatMap((step) => step.notes),
    // Written with every sharp printed: the lesson is in no key.
    keyFifths: null,
    facts: [{ label: 'Groups', value: String(groups.length) }],
    // From a published method (see above), not a scale system: `derived` is
    // the nearest of the sources a fingering can name.
    fingerings: hands.map((hand) => ({
      hand,
      fingers: kind.fingers[hand],
      source: 'derived',
      perStep: kind.pitchClasses.length,
    })),
    defaultBpm: 60,
    stepsAre: 'groups',
  }
}

/** The exercise a lesson plays. */
export function buildLessonExercise(
  id: LessonExerciseId,
  options: LessonExerciseOptions = {},
): Exercise {
  const range = options.range ?? DEFAULT_PLAYABLE_RANGE
  switch (id) {
    case 'two-black-key-groups':
      return blackKeyGroups(TWO, range)
    case 'three-black-key-groups':
      return blackKeyGroups(THREE, range)
  }
}
