import type { Hand } from '../music/fingering.js'
import type { ExerciseStep } from './exercise.js'
import { LETTER_OF } from './lesson-keys.js'

/*
 * Where a hand crosses: the thumb tucked under the fingers, or a finger
 * lifted over the thumb, to go on past five keys. A lesson marks the step that
 * needs it, and the app stops there to show how, before the key is played.
 *
 * Fingering guide (`~/sites/piano knowledge`, `topics/fingering-rulebook.md`
 * §2): thumb under going away from the body, a finger over the thumb coming
 * back. The right hand goes up with its fingers' numbers rising, the left hand
 * with them falling; a move against that is a crossing.
 */

export type CrossingKind = 'thumb-under' | 'finger-over'

/** A crossing, as the hand is just before it: on white keys, counted left to right. */
export interface StepCrossing {
  readonly hand: Hand
  readonly kind: CrossingKind
  /** Which way the music is going. */
  readonly direction: 'up' | 'down'
  /** The finger that crosses: 1 under, or 3 (say) over. */
  readonly finger: number
  /** The white keys drawn, left to right, by letter. */
  readonly keys: readonly string[]
  /** Fingers 1 to 3 where the hand holds them, by key, the crossing finger included. */
  readonly fingers: readonly { readonly finger: number; readonly key: number }[]
  /** The key the crossing finger plays. */
  readonly to: number
}

/** White keys counted from C0: two notes a step apart are one apart here. */
const whiteIndex = (note: number) =>
  Math.floor(note / 12) * 7 +
  Object.keys(LETTER_OF)
    .map(Number)
    .indexOf(note % 12)

const letterAt = (index: number) => LETTER_OF[[0, 2, 4, 5, 7, 9, 11][((index % 7) + 7) % 7]!]!

/**
 * The crossing from one step to the next, in one hand on white keys, or null.
 * The hand is drawn as it stands on the step before: each finger as many
 * white keys from that step's finger as their numbers are apart.
 */
export function crossingInto(before: ExerciseStep, step: ExerciseStep): StepCrossing | null {
  const was = before.fingers[0]
  const now = step.fingers[0]
  const from = before.notes[0]
  const to = step.notes[0]
  if (!was || !now || from === undefined || to === undefined || was.hand !== now.hand) return null
  if (LETTER_OF[from % 12] === undefined || LETTER_OF[to % 12] === undefined || from === to)
    return null
  const hand = now.hand
  const up = to > from
  // The right hand's numbers rise going up, the left hand's fall.
  const rising = now.finger > was.finger
  const crossing = was.finger !== now.finger && (up === (hand === 'right')) !== rising
  if (!crossing) return null

  const anchor = whiteIndex(from)
  // White keys to the right of the anchor finger for each finger: the right
  // hand's thumb is on the left, the left hand's on the right.
  const placeOf = (finger: number) =>
    anchor + (hand === 'right' ? finger - was.finger : was.finger - finger)
  const target = whiteIndex(to)
  const places = [1, 2, 3].map((finger) => ({ finger, at: placeOf(finger) }))
  const low = Math.min(target, ...places.map((place) => place.at))
  const high = Math.max(target, ...places.map((place) => place.at))

  return {
    hand,
    kind: now.finger === 1 ? 'thumb-under' : 'finger-over',
    direction: up ? 'up' : 'down',
    finger: now.finger,
    keys: Array.from({ length: high - low + 1 }, (_, i) => letterAt(low + i)),
    fingers: places.map(({ finger, at }) => ({ finger, key: at - low })),
    to: target - low,
  }
}

/** The steps, each marked where the hand crosses into it. */
export function markCrossings(steps: readonly ExerciseStep[]): ExerciseStep[] {
  return steps.map((step, index) => {
    const before = steps[index - 1]
    const crossing = before && crossingInto(before, step)
    return crossing ? { ...step, crossing } : step
  })
}
