/**
 * A song, measured and laid out: the staff's score, in one place to import from.
 *
 * Each part lives in a module of its own — the measured score and its small
 * questions (`score-model`), measuring (`measure-score`), the hook that keeps a
 * song measured (`use-measured-score`), which staves each stretch is drawn on
 * (`score-regions`), a system's height (`system-layout`), a line's chords and
 * bar lines (`score-lines`) and where lines break (`systems`).
 */

export {
  barMarksOf,
  changedClefs,
  clefsAt,
  layersOf,
  voiceOn,
  type BarMarks,
  type Measured,
  type RestMark,
  type ScoreLayer,
  type ScoreSource,
  type StaffClefs,
} from './score-model'
export { BEAM_LINES, staffOfLine, type BeamLine } from './notation'
export { measureScore } from './measure-score'
export { AIR } from './measure-chord'
export { alignLayers, useMeasuredScore } from './use-measured-score'
export { regionsOf, type ScoreRegion } from './score-regions'
export {
  frameOf,
  headerEnd,
  layoutOf,
  spreadOf,
  timeX,
  VOLTA_Y,
  type SystemLayout,
} from './system-layout'
export {
  barLinesIn,
  barRestsIn,
  endOf,
  leadIn,
  place,
  voltasIn,
  type BarLine,
  type BarRest,
  type Placed,
  type Volta,
} from './score-lines'
export { breakIntoSystems, type System } from './systems'
