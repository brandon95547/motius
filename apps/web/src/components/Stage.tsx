import { RotateCcw } from 'lucide-react'
import { leadInMs, practiceSummary, runSummary } from '@motius/shared'
import { cn } from '@/lib/cn'
import { BarButton } from '@/ui/BarButton'
import { useAudio } from '@/audio/AudioProvider'
import { EngineChip } from '@/audio/EngineChip'
import { FallingNotes } from '@/features/keyboard/FallingNotes'
import { SongFallingNotes } from '@/features/keyboard/SongFallingNotes'
import { GrandStaff } from '@/features/staff/GrandStaff'
import { ScaleScore } from '@/features/staff/ScaleScore'
import { SongScore } from '@/features/staff/SongScore'
import { SongProgress } from '@/features/songs/SongProgress'
import { RunMeter } from '@/ui/RunMeter'
import { EXERCISE_NOUNS } from '@/features/learning/ScaleControls'
import { useLearningStore } from '@/state/learning-store'
import { useCurrentSong, useSongStore } from '@/state/song-store'
import { useViewStore } from '@/state/view-store'
import { StageBackdrop } from './StageBackdrop'

/**
 * The space between the bar and the keys: the music, written out.
 *
 * The staff gets the room here, and nothing else competes for it. What does
 * appear is transient and says one thing each — the engine asking for a key
 * press before it can make a sound, where a run has got to, how it ended — and
 * each gets out of the way again.
 *
 * What is put in it goes over the staff: on a section's stage, the lesson that
 * is up.
 */
export function Stage({ children }: { children?: React.ReactNode }) {
  const topic = useLearningStore((state) => state.topic)
  const hasExercise = useLearningStore((state) => state.exercise !== null)
  const song = useCurrentSong()
  const stageView = useViewStore((state) => state.stageView)
  const staffView = useSongStore((state) => state.staffView)
  const scoreOpen = topic === 'songs' && song !== null
  const sheet = scoreOpen && staffView === 'sheet'
  // Falling notes wherever they were chosen, with or without notes to fall:
  // the choice holds from screen to screen, songs included.
  const falling = stageView === 'falling'

  return (
    <main className="stage" aria-label="Staff" data-falling={falling}>
      <StageBackdrop />
      {topic === 'songs' && <SongProgress />}
      {children}

      <div className="stage__notices">
        <EngineNotice />
        {topic !== 'songs' && <RunStatus />}
        {topic !== 'songs' && <WrongHint />}
      </div>

      {falling && (scoreOpen ? <SongFallingNotes /> : <FallingNotes />)}
      {!falling && (
        <div className={cn('staff-panel', sheet && 'staff-panel--sheet')}>
          {/* Whatever has notes to read gets them written out: a song its
              score, a scale the scale. Only a topic with nothing written —
              free play — keeps the picture of the moment. */}
          {scoreOpen ? (
            <SongScore />
          ) : topic !== 'songs' && hasExercise ? (
            <ScaleScore />
          ) : (
            <GrandStaff />
          )}
        </div>
      )}

      {topic === 'songs' ? <SongPracticeComplete /> : <RunComplete />}
    </main>
  )
}

/**
 * The engine's status, while it has something to say.
 *
 * "Press a key to start audio" is the one thing that explains silence on a
 * fresh page, so it has to be on screen. "Sampled" is the normal state and
 * says nothing — it stays in Settings, where someone looking for it will look.
 */
function EngineNotice() {
  const { status } = useAudio()
  const steady =
    status.unlocked && !status.loadingSamples && !status.fallbackReason && status.kind === 'sampled'
  if (!status.instrumentId || steady) return null
  // On the bar's colour, like the stage's other notices. The chip's own tints are
  // made for the app's dark surfaces, and its text on the bright stage measures
  // under 2:1.
  return (
    <span className="stage-chip">
      <EngineChip />
    </span>
  )
}

/** Where a run has got to, while it runs. The full picture is in the This run panel. */
function RunStatus() {
  const session = useLearningStore((state) => state.session)
  const total = useLearningStore((state) => state.exercise?.steps.length ?? 0)
  const what = useLearningStore((state) => EXERCISE_NOUNS[state.exercise?.kind ?? 'scale'])
  const lesson = useLearningStore((state) => state.topic === 'lesson')
  if (session.status !== 'running') return null
  return (
    <RunMeter
      done={session.completedSteps}
      total={total}
      mistakes={session.mistakes}
      label={lesson ? 'the lesson' : `the ${what}`}
      title={lesson ? 'Progress' : undefined}
    />
  )
}

/**
 * A word for a wrong key of a kind the lesson expects (`Exercise.wrongHints`):
 * a group of three in a lesson on the twos is "That's three. Look for a pair."
 * Nothing else is said over the music: what a lesson has to explain, it says
 * in a dialog (its introduction, a crossing's tip).
 */
function WrongHint() {
  const text = useLearningStore((state) => {
    const hints = state.exercise?.wrongHints
    const wrong = Object.entries(state.session.wrongNotes)
    if (!hints || wrong.length === 0) return null
    const [note] = wrong.reduce((latest, each) => (each[1] > latest[1] ? each : latest))
    return hints.find((hint) => hint.pitchClasses.includes(Number(note) % 12))?.text ?? null
  })
  if (!text) return null
  return (
    <span className="stage-pill" role="status">
      {text}
    </span>
  )
}

/**
 * How the run went, the moment it ends.
 *
 * It used to be a line in a card under the keyboard, which is to say nowhere a
 * player with their eyes on the music would see it. It sits on the music now,
 * with the one thing anyone wants next: to go again — or, at the end of a
 * lesson, to go on to the next (`LessonComplete`, a lesson's own). One card for
 * a practice area's run and a song's.
 */
function RunResult({ detail, onAgain }: { detail: string; onAgain: () => void }) {
  return (
    <div className="run-complete" role="status">
      <div className="flex flex-col">
        <span className="run-complete__title">Complete</span>
        <span className="run-complete__detail" data-tabular>
          {detail}
        </span>
      </div>
      <BarButton
        look="start"
        label="Again"
        showLabel
        icon={<RotateCcw size={18} aria-hidden />}
        onClick={onAgain}
      />
    </div>
  )
}

/** "2 mistakes · 1 missed", or "clean". */
const faults = (parts: [count: number, one: string, many: string][]) =>
  parts
    .filter(([count]) => count > 0)
    .map(([count, one, many]) => `${count} ${count === 1 ? one : many}`)
    .join(' · ') || 'clean'

/** A practice area's run. A lesson's ends in its own dialog (`LessonComplete`). */
function RunComplete() {
  const session = useLearningStore((state) => state.session)
  const exercise = useLearningStore((state) => state.exercise)
  const lesson = useLearningStore((state) => state.topic === 'lesson')
  const start = useLearningStore((state) => state.start)
  if (session.status !== 'complete' || !exercise || lesson) return null
  return <RunResult detail={runSummary(exercise, session)} onAgain={start} />
}

/** How a song's Practice run went: each step on time, early, late or missed. */
function SongPracticeComplete() {
  const song = useCurrentSong()
  const practiced = useSongStore((state) => state.practiced)
  const results = useSongStore((state) => state.practice.results)
  const total = useSongStore((state) => state.stepCount)
  const startPractice = useSongStore((state) => state.startPractice)
  if (!practiced || !song) return null
  const run = practiceSummary(results, total)
  const detail = `${run.total} steps · ${Math.round(run.accuracy * 100)}% played · ${run.onTime} on time · ${faults(
    [
      [run.early, 'early', 'early'],
      [run.late, 'late', 'late'],
      [run.missed, 'missed', 'missed'],
    ],
  )}`
  return <RunResult detail={detail} onAgain={() => startPractice(leadInMs(song))} />
}
