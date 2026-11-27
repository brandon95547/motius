import type {
  ArpeggioSpec,
  CadenceSpec,
  ChordSpec,
  Exercise,
  FingeringDrillSpec,
  FingeringSystemId,
  Hand,
  KeyLabels,
  LearningMode,
  LessonExerciseId,
  NoteRange,
  ProgressionType,
  RoutineSpec,
  ScaleSpec,
  SessionState,
} from '@motius/shared'

/** The learning store's topics, settings and shape: what `learning-store.ts` is built from. */

export const LEARNING_TOPICS = [
  'songs',
  'scales',
  'chords',
  'arpeggios',
  'progressions',
  'exercises',
  'fingering',
  // A lesson's stage: nothing to build until lessons are written, so the keys
  // are clear and the staff writes what is played. It is no area of its own.
  'lesson',
] as const
export type LearningTopic = (typeof LEARNING_TOPICS)[number]

export const LEARNING_TOPIC_LABELS: Record<LearningTopic, string> = {
  songs: 'Songs',
  scales: 'Scales',
  chords: 'Chords',
  arpeggios: 'Arpeggios',
  progressions: 'Progressions',
  exercises: 'Daily Practice',
  fingering: 'Fingering Exercises',
  lesson: 'Lesson',
}

/**
 * The areas: every topic with a builder, each at an address of its own. A
 * lesson's stage is at its lesson's address, not at one of these.
 */
export const AVAILABLE_TOPICS: readonly LearningTopic[] = LEARNING_TOPICS.filter(
  (topic) => topic !== 'lesson',
)

/** What each area is set to. One per area, so leaving one and coming back finds it as it was. */
export interface Specs {
  spec: ScaleSpec
  chordSpec: ChordSpec
  arpeggioSpec: ArpeggioSpec
  /** Progressions has a spec for each of its types; Cadences is the first. */
  cadenceSpec: CadenceSpec
  routineSpec: RoutineSpec
  fingeringSpec: FingeringDrillSpec
}
export type SpecKey = keyof Specs

/** The settings, and which of them an area with more than one set is using. */
export interface Chosen extends Specs {
  progressionType: ProgressionType
  /** What the lesson that is up plays, where it plays anything. */
  lesson: LessonExerciseId | null
}

export interface Hit {
  readonly step: number
  readonly hand?: Hand
}

export type KeyRole = 'scale' | 'root' | 'upcoming' | 'target' | 'done' | 'wrong'

export interface KeyAnnotation {
  readonly role: KeyRole
  /** Recommended finger, 1-5. Never a claim about which finger was used. */
  readonly finger?: number
  /** The hand that plays it, where the exercise says: falling notes color its key by it. */
  readonly hand?: Hand
  /** `Thumb under` — shown only on the key it applies to, while it is current. */
  readonly cue?: string
  /** The spelled note name, e.g. `E♭`. */
  readonly label?: string
  /** This note's scale degree — `1`, `♭3`. Shown when key labels are set to it. */
  readonly degree?: string
  /** Which of the scale's two four-note groups this key belongs to, if either. */
  readonly group?: 'lower' | 'upper'
}

/**
 * What the keys say on them. One at a time, on purpose.
 *
 * Note names, degrees and fingers are three answers to three different
 * questions, and printing two of them at once produces a key labelled 4 with a
 * 3 above it — two answers to a question nobody asked together.
 */
/** What is written on the keys: one list, in the contract, which lesson settings use too. */
export type { KeyLabels } from '@motius/shared'

export interface LearningState {
  topic: LearningTopic
  mode: LearningMode
  spec: ScaleSpec
  chordSpec: ChordSpec
  arpeggioSpec: ArpeggioSpec
  /** Which kind of progression the Progressions area is on. */
  progressionType: ProgressionType
  cadenceSpec: CadenceSpec
  routineSpec: RoutineSpec
  fingeringSpec: FingeringDrillSpec
  /** What the lesson that is up plays: none for a lesson not written yet. */
  lesson: LessonExerciseId | null
  exercise: Exercise | null
  session: SessionState
  annotations: Readonly<Record<number, KeyAnnotation>>
  /** Beats per minute the practice controls are set to. A target, not a metronome. */
  targetBpm: number
  /** Let a clean run raise the target and a scrappy one lower it. */
  autoTempo: boolean
  /**
   * A click at the target tempo, for as long as it is on.
   *
   * The target used to be "a target, not a metronome": a number to aim at with
   * nothing to hear it by. The click makes the number something you can play
   * against. Not tied to a run — you set the pulse, then start when ready.
   */
  metronome: boolean
  /**
   * Which step the demonstration is sounding, or null when it is not playing.
   *
   * Separate from `session.stepIndex` because the two answer different
   * questions: the session's index is how far the *player* has got and feeds
   * the score, while this is only where the playback head is. Guidance reads
   * whichever is live, so the finger that lights up during a demonstration is
   * the same finger Start would light on that note.
   */
  demoStepIndex: number | null
  /**
   * The app is playing a step's question (`ExerciseStep.prompt`). Keys pressed
   * meanwhile sound but are not an answer: the question is not over yet.
   */
  prompting: boolean
  /**
   * Rises each time the click should start again from the first beat of a bar
   * — when a demonstration begins, so the two come in together.
   */
  pulseEpoch: number
  /** Runs started, counted: a new one, even begun over a run still going. */
  runs: number
  /**
   * Whose fingering is recommended.
   *
   * Beside the spec, not in it: the spec is the music, and this is one school's
   * opinion about how to play it. Changing it re-fingers the same notes.
   */
  fingeringSystem: FingeringSystemId
  /**
   * The keys the player has: a connected keyboard's, or a 61-key instrument's.
   *
   * It only ever moves an exercise by octaves — to where the book prints it
   * when the keyboard reaches that far, and onto the keys there are when it
   * does not.
   */
  playableRange: NoteRange
  /** View settings. What is drawn on the keys, not what the keys mean. */
  keyLabels: KeyLabels
  showStructure: boolean
  /**
   * What the keyboard shows while a song is being learned.
   *
   * Held beside the scale annotations rather than replacing them, so switching
   * tabs does not throw away either one. The keyboard reads whichever belongs
   * to the topic it is on.
   */
  songAnnotations: Readonly<Record<number, KeyAnnotation>>
  /**
   * Keys pressed when they were right: which step they were part of and the
   * hand that plays them. A key is lit as a hit while it is still held (the
   * keyboard store says which are), so the falling note and its key can show
   * the player got it — each key of a chord as it goes down.
   */
  hits: Readonly<Record<number, Hit>>

  /** Fetches what the exercise as set needs to be built, if it has not loaded yet. */
  ready: () => void
  setTopic: (topic: LearningTopic) => void
  /** Puts a lesson's exercise up, or none. A new lesson ends the run. */
  setLesson: (lesson: LessonExerciseId | null) => void
  setMode: (mode: LearningMode) => void
  updateSpec: (patch: Partial<ScaleSpec>) => void
  updateChordSpec: (patch: Partial<ChordSpec>) => void
  updateArpeggioSpec: (patch: Partial<ArpeggioSpec>) => void
  setProgressionType: (type: ProgressionType) => void
  updateCadenceSpec: (patch: Partial<CadenceSpec>) => void
  updateRoutineSpec: (patch: Partial<RoutineSpec>) => void
  updateFingeringSpec: (patch: Partial<FingeringDrillSpec>) => void
  start: () => void
  reset: () => void
  setDemoStep: (index: number | null) => void
  setPrompting: (prompting: boolean) => void
  setFingeringSystem: (system: FingeringSystemId) => void
  /** Null for no keyboard connected, which is the default range. */
  setPlayableRange: (range: NoteRange | null) => void
  setSongAnnotations: (annotations: Record<number, KeyAnnotation>) => void
  setKeyLabels: (labels: KeyLabels) => void
  setShowStructure: (show: boolean) => void
  setTargetBpm: (bpm: number) => void
  setAutoTempo: (enabled: boolean) => void
  setMetronome: (enabled: boolean) => void
  noteOn: (note: number) => void
  /** The step being waited on went by unplayed: the run moves on without it. */
  missStep: () => void
  /** Go to a step, the score starting again from there: the music was moved. */
  seekStep: (step: number) => void
  expireWrongNotes: () => void
}
