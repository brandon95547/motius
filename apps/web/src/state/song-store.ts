import { create } from 'zustand'
import {
  gridMeasures,
  PRACTICE_START,
  type Hand,
  type Song,
  type SongPracticeState,
} from '@motius/shared'

/**
 * The songs a player has imported, the built-in ones they have opened, and how
 * they are practising the one that is open.
 *
 * The library persists; the playback settings do not survive a reload on
 * purpose. A tempo of 50% is something you set up to work on a passage for ten
 * minutes, not a preference — coming back tomorrow to a song that silently
 * plays at half speed is a bug report, not a feature.
 */

export type SongPart = 'both' | Hand

/**
 * How the song is being worked on.
 *
 * Listen plays it to you; Learn waits for you; Practice plays on at the tempo
 * and judges what you play. The same three words an exercise uses, meaning the
 * same three things, because a player who has learned what they mean there
 * should not have to learn them again.
 */
export type SongMode = 'listen' | 'learn' | 'practice'

/**
 * How the score is laid out.
 *
 * `flow` runs one endless system past a fixed playhead — Motius's guided
 * reading, where the music moves and your place in it does not. `sheet` prints
 * it as lines and stacks them, holding still while you read across, which is
 * what someone who can already read needs and what a learner does not.
 */
export type StaffView = 'sheet' | 'flow'

interface SongState {
  library: Song[]
  /**
   * The built-in songs opened this session.
   *
   * In memory only. They come with the app, so storing one would be keeping a
   * second copy of something a reload fetches again, in a store with room for
   * a handful of songs that is there for the ones the player brought.
   */
  builtIn: Song[]
  currentId: string | null
  playing: boolean
  /** Where the playhead is, in song milliseconds. */
  positionMs: number
  part: SongPart
  /** 0.5, 0.75, 1 — or anything the custom field is set to. */
  tempoScale: number
  metronome: boolean
  mode: SongMode
  /** Which way the score is written out. */
  staffView: StaffView
  /**
   * How much fingering the staff prints.
   *
   * A derived fingering knows a number for every note, and how many of them a
   * reader wants is a fact about the reader, not about the music: sight-reading
   * wants almost none, learning a passage wants all of it. Guessing it from the
   * notes means guessing at the person, so it is asked rather than inferred.
   */
  fingering: FingeringDensity
  /** Which step of the song the player is on, in Learn. */
  stepIndex: number
  /** Practice's run: the step asked for, and how each step went. */
  practice: SongPracticeState
  /** A Practice run has reached the end of the song: there is a result to show. */
  practiced: boolean
  /** True once Start has been pressed, until the song is finished or reset. */
  learning: boolean
  /** How many steps the song's keyboard part has, for the progress bar. */
  stepCount: number
  /**
   * Notes pressed that the step did not ask for, so the keyboard can say so.
   *
   * Scales have always shown a wrong note in red and songs have not, which
   * made the same mode behave two ways depending on which tab you were in.
   */
  wrongNotes: readonly number[]

  add: (song: Song) => void
  open: (id: string) => void
  /** Opens a built-in song, keeping it for the rest of the session. */
  openBuiltIn: (song: Song) => void
  /**
   * Puts a song back in place of the one with its id — the same song, fingered
   * again. Nothing about where the player is in it changes.
   */
  replace: (song: Song) => void
  remove: (id: string) => void
  setPlaying: (playing: boolean) => void
  seek: (positionMs: number) => void
  /**
   * Where the playback has got to, as it goes. Unlike `seek`, it may be before
   * the start: Practice begins with a lead-in.
   */
  setPlayhead: (positionMs: number) => void
  /** The playback has reached the end of the song. */
  end: () => void
  /** Begin a Practice run, this long before the first note. */
  startPractice: (leadInMs: number) => void
  setPractice: (practice: SongPracticeState) => void
  setPart: (part: SongPart) => void
  setTempoScale: (scale: number) => void
  setMetronome: (on: boolean) => void
  setMode: (mode: SongMode) => void
  setStaffView: (view: StaffView) => void
  setFingering: (density: FingeringDensity) => void
  startLearning: () => void
  resetLearning: () => void
  advance: (steps: number) => void
  setStepCount: (count: number) => void
  setWrongNotes: (notes: readonly number[]) => void
}

const STORAGE_KEY = 'motius.songs.v1'
/**
 * Kept, unlike the playback settings.
 *
 * A tempo is something you set up to work on a passage for ten minutes;
 * coming back to it tomorrow is a bug report. Whether you read from sheet music
 * or from a moving staff is not a setting on a passage — it is a fact about the
 * person reading, and asking them again every session would be asking them
 * whether they can still read music.
 */
const VIEW_KEY = 'motius.staff-view.v1'

/** Nothing in progress. */
const IDLE = { stepIndex: 0, learning: false, practice: PRACTICE_START, practiced: false } as const

/** The slowest and fastest a song goes, as a share of the tempo it is written at. */
export const SONG_SPEED = { min: 0.25, max: 2 } as const

/** Never carried on further than this past the playhead's last tick, should ticks stop. */
export const MAX_CARRY_MS = 250

/**
 * The speed a song opens at, as a share of the tempo it is written at: all of
 * it.
 *
 * Set afresh for each song rather than carried from the last one. A share that
 * was right for a presto is far too slow for an adagio.
 */
const OPENING_SCALE = 1

/**
 * Brings a stored song up to the current shape.
 *
 * The library outlives the code that wrote it. A song imported before parts
 * and roles existed has neither, and the difference is not cosmetic: a note
 * with no role is neither the part being learned nor percussion, so it would
 * sound while lighting no keys at all — a song that plays and a keyboard that
 * never moves, with nothing on screen to say why.
 *
 * Everything in those files came from the piano path, so that is what they are
 * read as.
 */
function migrate(song: Song): Song {
  const known = (song.notes?.length ?? 0) > 0 && song.notes.every((note) => Boolean(note.role))
  const notes = song.notes?.map((note) =>
    note.role ? note : { ...note, role: 'keyboard' as const },
  )
  const timeSignature = song.timeSignature ?? {
    beats: Math.round(song.beatsPerMeasure) || 4,
    beatType: 4,
  }
  // A song stored before bars were read has one tempo and one metre to go
  // on, which is what it had before as well: the grid is the old behaviour,
  // kept for old songs. Importing the file again reads the real bars.
  const measures =
    song.measures && song.measures.length > 0
      ? song.measures
      : gridMeasures({
          bpm: song.bpm,
          beats: timeSignature.beats,
          beatType: timeSignature.beatType,
          durationMs: song.durationMs,
        })
  return {
    ...song,
    notes: notes ?? [],
    timeSignature,
    measures,
    measureCount: measures.length,
    chords: song.chords ?? [],
    parts: song.parts ?? ['Piano'],
    // Reading a drum track as piano is not a small inaccuracy — a kick and a
    // snare become two low notes on the keys. Nothing in a stored note says
    // which channel it came from, so it cannot be recovered here. It is
    // flagged instead, and the library says to import the file again.
    partsKnown: song.partsKnown ?? known,
  }
}

function load(): Song[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    // A song missing the fields everything downstream indexes into is dropped
    // rather than migrated into something half-real.
    return (parsed as Song[])
      .filter((song) => song && typeof song.id === 'string' && Array.isArray(song.notes))
      .map(migrate)
  } catch {
    // A corrupt or unavailable store is an empty library, not a broken app.
    return []
  }
}

function save(library: readonly Song[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(library))
  } catch {
    // Private browsing, or a library past the quota. The songs stay in memory
    // for this session, which is better than refusing the import.
  }
}

/**
 * `all` prints every finger. `hints` prints the ones a reader could not work
 * out — the start of a run, a change of grip, a leap. `off` prints none.
 *
 * `hints` thins a scale from eight numbers to two and a rag from a thousand to
 * eight hundred, which is worth knowing: on music that changes its grip every
 * beat the honest answer is that there is nothing to thin, and `off` is what
 * makes that page readable.
 */
export type FingeringDensity = 'all' | 'hints' | 'off'

const FINGERING_KEY = 'motius.songs.fingering'

function loadFingering(): FingeringDensity {
  try {
    const stored = window.localStorage.getItem(FINGERING_KEY)
    return stored === 'all' || stored === 'off' ? stored : 'hints'
  } catch {
    return 'hints'
  }
}

function loadView(): StaffView {
  try {
    return window.localStorage.getItem(VIEW_KEY) === 'sheet' ? 'sheet' : 'flow'
  } catch {
    return 'flow'
  }
}

export const useSongStore = create<SongState>((set) => ({
  library: typeof window === 'undefined' ? [] : load(),
  builtIn: [],
  currentId: null,
  playing: false,
  positionMs: 0,
  part: 'both',
  tempoScale: 1,
  metronome: false,
  mode: 'listen',
  staffView: typeof window === 'undefined' ? 'flow' : loadView(),
  fingering: typeof window === 'undefined' ? 'hints' : loadFingering(),
  stepIndex: 0,
  learning: false,
  practice: PRACTICE_START,
  practiced: false,
  stepCount: 0,
  wrongNotes: [],

  add: (song) =>
    set((state) => {
      const library = [song, ...state.library]
      save(library)
      // A freshly imported song is the one you want open.
      return {
        library,
        currentId: song.id,
        positionMs: 0,
        playing: false,
        tempoScale: OPENING_SCALE,
        ...IDLE,
      }
    }),

  open: (currentId) =>
    set({ currentId, positionMs: 0, playing: false, tempoScale: OPENING_SCALE, ...IDLE }),

  openBuiltIn: (song) =>
    set((state) => ({
      builtIn: state.builtIn.some((held) => held.id === song.id)
        ? state.builtIn
        : [...state.builtIn, song],
      currentId: song.id,
      positionMs: 0,
      playing: false,
      tempoScale: OPENING_SCALE,
      ...IDLE,
    })),

  replace: (song) =>
    set((state) => {
      if (state.library.some((held) => held.id === song.id)) {
        const library = state.library.map((held) => (held.id === song.id ? song : held))
        save(library)
        return { library }
      }
      return { builtIn: state.builtIn.map((held) => (held.id === song.id ? song : held)) }
    }),

  remove: (id) =>
    set((state) => {
      const library = state.library.filter((song) => song.id !== id)
      save(library)
      return {
        library,
        ...(state.currentId === id ? { currentId: null, playing: false, positionMs: 0 } : {}),
      }
    }),

  setPlaying: (playing) => set({ playing }),
  seek: (positionMs) => set({ positionMs: Math.max(0, positionMs) }),
  setPlayhead: (positionMs) => set({ positionMs }),
  end: () =>
    set((state) => ({ playing: false, positionMs: 0, practiced: state.mode === 'practice' })),
  startPractice: (leadInMs) => set({ ...IDLE, positionMs: -leadInMs, playing: true }),
  setPractice: (practice) => set({ practice }),
  setPart: (part) => set({ part }),
  setTempoScale: (tempoScale) =>
    set({ tempoScale: Math.min(SONG_SPEED.max, Math.max(SONG_SPEED.min, tempoScale)) }),
  setMetronome: (metronome) => set({ metronome }),

  // Switching how you are working on the piece stops whatever the other way
  // was doing: playback should not carry on under a Start button.
  setMode: (mode) => set({ mode, playing: false, ...IDLE }),

  // Only how the same score is drawn, so nothing else moves: not the position,
  // not the tempo, not what has been learned. Switching views mid-piece has to
  // be free, or nobody will try the other one.
  setFingering: (fingering) =>
    set(() => {
      try {
        window.localStorage.setItem(FINGERING_KEY, fingering)
      } catch {
        // Private browsing. The choice holds for this session.
      }
      return { fingering }
    }),

  setStaffView: (staffView) =>
    set(() => {
      try {
        window.localStorage.setItem(VIEW_KEY, staffView)
      } catch {
        // Private browsing. The choice holds for this session.
      }
      return { staffView }
    }),

  startLearning: () => set({ learning: true, stepIndex: 0, playing: false }),
  resetLearning: () => set({ ...IDLE }),
  advance: (steps) => set((state) => ({ stepIndex: Math.max(0, state.stepIndex + steps) })),
  setStepCount: (stepCount) => set({ stepCount }),
  setWrongNotes: (wrongNotes) =>
    set((state) =>
      // Same notes, same array — this runs on every key event, and a fresh
      // array each time would re-render the whole keybed for nothing.
      state.wrongNotes.length === wrongNotes.length &&
      state.wrongNotes.every((note, i) => note === wrongNotes[i])
        ? state
        : { wrongNotes },
    ),
}))

/** The open song, or null: one the player imported, or one that came with the app. */
export function useCurrentSong(): Song | null {
  return useSongStore(
    (state) =>
      state.library.find((song) => song.id === state.currentId) ??
      state.builtIn.find((song) => song.id === state.currentId) ??
      null,
  )
}
