import { Pause, Play, RotateCcw, Square, type LucideIcon } from 'lucide-react'
import {
  LEARNING_MODE_DESCRIPTIONS,
  LEARNING_MODE_LABELS,
  LEARNING_MODES,
  leadInMs,
  LESSON_BPM,
} from '@motius/shared'
import { BarButton } from '@/ui/BarButton'
import { Field } from '@/ui/Controls'
import { BarTabs } from '@/ui/BarTabs'
import { MetronomeIcon } from '@/ui/MetronomeIcon'
import { TempoField } from '@/ui/TempoField'
import { EXERCISE_NOUNS, MODE_ICONS } from '@/features/learning/ScaleControls'
import { useScaleDemo } from '@/features/learning/use-scale-demo'
import { LastTakeButton, RecordButton } from '@/features/recording/RecordControls'
import { MidiButton } from './MidiButton'
import { useFallingStore } from '@/state/falling-store'
import { useLearningStore } from '@/state/learning-store'
import { SONG_SPEED, useCurrentSong, useSongStore, type SongMode } from '@/state/song-store'
import { useViewStore } from '@/state/view-store'
import { useSpaceToPlay } from './use-space-to-play'
import { remindThenRun } from '@/state/hands-reminder'

/**
 * The bar's playing controls: one set, the same on every screen where music is
 * played — a practice area, a lesson, a song — in the same order, so the hand
 * that finds Play in Scales finds it in the same place in a song.
 *
 * Mode · tempo · metronome · Record · Play.
 *
 * One Play button, and the mode says what it plays, as falling-notes apps do:
 * - **Listen**: the music is played to you — an exercise's demonstration, or
 *   the song.
 * - **Learn**: a run that waits at each step until you play it.
 * - **Practice**: a run that goes on at the tempo and judges each step.
 *
 * Once something is going, Play is Pause / Go on, with the way back to the
 * start beside it; a run that cannot pause (a Learn run over the staff, which
 * waits anyway) is stopped instead. Space presses Play (`useSpaceToPlay`).
 *
 * What each control does comes from what is open (`useExercisePlay`,
 * `useSongPlay`); how it looks is this component's, once. A control that has
 * nothing to do right now stays where it is and says why, so nothing on the
 * bar moves from one screen to the next.
 */

interface Mode {
  readonly value: string
  readonly label: string
  readonly description: string
  readonly icon: LucideIcon
}

type PlayState =
  | {
      readonly kind: 'play'
      /** Its name: Play in Listen, Start for a run. */
      readonly label: string
      /** Why there is nothing to play, where there is not. */
      readonly unavailable?: string
      readonly onPlay: () => void
    }
  | { readonly kind: 'stop'; readonly onStop: () => void }
  | {
      readonly kind: 'pause'
      readonly paused: boolean
      readonly onToggle: () => void
      readonly onRestart: () => void
    }

export interface PlaySource {
  readonly modes: readonly Mode[]
  readonly mode: string
  readonly setMode: (mode: string) => void
  readonly tempo: {
    readonly value: number
    readonly min: number
    readonly max: number
    readonly step?: number
    readonly detail?: string
    readonly onChange: (bpm: number) => void
  } | null
  readonly metronome: {
    readonly on: boolean
    readonly bpm: number | null
    readonly disabled?: boolean
    readonly toggle: () => void
  }
  readonly play: PlayState
}

type TempoSource = Pick<PlaySource, 'tempo' | 'metronome'>

/** An exercise's tempo and click. */
function useExerciseTempo(): TempoSource {
  const bpm = useLearningStore((state) => state.targetBpm)
  const setTargetBpm = useLearningStore((state) => state.setTargetBpm)
  const on = useLearningStore((state) => state.metronome)
  const setMetronome = useLearningStore((state) => state.setMetronome)
  // A divided beat is part of how fast the scale goes, so the tooltip says it.
  const divided = useLearningStore((state) =>
    state.topic === 'scales' && (state.spec.notesPerBeat ?? 1) > 1
      ? `${state.spec.notesPerBeat} notes a beat`
      : undefined,
  )
  return {
    tempo: {
      value: bpm,
      min: LESSON_BPM.min,
      max: LESSON_BPM.max,
      detail: divided,
      onChange: setTargetBpm,
    },
    metronome: { on, bpm, toggle: () => setMetronome(!on) },
  }
}

/** A song's tempo and click. */
function useSongTempo(): TempoSource {
  const song = useCurrentSong()
  const tempoScale = useSongStore((state) => state.tempoScale)
  const setTempoScale = useSongStore((state) => state.setTempoScale)
  const on = useSongStore((state) => state.metronome)
  const setMetronome = useSongStore((state) => state.setMetronome)
  const bpm = song ? Math.round(song.bpm * tempoScale) : null
  return {
    // The song keeps its speed as a share of its written tempo, so a piece that
    // changes tempo slows everywhere alike; the player thinks in beats a minute.
    tempo: song
      ? {
          value: bpm!,
          min: Math.ceil(song.bpm * SONG_SPEED.min),
          max: Math.floor(song.bpm * SONG_SPEED.max),
          // An arrow is a twentieth of the song's tempo: a step that can be heard.
          step: Math.max(1, Math.round(song.bpm * 0.05)),
          detail: `${Math.round(tempoScale * 100)}% of the song's tempo`,
          onChange: (value) => setTempoScale(value / song.bpm),
        }
      : null,
    // The click follows the song's own pulse: there is none without a song.
    metronome: { on, bpm, disabled: !song, toggle: () => setMetronome(!on) },
  }
}

/** Whichever is open's tempo and click. */
function useTempoSource(): TempoSource {
  const songs = useLearningStore((state) => state.topic === 'songs')
  // Both asked every time, in the same order, as hooks must be.
  const exercise = useExerciseTempo()
  const song = useSongTempo()
  return songs ? song : exercise
}

const EXERCISE_MODES: readonly Mode[] = LEARNING_MODES.map((mode) => ({
  value: mode,
  label: LEARNING_MODE_LABELS[mode],
  description: LEARNING_MODE_DESCRIPTIONS[mode],
  icon: MODE_ICONS[mode],
}))

/** A song's modes are an exercise's, each meaning the same, said of a song. */
const SONG_MODE_DESCRIPTIONS: Record<SongMode, string> = {
  listen: 'The song is played to you. Press Play.',
  learn: 'The keys light and wait for you to play them.',
  practice: 'The song plays on at the tempo, and each step you play is judged.',
}
const SONG_MODES: readonly Mode[] = EXERCISE_MODES.map((mode) => ({
  ...mode,
  description: SONG_MODE_DESCRIPTIONS[mode.value as SongMode],
}))

/**
 * A lesson's: its walk through, a step at a time, is the lesson itself, and is
 * called so. The same mode as Learn everywhere else, under the lesson's name.
 */
const LESSON_MODES: readonly Mode[] = EXERCISE_MODES.map((mode) =>
  mode.value === 'learn'
    ? {
        ...mode,
        label: 'Lesson',
        description: 'The lesson, a step at a time, waiting for you to play each one.',
      }
    : mode,
)

/** An exercise, a practice area's or a lesson's. */
function useExercisePlay(): Omit<PlaySource, keyof TempoSource> {
  const lesson = useLearningStore((state) => state.topic === 'lesson')
  const mode = useLearningStore((state) => state.mode)
  const setMode = useLearningStore((state) => state.setMode)
  const running = useLearningStore((state) => state.session.status === 'running')
  const hasExercise = useLearningStore((state) => state.exercise !== null)
  const what = useLearningStore((state) => EXERCISE_NOUNS[state.exercise?.kind ?? 'scale'])
  const start = useLearningStore((state) => state.start)
  const reset = useLearningStore((state) => state.reset)
  // The demonstration lives in this hook, and so in the bar alone: one of it.
  const demo = useScaleDemo()
  const fallingView = useViewStore((state) => state.stageView === 'falling')
  const paused = useFallingStore((state) => state.paused)
  const setPaused = useFallingStore((state) => state.setPaused)

  const restartDemo = () => {
    demo.stop()
    demo.toggle()
  }
  return {
    modes: lesson ? LESSON_MODES : EXERCISE_MODES,
    mode,
    setMode: (next) => setMode(next as typeof mode),
    play:
      mode === 'listen'
        ? demo.status === 'idle'
          ? {
              kind: 'play',
              label: `Play the ${what}`,
              unavailable: demo.available ? undefined : 'Choose something to play first',
              onPlay: demo.toggle,
            }
          : {
              kind: 'pause',
              paused: demo.status === 'paused',
              onToggle: demo.toggle,
              onRestart: restartDemo,
            }
        : running && fallingView && hasExercise
          ? // Back to the start plays it again from the top at once, as Try again does.
            { kind: 'pause', paused, onToggle: () => setPaused(!paused), onRestart: start }
          : running
            ? { kind: 'stop', onStop: reset }
            : { kind: 'play', label: 'Start', onPlay: start },
  }
}

/**
 * A song. Never its playhead, which moves forty times a second: only whether
 * it has left the start, which changes twice a run.
 */
function useSongPlay(): Omit<PlaySource, keyof TempoSource> {
  const song = useCurrentSong()
  const mode = useSongStore((state) => state.mode)
  const setMode = useSongStore((state) => state.setMode)
  const playing = useSongStore((state) => state.playing)
  const setPlaying = useSongStore((state) => state.setPlaying)
  const begun = useSongStore((state) => state.positionMs !== 0)
  const seek = useSongStore((state) => state.seek)
  const learning = useSongStore((state) => state.learning)
  const startLearning = useSongStore((state) => state.startLearning)
  const resetLearning = useSongStore((state) => state.resetLearning)
  const startPractice = useSongStore((state) => state.startPractice)
  const practise = () => song && startPractice(leadInMs(song))

  const play: PlayState = !song
    ? { kind: 'play', label: 'Play', unavailable: 'Open a song first', onPlay: () => {} }
    : mode === 'learn'
      ? learning
        ? { kind: 'stop', onStop: resetLearning }
        : { kind: 'play', label: 'Start', onPlay: startLearning }
      : playing || begun
        ? {
            kind: 'pause',
            paused: !playing,
            onToggle: () => setPlaying(!playing),
            onRestart: mode === 'practice' ? practise : () => seek(0),
          }
        : mode === 'practice'
          ? { kind: 'play', label: 'Start', onPlay: practise }
          : { kind: 'play', label: 'Play the song', onPlay: () => setPlaying(true) }
  return { modes: SONG_MODES, mode, setMode: (next) => setMode(next as SongMode), play }
}

/** Whichever is open: a song, or an exercise. */
function usePlaySource(): PlaySource {
  const songs = useLearningStore((state) => state.topic === 'songs')
  const exercise = useExercisePlay()
  const song = useSongPlay()
  const tempo = useTempoSource()
  const source = songs ? song : exercise
  // Starting the music first reminds which hand is which, where the notes fall
  // in the hands' colors and the player still wants it (`hands-reminder.ts`).
  const given = source.play
  const play: PlayState =
    given.kind === 'play' ? { ...given, onPlay: () => remindThenRun(given.onPlay) } : given
  return { ...source, play, ...tempo }
}

/** What Space does: what Play does, unless that is nothing, or ending a run. */
const spaceAction = (play: PlayState) =>
  play.kind === 'pause'
    ? play.onToggle
    : play.kind === 'play' && play.unavailable === undefined
      ? play.onPlay
      : null

export function PlayControls() {
  const play = usePlaySource()
  useSpaceToPlay(spaceAction(play.play))
  return (
    <>
      <BarTabs<string>
        label="Mode"
        value={play.mode}
        onChange={play.setMode}
        options={play.modes.map((mode) => ({
          value: mode.value,
          label: mode.label,
          description: mode.description,
          icon: <mode.icon size={18} />,
        }))}
      />
      {/* How fast, the click that keeps it, and the keyboard it is played on. */}
      <span className="bar-group bar-group--tempo bar-xs">
        {play.tempo && <Tempo play={play} />}
        <Metronome play={play} className="bar-mid" />
        <MidiButton className="bar-mid" />
      </span>
      {/* What acts on the music: record it, back to the start, play. */}
      <span className="bar-group">
        <span className="bar-mid top-bar__cluster">
          <RecordButton />
          <LastTakeButton />
        </span>
        <PlayButton play={play.play} />
      </span>
    </>
  )
}

function Tempo({
  play,
  className,
  panel,
}: {
  play: TempoSource
  className?: string
  panel?: boolean
}) {
  if (!play.tempo) return null
  const { value, min, max, step, detail, onChange } = play.tempo
  return (
    <TempoField
      value={value}
      min={min}
      max={max}
      step={step}
      detail={detail}
      onChange={onChange}
      panel={panel}
      className={className}
    />
  )
}

function Metronome({ play, className }: { play: TempoSource; className?: string }) {
  const { on, bpm, disabled, toggle } = play.metronome
  return (
    <BarButton
      look="icon"
      className={className}
      label={`Metronome ${on ? 'on' : 'off'}${bpm ? `, ${bpm} BPM` : ''}`}
      icon={<MetronomeIcon />}
      aria-pressed={on}
      disabled={disabled}
      onClick={toggle}
    />
  )
}

function PlayButton({ play }: { play: PlayState }) {
  if (play.kind === 'pause')
    return (
      <>
        <BarButton
          look="icon"
          label="Back to the start"
          icon={<RotateCcw size={18} aria-hidden />}
          onClick={play.onRestart}
        />
        <BarButton
          look="start"
          label={play.paused ? 'Go on' : 'Pause'}
          icon={play.paused ? <Play size={18} aria-hidden /> : <Pause size={18} aria-hidden />}
          onClick={play.onToggle}
        />
      </>
    )
  if (play.kind === 'stop')
    return (
      <BarButton
        look="stop"
        label="Stop"
        icon={<Square size={16} aria-hidden />}
        onClick={play.onStop}
      />
    )
  return (
    <BarButton
      look="start"
      label={play.unavailable ?? play.label}
      icon={<Play size={18} aria-hidden />}
      disabled={play.unavailable !== undefined}
      onClick={play.onPlay}
    />
  )
}

/**
 * The tempo and the click, in a panel, each only where the bar has folded it
 * away (`panel-only-*`): on a wide screen they are on the bar, and only there.
 */
export function PanelTempo() {
  const play = useTempoSource()
  if (!play.tempo) return null
  return (
    <>
      <Field label="Tempo" className="panel-only-xs">
        <Tempo play={play} panel />
      </Field>
      <Field label="Metronome" className="panel-only-mid">
        <Metronome play={play} className="bar-icon-button--panel self-start" />
      </Field>
    </>
  )
}
