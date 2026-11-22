import type { NoteRange } from '../domain/device-schemas.js'
import type {
  ArpeggioSpec,
  CadenceSpec,
  ChordSpec,
  FingeringDrillSpec,
  RoutineSpec,
  ScaleSpec,
} from './practice-specs.js'

/*
 * What each practice area opens on, and the keys an exercise assumes with
 * nothing plugged in: plain settings, apart from the builders that turn them
 * into exercises, so the app can hold them from the start while each builder
 * loads only when its area first opens (`practice-builders.ts`).
 */

export const DEFAULT_SCALE_SPEC: ScaleSpec = {
  kind: 'scale',
  rootPitchClass: 9, // A
  scaleTypeId: 'natural-minor',
  hand: 'right',
  octaves: 2,
  direction: 'up',
}

/**
 * The keys an exercise may use, unless it is told about a bigger keyboard: a
 * 61-key instrument, C2 to C7, which is also the default view.
 */
export const DEFAULT_PLAYABLE_RANGE: NoteRange = { low: 36, high: 96 }

export const DEFAULT_CHORD_SPEC: ChordSpec = {
  kind: 'chord',
  rootPitchClass: 0,
  mode: 'major',
  hand: 'right',
  chord: 'triad',
  style: 'solid',
}

export const DEFAULT_ARPEGGIO_SPEC: ArpeggioSpec = {
  kind: 'arpeggio',
  rootPitchClass: 0,
  mode: 'major',
  hand: 'right',
  chord: 'triad',
  position: 0,
  direction: 'up-down',
}

export const DEFAULT_CADENCE_SPEC: CadenceSpec = {
  kind: 'progression',
  rootPitchClass: 0,
  mode: 'major',
  hand: 'both',
  form: 'positions',
  position: 'all',
  dominant: 'V7',
}

export const DEFAULT_ROUTINE_SPEC: RoutineSpec = {
  kind: 'exercise',
  rootPitchClass: 0,
  mode: 'major',
  hand: 'right',
  routine: 'blocked',
}

export const DEFAULT_FINGERING_DRILL_SPEC: FingeringDrillSpec = {
  kind: 'fingering',
  rootPitchClass: 0,
  mode: 'major',
  hand: 'right',
  drill: 'five-finger',
}

/** The tempo the app opens on: a scale's, before its builder has loaded. */
export const DEFAULT_PRACTICE_BPM = 72
