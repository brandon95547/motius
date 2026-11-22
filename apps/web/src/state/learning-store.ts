import { create } from 'zustand'
import {
  DEFAULT_ARPEGGIO_SPEC,
  DEFAULT_CHORD_SPEC,
  DEFAULT_CADENCE_SPEC,
  DEFAULT_FINGERING_DRILL_SPEC,
  DEFAULT_PROGRESSION_TYPE,
  DEFAULT_ROUTINE_SPEC,
  DEFAULT_PLAYABLE_RANGE,
  DEFAULT_PRACTICE_BPM,
  DEFAULT_SCALE_SPEC,
  IDLE_SESSION,
  sessionReducer,
  WRONG_NOTE_FLASH_MS,
  type FingeringSystemId,
  type LearningMode,
  type NoteRange,
  type SessionEvent,
  type SessionState,
} from '@motius/shared'
import { loadChunk } from '@/lib/load-chunk'
import { buildAnnotations } from './learning-annotations'
import {
  buildExercise,
  clampBpm,
  FINGERING_SYSTEM_KEY,
  loadFingeringSystem,
  loadFor,
  nextTargetBpm,
} from './learning-exercise'
import type { Chosen, Hit, LearningState, LearningTopic, SpecKey, Specs } from './learning-types'

export {
  AVAILABLE_TOPICS,
  LEARNING_TOPIC_LABELS,
  LEARNING_TOPICS,
  type Hit,
  type KeyAnnotation,
  type KeyLabels,
  type KeyRole,
  type LearningTopic,
} from './learning-types'

/**
 * The learning session, and the keyboard annotations that come out of it.
 *
 * The engine itself lives in `@motius/shared` as a pure reducer; this store is
 * the thin React-facing shell around it. Everything derived — which keys light
 * up, in what role, with which finger — is computed here, once per change, into
 * a plain map keyed by MIDI note.
 *
 * That map is the whole interface between the learning system and the keyboard.
 * A key subscribes to `annotations[note]` and re-renders only when its own
 * entry changes, so a 61-key keyboard costs one re-render per note event rather
 * than sixty-one. It is also why the keyboard knows nothing about scales: when
 * chords and progressions arrive they produce the same map.
 */

const initialFingeringSystem = loadFingeringSystem()
const INITIAL_SPECS = {
  spec: DEFAULT_SCALE_SPEC,
  chordSpec: DEFAULT_CHORD_SPEC,
  arpeggioSpec: DEFAULT_ARPEGGIO_SPEC,
  progressionType: DEFAULT_PROGRESSION_TYPE,
  cadenceSpec: DEFAULT_CADENCE_SPEC,
  routineSpec: DEFAULT_ROUTINE_SPEC,
  fingeringSpec: DEFAULT_FINGERING_DRILL_SPEC,
  lesson: null,
} as const
// Null until Scales' builder has loaded, which the workspace asks for when it
// opens (`ready`); where it already has (in the tests), the scale at once.
const initialExercise = buildExercise(
  'scales',
  INITIAL_SPECS,
  initialFingeringSystem,
  DEFAULT_PLAYABLE_RANGE,
)

export const useLearningStore = create<LearningState>((set, get) => {
  /** An event for the run, kept and drawn if it changed anything. */
  const dispatch = (event: SessionEvent) => {
    const state = get()
    const session = sessionReducer(state.session, event, state.exercise)
    if (session === state.session) return
    set({
      session,
      annotations: buildAnnotations(state.exercise, state.mode, session, state.demoStepIndex),
    })
  }

  const rebuild = (
    topic: LearningTopic,
    specs: Chosen,
    mode: LearningMode,
    session: SessionState,
    fingering: FingeringSystemId = get().fingeringSystem,
    range: NoteRange = get().playableRange,
  ) => {
    const exercise = buildExercise(topic, specs, fingering, range)
    // Any rebuild is a new exercise or a new mode, and the demonstration does
    // not survive either — so the playback head resets with it.
    // A new scale is a new question; whatever was drawn on the keys was about
    // the old one.
    return {
      exercise,
      session,
      hits: {},
      demoStepIndex: null,
      annotations: buildAnnotations(exercise, mode, session),
    }
  }

  /**
   * Fetches what the exercise as set needs, if it is not here yet — its area's
   * builder, or its lesson's section — then puts it on the keys, if it is still
   * the one asked for. Content and code alike, a part at a time, when first used.
   */
  const fetchExercise = () => {
    const asked = get()
    const pending = loadFor(asked.topic, asked)
    if (!pending) return
    void loadChunk(() => pending).then(() => {
      const state = get()
      if (
        state.topic === asked.topic &&
        state.lesson === asked.lesson &&
        state.progressionType === asked.progressionType
      )
        set(rebuild(state.topic, state, state.mode, IDLE_SESSION))
    })
  }

  /** Changes one area's settings and rebuilds what is on the keys from them. */
  const respec = <K extends SpecKey>(key: K, patch: Partial<Specs[K]>) =>
    set((state) => {
      const next = { ...state[key], ...patch } as Specs[K] & { tonic?: string }
      const change = patch as { rootPitchClass?: number }
      // A key's other name belongs to that key. Carried to a new one it
      // would lie dormant — C has no E♭ — and then come back unasked the
      // next time the player returned to where they had chosen it.
      if (
        change.rootPitchClass !== undefined &&
        change.rootPitchClass !== state[key].rootPitchClass &&
        !('tonic' in patch)
      ) {
        delete next.tonic
      }
      // A new scale is a new run: the score does not carry across. But a run
      // that was going keeps going, on the new scale from its first note.
      // Dropping to idle instead looked the same from the keys — the scale is
      // still lit — so a player who turned the direction round mid-run and
      // played on had every note ignored, and finished with nothing counted.
      const session =
        state.session.status === 'running'
          ? sessionReducer(IDLE_SESSION, { type: 'start', at: Date.now() }, null)
          : IDLE_SESSION
      const specs = {
        spec: state.spec,
        chordSpec: state.chordSpec,
        arpeggioSpec: state.arpeggioSpec,
        cadenceSpec: state.cadenceSpec,
        routineSpec: state.routineSpec,
        fingeringSpec: state.fingeringSpec,
        [key]: next,
      } as Specs
      const chosen = { ...specs, progressionType: state.progressionType, lesson: state.lesson }
      return { ...specs, ...rebuild(state.topic, chosen, state.mode, session) }
    })

  return {
    topic: 'scales',
    mode: 'learn',
    ...INITIAL_SPECS,
    exercise: initialExercise,
    session: IDLE_SESSION,
    annotations: buildAnnotations(initialExercise, 'learn', IDLE_SESSION),
    targetBpm: initialExercise?.defaultBpm ?? DEFAULT_PRACTICE_BPM,
    autoTempo: false,
    metronome: false,
    demoStepIndex: null,
    pulseEpoch: 0,
    fingeringSystem: initialFingeringSystem,
    playableRange: DEFAULT_PLAYABLE_RANGE,
    keyLabels: 'notes',
    showStructure: false,
    songAnnotations: {},
    hits: {},

    ready: fetchExercise,

    setTopic: (topic) => {
      set((state) => ({ topic, ...rebuild(topic, state, state.mode, IDLE_SESSION) }))
      fetchExercise()
    },

    setLesson: (lesson) => {
      set((state) =>
        state.lesson === lesson
          ? state
          : { lesson, ...rebuild(state.topic, { ...state, lesson }, state.mode, IDLE_SESSION) },
      )
      fetchExercise()
    },

    setMode: (mode) =>
      // Changing mode ends the run. Half a scale learned with the answers on
      // screen is not half a scale practised, and merging the two scores would
      // say it was.
      set((state) => ({ mode, ...rebuild(state.topic, state, mode, IDLE_SESSION) })),

    updateSpec: (patch) => respec('spec', patch),
    updateChordSpec: (patch) => respec('chordSpec', patch),
    updateArpeggioSpec: (patch) => respec('arpeggioSpec', patch),
    setProgressionType: (progressionType) => {
      // A different kind of progression is a different exercise, so the run
      // ends as it does on leaving for another area. Each type keeps its own
      // settings, and comes back as it was left.
      set((state) =>
        state.progressionType === progressionType
          ? state
          : {
              progressionType,
              ...rebuild(state.topic, { ...state, progressionType }, state.mode, IDLE_SESSION),
            },
      )
      fetchExercise()
    },
    updateCadenceSpec: (patch) => respec('cadenceSpec', patch),
    updateRoutineSpec: (patch) => respec('routineSpec', patch),
    updateFingeringSpec: (patch) => respec('fingeringSpec', patch),

    start: () =>
      set((state) => {
        const session = sessionReducer(
          state.session,
          { type: 'start', at: Date.now() },
          state.exercise,
        )
        return {
          session,
          hits: {},
          // Starting a run ends the demonstration: one head at a time, and from
          // here the position that matters is the player's.
          demoStepIndex: null,
          annotations: buildAnnotations(state.exercise, state.mode, session, null),
        }
      }),

    reset: () =>
      set((state) => ({
        session: IDLE_SESSION,
        hits: {},
        demoStepIndex: null,
        annotations: buildAnnotations(state.exercise, state.mode, IDLE_SESSION, null),
      })),

    setDemoStep: (index) =>
      set((state) => ({
        demoStepIndex: index,
        annotations: buildAnnotations(state.exercise, state.mode, state.session, index),
      })),

    setFingeringSystem: (fingeringSystem) =>
      set((state) => {
        try {
          window.localStorage.setItem(FINGERING_SYSTEM_KEY, fingeringSystem)
        } catch {
          // Private browsing. The choice holds for this session.
        }
        // The same notes, re-fingered. The run carries on from where it is:
        // nothing about what has been played is any less true.
        const exercise = buildExercise(state.topic, state, fingeringSystem, state.playableRange)
        return {
          fingeringSystem,
          exercise,
          annotations: buildAnnotations(exercise, state.mode, state.session, state.demoStepIndex),
        }
      }),

    setPlayableRange: (range) =>
      set((state) => {
        const playableRange = range ?? DEFAULT_PLAYABLE_RANGE
        const current = state.playableRange
        if (playableRange.low === current.low && playableRange.high === current.high) return {}
        const exercise = buildExercise(state.topic, state, state.fingeringSystem, playableRange)
        // Most exercises sit where they sat. One that has moved to another
        // octave is a different set of keys, and a run on the old ones is over.
        if (exercise?.id === state.exercise?.id) return { playableRange }
        return {
          playableRange,
          ...rebuild(state.topic, state, state.mode, IDLE_SESSION, undefined, playableRange),
        }
      }),

    setSongAnnotations: (songAnnotations) => set({ songAnnotations }),

    setKeyLabels: (keyLabels) => set({ keyLabels }),

    setShowStructure: (showStructure) => set({ showStructure }),

    setTargetBpm: (bpm) => set({ targetBpm: clampBpm(bpm) }),

    setAutoTempo: (autoTempo) => set({ autoTempo }),
    setMetronome: (metronome) => set({ metronome }),

    noteOn: (note) => {
      const state = get()
      if (state.session.status !== 'running') return
      const step = state.exercise?.steps[state.session.stepIndex]
      const index = step?.notes.indexOf(note) ?? -1
      // Right, it is marked with its step and hand; wrong, any mark the key had
      // from an earlier press goes, so a held wrong note never shows as right.
      let hits = state.hits
      if (index >= 0)
        hits = {
          ...hits,
          [note]: { step: state.session.stepIndex, hand: step!.fingers[index]?.hand },
        }
      else if (hits[note]) {
        hits = { ...hits }
        delete (hits as Record<number, Hit>)[note]
      }
      const session = sessionReducer(
        state.session,
        { type: 'noteOn', note, at: Date.now() },
        state.exercise,
      )
      if (session === state.session && hits === state.hits) return

      set({
        session,
        hits,
        annotations: buildAnnotations(state.exercise, state.mode, session, state.demoStepIndex),
        // Auto tempo moves the target only at the end of a run, and only on
        // evidence: a clean pass at or above the current target earns a nudge
        // up, a scrappy one earns a nudge down, and anything in between leaves
        // it alone. Adjusting mid-scale would chase the player's own hesitation.
        ...(session.status === 'complete' && state.autoTempo
          ? { targetBpm: nextTargetBpm(state.targetBpm, session, state.exercise) }
          : {}),
      })
    },

    seekStep: (step) => {
      const state = get()
      const session = sessionReducer(
        state.session,
        { type: 'seek', step, at: Date.now() },
        state.exercise,
      )
      if (session === state.session) return
      set({
        session,
        hits: {},
        annotations: buildAnnotations(state.exercise, state.mode, session, state.demoStepIndex),
      })
    },

    missStep: () => dispatch({ type: 'miss', at: Date.now() }),

    expireWrongNotes: () => {
      const state = get()
      if (Object.keys(state.session.wrongNotes).length === 0) return
      const session = sessionReducer(
        state.session,
        { type: 'expireWrong', before: Date.now() - WRONG_NOTE_FLASH_MS },
        state.exercise,
      )
      if (session === state.session) return
      set({
        session,
        annotations: buildAnnotations(state.exercise, state.mode, session, state.demoStepIndex),
      })
    },
  }
})

/** For hot paths and event handlers — no subscription, no re-render. */
export const learningActions = {
  noteOn: (note: number) => useLearningStore.getState().noteOn(note),
  setDemoStep: (index: number | null) => useLearningStore.getState().setDemoStep(index),
  syncPulse: () => useLearningStore.setState((state) => ({ pulseEpoch: state.pulseEpoch + 1 })),
}
