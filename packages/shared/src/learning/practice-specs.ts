import { z } from 'zod'
import { KEY_MODES } from '../music/chords.js'
import {
  CHROMATIC_INTERVALS,
  SCALE_DIRECTIONS,
  SCALE_HANDS,
  SCALE_MOTIONS,
  SCALE_TEXTURES,
} from './scale-exercise.js'
import { ARPEGGIO_CHORDS, CHORD_FORMS, CHORD_STYLES } from './chord-exercise.js'
import { CADENCE_DOMINANTS, CADENCE_FORMS } from './cadence-exercise.js'
import { ROUTINES } from './routine-exercise.js'
import { FINGERING_DRILLS } from './fingering-exercise.js'

/*
 * The settings each practice area builds an exercise from, as schemas: apart
 * from the builders, which take only their types, so loading a builder in the
 * browser does not load zod (docs/adr/0009). For a server that keeps or checks
 * a spec; nothing parses one today.
 */

export const scaleSpecSchema = z.object({
  kind: z.literal('scale'),
  rootPitchClass: z.number().int().min(0).max(11),
  /**
   * Which of the key's names it is written under — `E♭` rather than `D♯`.
   *
   * Left out, the scale takes its usual name. Named, because two keys on the
   * same piano keys are still two keys: different signatures, different
   * spellings, and in a method book, different pages.
   */
  tonic: z.string().optional(),
  scaleTypeId: z.string().min(1),
  hand: z.enum(SCALE_HANDS),
  /** How the two hands move against each other. Similar motion when left out. */
  motion: z.enum(SCALE_MOTIONS).optional(),
  /** What each hand plays. Single notes when left out. */
  texture: z.enum(SCALE_TEXTURES).optional(),
  /** How far apart the hands of a chromatic scale are. An octave when left out. */
  apart: z.enum(CHROMATIC_INTERVALS).optional(),
  /**
   * Close with I – IV – V – I, as a scale book ends each scale. Only where
   * the scale comes back down to finish on its tonic.
   */
  cadence: z.boolean().optional(),
  /** How many notes to a beat. One when left out. */
  notesPerBeat: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  octaves: z.number().int().min(1).max(4),
  direction: z.enum(SCALE_DIRECTIONS),
})

export type ScaleSpec = z.infer<typeof scaleSpecSchema>

const keyFields = {
  rootPitchClass: z.number().int().min(0).max(11),
  /** Which of the key's names it is written under. See `ScaleSpec.tonic`. */
  tonic: z.string().optional(),
  mode: z.enum(KEY_MODES),
  hand: z.enum(SCALE_HANDS),
}

export const chordSpecSchema = z.object({
  kind: z.literal('chord'),
  ...keyFields,
  chord: z.enum(CHORD_FORMS),
  style: z.enum(CHORD_STYLES),
})

export type ChordSpec = z.infer<typeof chordSpecSchema>

export const arpeggioSpecSchema = z.object({
  kind: z.literal('arpeggio'),
  ...keyFields,
  chord: z.enum(ARPEGGIO_CHORDS),
  /** 0 is root position; each one after starts on the next chord note up. */
  position: z.number().int().min(0).max(3),
  direction: z.enum(SCALE_DIRECTIONS),
})

export type ArpeggioSpec = z.infer<typeof arpeggioSpecSchema>

export const cadenceSpecSchema = z.object({
  kind: z.literal('progression'),
  rootPitchClass: z.number().int().min(0).max(11),
  /** Which of the key's names it is written under. See `ScaleSpec.tonic`. */
  tonic: z.string().optional(),
  mode: z.enum(KEY_MODES),
  /** Which hand plays the chords in `positions`. The other forms take both. */
  hand: z.enum(SCALE_HANDS),
  form: z.enum(CADENCE_FORMS),
  /** 0, 1 or 2 for one position of the tonic; `all` for the three in turn. */
  position: z.union([z.literal('all'), z.number().int().min(0).max(2)]),
  dominant: z.enum(CADENCE_DOMINANTS),
})

export type CadenceSpec = z.infer<typeof cadenceSpecSchema>

export const routineSpecSchema = z.object({
  kind: z.literal('exercise'),
  rootPitchClass: z.number().int().min(0).max(11),
  /** Which of the key's names it is written under. See `ScaleSpec.tonic`. */
  tonic: z.string().optional(),
  mode: z.enum(KEY_MODES),
  hand: z.enum(SCALE_HANDS),
  routine: z.enum(ROUTINES),
})

export type RoutineSpec = z.infer<typeof routineSpecSchema>

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
