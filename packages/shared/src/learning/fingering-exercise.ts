import { z } from 'zod'
import type { NoteRange } from '../domain/device.js'
import { KEY_MODE_LABELS, KEY_MODES, type KeyMode } from '../music/chords.js'
import { scaleFingering, type Hand } from '../music/fingering.js'
import { fingeringSystem, type FingeringSystemId } from '../music/fingering-system.js'
import {
  findScaleType,
  keySignatureOf,
  scaleOffsets,
  SCALE_TYPES,
  spellScale,
} from '../music/scales.js'
import type { Exercise, ExerciseFingering, ExerciseMeter } from './exercise.js'
import { stepsFrom, type Moment, type Played } from './routine-exercise.js'
import {
  DEFAULT_PLAYABLE_RANGE,
  HAND_LABELS,
  SCALE_HANDS,
  type ScaleHands,
} from './scale-exercise.js'

/**
 * The fingering exercises: the few movements all fingering is made of, each
 * taken out of the music and practised by itself.
 *
 * A fingering is a hand position and the ways of leaving it. A hand lies over
 * five keys; it gets to a sixth by passing the thumb under or a finger over;
 * it takes a chord as a shape; it changes finger on a note to be somewhere
 * else afterwards. A piece asks for all of these at once and in passing, which
 * is the worst way to meet any of them for the first time. So each has an
 * exercise here that is nothing else, in whatever key is being studied.
 *
 * ## Where the fingers come from
 *
 * From the fingering system the player has chosen, wherever the exercise is a
 * piece of something that system prints. The thumb is passed where *this key's
 * scale* passes it — under the 3rd finger after E in C major, and in the left
 * hand of G major over the thumb on B or on E, according to the system. So
 * what is drilled here is what the scales area teaches and what a song is
 * fingered with, and not a fourth opinion.
 *
 * The rest are their own fingering by definition: five fingers on five keys,
 * and 3 2 1 on a repeated note.
 *
 * A minor key is played in its harmonic form, as the routines are: it is the
 * form the key's chords come from.
 */

export const FINGERING_DRILLS = [
  'five-finger',
  'thumb-under',
  'arpeggio-crossing',
  'broken-chord',
  'repeated-notes',
  'independence',
] as const
export type FingeringDrill = (typeof FINGERING_DRILLS)[number]

export const FINGERING_DRILL_LABELS: Record<FingeringDrill, string> = {
  'five-finger': 'Five-Finger Position',
  'thumb-under': 'Passing the Thumb',
  'arpeggio-crossing': 'Passing the Thumb in an Arpeggio',
  'broken-chord': 'Broken Chords',
  'repeated-notes': 'Changing Fingers on a Repeated Note',
  independence: 'Finger Independence',
}

/** What each exercise is, in a line — for the menu that chooses between them. */
export const FINGERING_DRILL_DESCRIPTIONS: Record<FingeringDrill, string> = {
  'five-finger': 'Five fingers on five keys, up and back: the position everything else leaves.',
  'thumb-under':
    'Back and forth over each place this key’s scale passes the thumb, until it is not an event.',
  'arpeggio-crossing':
    'The same across a chord, where the thumb has a third or a fourth to travel.',
  'broken-chord': 'I, IV and V taken as shapes and played a finger at a time.',
  'repeated-notes': 'Each note three times, 3 2 1: a new finger arrives as the last one leaves.',
  independence: 'One figure carried up the scale and back, every finger taking its turn to lead.',
}

const ONE_HAND: readonly ScaleHands[] = ['right', 'left']

/**
 * The hands an exercise can be played with.
 *
 * The two that drill a crossing are one hand at a time. The hands pass the
 * thumb at different places in the same scale — the right under its 3rd finger
 * where the left is in the middle of a group — so there is no figure both can
 * play together that is about the crossing for both.
 */
export function fingeringDrillHands(drill: FingeringDrill): readonly ScaleHands[] {
  return drill === 'thumb-under' || drill === 'arpeggio-crossing' ? ONE_HAND : SCALE_HANDS
}

export const fingeringDrillSpecSchema = z.object({
  kind: z.literal('fingering'),
  rootPitchClass: z.number().int().min(0).max(11),
  /** Which of the key's names it is written under. See `ScaleSpec.tonic`. */
  tonic: z.string().optional(),
  mode: z.enum(KEY_MODES),
  hand: z.enum(SCALE_HANDS),
  drill: z.enum(FINGERING_DRILLS),
})
export type FingeringDrillSpec = z.infer<typeof fingeringDrillSpecSchema>

export const DEFAULT_FINGERING_DRILL_SPEC: FingeringDrillSpec = {
  kind: 'fingering',
  rootPitchClass: 0,
  mode: 'major',
  hand: 'right',
  drill: 'five-finger',
}

export interface FingeringExerciseOptions {
  readonly fingering?: FingeringSystemId
  /** The keys the player has. A 61-key instrument when left out. */
  readonly range?: NoteRange
}

/** The register the exercises sit in: the right hand's tonic somewhere from F3 to E4. */
const PREFERRED_RIGHT = 58.5

const mod7 = (degree: number) => ((degree % 7) + 7) % 7
const repeat = <T>(times: number, items: readonly T[]): T[] =>
  Array.from({ length: times }, () => items).flat()

const ORDINALS = ['', '1st', '2nd', '3rd', '4th', '5th']

export function buildFingeringExercise(
  spec: FingeringDrillSpec,
  options: FingeringExerciseOptions = {},
): Exercise {
  const range = options.range ?? DEFAULT_PLAYABLE_RANGE
  const system = fingeringSystem(options.fingering)
  const mode: KeyMode = spec.mode
  const type = findScaleType(mode === 'major' ? 'major' : 'harmonic-minor') ?? SCALE_TYPES[0]!
  const scale = spellScale(spec.rootPitchClass, type, spec.tonic)
  const offsets = scaleOffsets(type)
  const tonic = scale.notes[0]!
  const keyName = `${tonic.name} ${KEY_MODE_LABELS[mode]}`
  const allowed = fingeringDrillHands(spec.drill)
  const chosen: ScaleHands = allowed.includes(spec.hand) ? spec.hand : allowed[0]!
  const hands: readonly Hand[] = chosen === 'both' ? ['left', 'right'] : [chosen]

  /** The key at a scale degree counted from a tonic: 7 is that tonic's octave, -1 the note below it. */
  const keyAt = (anchor: number, degree: number) =>
    anchor + Math.floor(degree / 7) * 12 + offsets[mod7(degree)]!
  const nameAt = (degree: number) => scale.notes[mod7(degree)]!.name

  /**
   * Where the right hand's tonic goes: the register the scales start in, or
   * the nearest octave to it from which the exercise fits the keyboard. The
   * left hand is an octave under it.
   */
  const place = (lowest: number, highest: number): number => {
    const down = hands.includes('left') ? 12 : 0
    const candidates = [24, 36, 48, 60, 72, 84].map((c) => c + tonic.pitchClass)
    const fitting = candidates.filter(
      (right) => keyAt(right, highest) <= range.high && keyAt(right - down, lowest) >= range.low,
    )
    const pool = fitting.length > 0 ? fitting : candidates
    return pool.reduce((best, note) =>
      Math.abs(note - PREFERRED_RIGHT) < Math.abs(best - PREFERRED_RIGHT) ? note : best,
    )
  }
  const anchorOf = (hand: Hand, placed: number) => (hand === 'right' ? placed : placed - 12)

  /** A line every playing hand takes together, an octave apart: a degree and a finger for each note. */
  const line = (
    placed: number,
    notes: readonly {
      degree: number
      finger: (hand: Hand) => number
      beats: number
      cue?: string
      numeral?: string
    }[],
  ): Moment[] =>
    notes.map(({ degree, finger, beats, cue, numeral }) => ({
      ...Object.fromEntries(
        hands.map((hand): [Hand, Played[]] => [
          hand,
          [
            {
              note: keyAt(anchorOf(hand, placed), degree),
              name: nameAt(degree),
              finger: finger(hand),
            },
          ],
        ]),
      ),
      beats,
      ...(cue ? { cue } : {}),
      ...(numeral ? { degree: numeral } : {}),
    }))

  let moments: Moment[]
  let fingerings: ExerciseFingering[]
  let detail: string
  let placed: number
  const meter: ExerciseMeter = { beats: 4, beatType: 4 }
  let defaultBpm = 72

  switch (spec.drill) {
    case 'five-finger': {
      /*
       * The first five notes of the key, a finger to each: thumb to little
       * finger in the right hand, little finger to thumb in the left. Twice up
       * and back in eighths, and home.
       */
      placed = place(0, 4)
      const finger = (degree: number) => (hand: Hand) =>
        hand === 'right' ? degree + 1 : 5 - degree
      const figure = [0, 1, 2, 3, 4, 3, 2, 1]
      moments = line(placed, [
        ...repeat(2, figure).map((degree) => ({ degree, finger: finger(degree), beats: 0.5 })),
        { degree: 0, finger: finger(0), beats: 4 },
      ])
      fingerings = hands.map((hand) => ({
        hand,
        fingers: hand === 'right' ? [1, 2, 3, 4, 5] : [5, 4, 3, 2, 1],
        source: 'standard',
      }))
      detail = 'Five notes, up and back'
      break
    }

    case 'thumb-under': {
      /*
       * The scale's own crossings, and nothing between them. Two octaves of
       * the key as the system fingers it; wherever the thumb passes under a
       * finger — or, in the left hand going up, a finger over the thumb — the
       * two notes before it, the crossing, and the note after: up and back,
       * twice, and a bar to settle. Then the scale's other crossing.
       */
      const hand = hands[0]!
      // The left hand's two octaves start an octave under the right's.
      placed = place(0, hand === 'left' ? 7 : 14)
      const anchor = anchorOf(hand, placed)
      const fingers = scaleFingering({
        rootName: tonic.name,
        scaleTypeId: type.id,
        hand,
        octaves: 2,
        notes: Array.from({ length: 15 }, (_, index) => keyAt(anchor, index)),
        system: options.fingering,
      }).fingers
      // Where the hand moves, clear of the run's own opening and turn.
      const crossings: number[] = []
      for (let index = 3; index <= 13; index++) {
        const crossed =
          hand === 'right'
            ? fingers[index] === 1 && fingers[index - 1]! > 1
            : fingers[index - 1] === 1 && fingers[index]! > 1
        if (crossed) crossings.push(index)
      }
      const at = (index: number): Played => ({
        note: keyAt(anchor, index),
        name: nameAt(index),
        finger: fingers[index]!,
      })
      moments = crossings.slice(0, 2).flatMap((crossing) => {
        const bridge = hand === 'right' ? fingers[crossing - 1]! : fingers[crossing]!
        const figure = [-3, -2, -1, 0, 1, 0, -1, -2].map((step) => crossing + step)
        const cue =
          hand === 'right'
            ? `Thumb under the ${ORDINALS[bridge]}`
            : `${ORDINALS[bridge]} over the thumb`
        return [
          ...repeat(2, figure).map((index, order): Moment => ({
            [hand]: [at(index)],
            beats: 0.5,
            ...(order === 0 ? { cue } : {}),
          })),
          { [hand]: [at(crossing - 3)], beats: 4 },
        ]
      })
      fingerings = [{ hand, fingers: fingers.slice(0, 8), source: 'standard' }]
      detail = 'Each crossing of the scale'
      break
    }

    case 'arpeggio-crossing': {
      /*
       * The key's own chord, two octaves, as the system fingers its arpeggio —
       * and of that, the one place the hand has to move: the note before the
       * crossing, the crossing, the note after, and back. In triplets, four
       * times round, and home.
       */
      const hand = hands[0]!
      // The left hand's two octaves start an octave under the right's.
      placed = place(0, hand === 'left' ? 7 : 14)
      const anchor = anchorOf(hand, placed)
      const degrees = [0, 2, 4, 7, 9, 11, 14]
      const printed = system.arpeggio({
        tonic: tonic.name,
        mode,
        kind: 'triad',
        position: 0,
        hand,
        octaves: 2,
      })
      const fingers = printed ?? (hand === 'right' ? [1, 2, 3, 1, 2, 3, 5] : [5, 4, 2, 1, 4, 2, 1])
      let crossing = hand === 'right' ? 3 : 4
      for (let index = 2; index <= 5; index++) {
        const crossed =
          hand === 'right'
            ? fingers[index] === 1 && fingers[index - 1]! > 1
            : fingers[index - 1] === 1 && fingers[index]! > 1
        if (crossed) {
          crossing = index
          break
        }
      }
      const bridge = hand === 'right' ? fingers[crossing - 1]! : fingers[crossing]!
      const at = (index: number): Played => ({
        note: keyAt(anchor, degrees[index]!),
        name: nameAt(degrees[index]!),
        finger: fingers[index]!,
      })
      const figure = [-2, -1, 0, 1, 0, -1].map((step) => crossing + step)
      moments = [
        ...repeat(4, figure).map((index, order): Moment => ({
          [hand]: [at(index)],
          beats: 1 / 3,
          ...(order === 0
            ? {
                cue:
                  hand === 'right'
                    ? `Thumb under the ${ORDINALS[bridge]}`
                    : `${ORDINALS[bridge]} over the thumb`,
              }
            : {}),
        })),
        { [hand]: [at(crossing - 2)], beats: 4 },
      ]
      fingerings = [{ hand, fingers, source: printed ? 'standard' : 'derived' }]
      detail = 'The crossing of the arpeggio'
      break
    }

    case 'broken-chord': {
      /*
       * I, IV, V and I in the positions that lie under one hand without
       * moving it — the tonic in root position, the subdominant with its
       * fifth at the bottom, the dominant with its third at the bottom — each
       * broken low, high, middle, high, and the tonic struck whole to finish.
       * Fingered as the system fingers each shape held.
       */
      placed = place(-1, 5)
      const minor = mode === 'minor'
      const chords = [
        { degrees: [0, 2, 4], position: 0, numeral: minor ? 'i' : 'I' },
        { degrees: [0, 3, 5], position: 2, numeral: minor ? 'iv' : 'IV' },
        { degrees: [-1, 1, 4], position: 1, numeral: 'V' },
        { degrees: [0, 2, 4], position: 0, numeral: minor ? 'i' : 'I' },
      ]
      const grip = (hand: Hand, position: number) =>
        system.chord({ kind: 'triad', mode, position, hand }) ??
        (hand === 'right' ? [1, 3, 5] : [5, 3, 1])
      const tones = (hand: Hand, chord: (typeof chords)[number]): Played[] =>
        chord.degrees.map((degree, index) => ({
          note: keyAt(anchorOf(hand, placed), degree),
          name: nameAt(degree),
          finger: grip(hand, chord.position)[index]!,
        }))
      moments = chords.flatMap((chord) =>
        repeat(2, [0, 2, 1, 2]).map((tone, order): Moment => ({
          ...Object.fromEntries(hands.map((hand) => [hand, [tones(hand, chord)[tone]!]])),
          beats: 0.5,
          degree: chord.numeral,
          ...(order === 0 ? { cue: chord.numeral } : {}),
        })),
      )
      moments.push({
        ...Object.fromEntries(hands.map((hand) => [hand, tones(hand, chords[0]!)])),
        beats: 4,
        degree: chords[0]!.numeral,
        label: `${tonic.name}${minor ? 'm' : ''}`,
      })
      fingerings = hands.map((hand) => ({
        hand,
        fingers: chords.slice(0, 3).flatMap((chord) => grip(hand, chord.position)),
        source: 'standard',
        perStep: 3,
      }))
      detail = 'I – IV – V – I'
      break
    }

    case 'repeated-notes': {
      /*
       * Up the scale and back, each note three times: 3, 2, 1. The hand does
       * not hop from note to note — the 3rd finger is over the next key while
       * the thumb is still on this one. Triplets, and the tonic to finish.
       */
      placed = place(0, 7)
      const degrees = [0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1, 0]
      moments = line(placed, [
        ...degrees.flatMap((degree) =>
          [3, 2, 1].map((finger) => ({ degree, finger: () => finger, beats: 1 / 3 })),
        ),
        { degree: 0, finger: () => 3, beats: 1 },
      ])
      fingerings = hands.map((hand) => ({ hand, fingers: [3, 2, 1], source: 'standard' }))
      detail = '3 2 1 on every note'
      break
    }

    case 'independence': {
      /*
       * One figure of eight notes — out a third, up three steps and back —
       * begun a degree higher each time for an octave, then turned over and
       * brought back down. Every finger plays in every bar and none of them
       * passes another: the hand moves up a key and does it again. The figure
       * is the first of Hanon's, which has been set in front of pianists
       * since 1873.
       */
      placed = place(0, 12)
      const rising = [0, 2, 3, 4, 5, 4, 3, 2]
      const falling = [0, -2, -3, -4, -5, -4, -3, -2]
      const up = (hand: Hand) =>
        hand === 'right' ? [1, 2, 3, 4, 5, 4, 3, 2] : [5, 4, 3, 2, 1, 2, 3, 4]
      const down = (hand: Hand) =>
        hand === 'right' ? [5, 4, 3, 2, 1, 2, 3, 4] : [1, 2, 3, 4, 5, 4, 3, 2]
      const bars = [
        ...Array.from({ length: 8 }, (_, from) => ({ from, shape: rising, fingers: up })),
        ...Array.from({ length: 8 }, (_, back) => ({
          from: 12 - back,
          shape: falling,
          fingers: down,
        })),
      ]
      moments = line(placed, [
        ...bars.flatMap(({ from, shape, fingers }) =>
          shape.map((step, index) => ({
            degree: from + step,
            finger: (hand: Hand) => fingers(hand)[index]!,
            beats: 0.25,
          })),
        ),
        { degree: 0, finger: (hand: Hand) => (hand === 'right' ? 1 : 5), beats: 4 },
      ])
      fingerings = hands.map((hand) => ({ hand, fingers: up(hand), source: 'standard' }))
      detail = 'An octave up and back'
      defaultBpm = 60
      break
    }
  }

  // A repeated note's next finger is not a crossing, and neither is the hand
  // moving along to the next note to repeat: those steps carry no cue.
  const steps =
    spec.drill === 'repeated-notes'
      ? stepsFrom(moments).map(({ cue: _cue, ...step }) => ({
          ...step,
          fingers: step.fingers.map(({ cue: _moved, ...finger }) => finger),
        }))
      : stepsFrom(moments)
  const titles: Record<FingeringDrill, string> = {
    'five-finger': `${keyName} Five-Finger Position`,
    'thumb-under': `Passing the Thumb, ${keyName}`,
    'arpeggio-crossing': `Passing the Thumb, ${keyName} Arpeggio`,
    'broken-chord': `${keyName} Broken Chords`,
    'repeated-notes': `Changing Fingers, ${keyName}`,
    independence: `Finger Independence, ${keyName}`,
  }

  return {
    id: `fingering:${spec.drill}:${tonic.name}:${mode}:${hands.join('+')}:${system.id}:${placed}`,
    kind: 'exercise',
    title: titles[spec.drill],
    subtitle: [HAND_LABELS[chosen], detail].join(' · '),
    steps,
    pitchClasses: scale.notes.map((note) => note.pitchClass),
    rootPitchClass: tonic.pitchClass,
    pitchNames: Object.fromEntries(scale.notes.map((note) => [note.pitchClass, note.name])),
    notes: steps.flatMap((step) => step.notes),
    keyFifths: keySignatureOf(scale),
    facts: [
      { label: 'Exercise', value: FINGERING_DRILL_LABELS[spec.drill] },
      { label: 'Key', value: mode === 'minor' ? `${keyName} (harmonic)` : keyName },
      { label: 'Notes', value: scale.notes.map((note) => note.name).join(' ') },
      { label: 'Fingering', value: system.shortName },
    ],
    fingerings,
    defaultBpm,
    meter,
  }
}
