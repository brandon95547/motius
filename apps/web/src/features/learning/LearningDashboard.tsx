import { Play } from 'lucide-react'
import {
  accuracy,
  FINGER_NAMES,
  type Exercise,
  type LearningMode,
  type SessionState,
} from '@motius/shared'
import { Card } from '@/ui/Surface'
import { Chip } from '@/ui/Display'
import { cn } from '@/lib/cn'
import { useLearningStore } from '@/state/learning-store'
import { HandDiagram } from './HandDiagram'
import { MaterialCard } from './MaterialCard'
import { ProgressCard } from './ProgressCard'
import { HandPositionCard, InstructionsCard, PracticeControlsCard } from './SmallerCards'
import { handsOf } from './session-hands'

/**
 * Everything about the run in progress, for the This run panel.
 *
 * It used to be a dashboard of six cards under the keyboard, which put the
 * keyboard in the middle of the page and the scale's own facts below the fold.
 * It is a panel now, opened from the bar: the staff and the keys take the
 * screen, and this is one click away. Ordered for a player mid-run — where they
 * are and how it is going first, what the scale is further down.
 *
 * It reads the exercise and the session and nothing else — no scale-specific
 * branches in any of its cards. When chords and progressions get builders,
 * these cards render them without being touched: the title, the facts, the
 * current step and the score are all part of the generic model.
 */
export function SessionPanelContent() {
  const { exercise, mode, session, demoStepIndex } = useLearningStore()

  if (!exercise) return null

  return (
    <div className="flex flex-col gap-4">
      <CurrentStepCard
        exercise={exercise}
        mode={mode}
        session={session}
        demoStepIndex={demoStepIndex}
      />
      <ProgressCard exercise={exercise} mode={mode} session={session} />
      <PracticeControlsCard />
      <HandPositionCard exercise={exercise} session={session} />
      <MaterialCard exercise={exercise} />
      <InstructionsCard mode={mode} />
    </div>
  )
}

/* ===========================================================================
   CURRENT STEP — what to do now
   ======================================================================== */

function CurrentStepCard({
  exercise,
  mode,
  session,
  demoStepIndex,
}: {
  exercise: Exercise
  mode: LearningMode
  session: SessionState
  demoStepIndex: number | null
}) {
  const demoing = demoStepIndex !== null
  // Whichever playback head is live — the player's, or the demonstration's.
  const here = demoStepIndex ?? session.stepIndex
  const step = exercise.steps[here] ?? null
  const hands = handsOf(exercise, step)
  const together = hands.length > 1
  // The most any one hand holds at once.
  const held = Math.max(0, ...hands.map((hand) => hand.fingers.length))
  const running = session.status === 'running'
  // Practice withholds the answer on purpose. Printing the note here would
  // make it the same exercise as Learn with a different label on it — and a
  // demonstration is not a way around that.
  const reveal = mode === 'learn' && (running || demoing)

  return (
    <Card variant="elevated" className="flex flex-col gap-3">
      <h3 className="text-label text-[var(--ds-fg-muted)] uppercase tracking-[0.09em]">
        {/* A step of solid chords is a chord, not a note; a third or an
            octave is two notes. */}
        {held >= 3 ? 'Current chord' : held === 2 ? 'Current notes' : 'Current note'}
      </h3>

      {mode === 'listen' ? (
        <ListenBody exercise={exercise} />
      ) : session.status === 'complete' ? (
        <CompleteBody session={session} exercise={exercise} />
      ) : !running && !demoing ? (
        <p className="py-6 text-body text-[var(--ds-fg-muted)]">
          Press{' '}
          <span className="inline-flex items-center gap-1 align-[-0.125em] text-[var(--ds-fg)]">
            <Play size={14} aria-hidden />
            Start
          </span>{' '}
          when you are ready.
        </p>
      ) : (
        <div className="flex items-center gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[3.25rem] leading-none font-[620] tracking-[-0.03em] text-[var(--ds-accent-text)]">
              {reveal ? (step?.label ?? '—') : '?'}
            </span>
            <span className="text-body-sm text-[var(--ds-fg-muted)]" data-tabular>
              {here + 1} of {exercise.steps.length}
              {reveal && step?.degree ? ` · degree ${step.degree}` : ''}
            </span>
            {reveal &&
              hands.map(({ hand, fingers }) =>
                fingers.length === 0 ? null : (
                  <span key={hand} className="text-ui text-[var(--ds-fg)]">
                    {/* One hand needs no naming; two do, or "Finger 5" is a
                        question about which. Kept to a word, so each hand
                        stays on one line beside the two diagrams. */}
                    {together ? (hand === 'left' ? 'Left' : 'Right') : 'Finger'}{' '}
                    {fingers.join(', ')}
                    {fingers.length === 1 && ` · ${FINGER_NAMES[fingers[0]!]}`}
                  </span>
                ),
              )}
            <p className="mt-1 text-body-sm text-[var(--ds-fg-secondary)]">
              {demoing
                ? `Playing ${step?.label ?? ''}`
                : reveal
                  ? // Two hands on one note need telling; on two notes, the notes say it.
                    `Play ${step?.label} ${together && !step?.noteLabels ? 'in both hands ' : ''}to continue`
                  : 'Play the next note from memory'}
            </p>
            {reveal && step?.cue && (
              <Chip tone="accent" className="mt-1 w-fit">
                {step.cue}
              </Chip>
            )}
          </div>
          {reveal && (
            <div className="flex shrink-0 gap-1">
              {hands.map(({ hand, fingers }) => (
                <div key={hand} className={cn('h-28', together ? 'w-[4.5rem]' : 'w-24')}>
                  <HandDiagram hand={hand} fingers={fingers} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function ListenBody({ exercise }: { exercise: Exercise }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-body-sm text-[var(--ds-fg-secondary)]">
        {exercise.kind === 'scale'
          ? `Every ${exercise.title} key is lit across the whole keyboard. Play freely and listen to where the scale wants to go.`
          : // A key's chords together are the key: seven notes, not three.
            `Every note of the ${exercise.pitchClasses.length > 4 ? 'key' : 'chord'} is lit across the whole keyboard. Play freely and listen to how it sits.`}
      </p>
      <div className="flex flex-wrap gap-1.5 pt-1">
        {/* Scale order, not pitch-class order: A minor starts on A, and a chip
            row that opens on C is describing a different scale. */}
        {exercise.pitchClasses.map((pitchClass) => (
          <Chip key={pitchClass} tone="accent">
            {exercise.pitchNames[pitchClass]}
          </Chip>
        ))}
      </div>
    </div>
  )
}

function CompleteBody({ session, exercise }: { session: SessionState; exercise: Exercise }) {
  const score = Math.round(accuracy(session) * 100)
  return (
    <div className="flex flex-col gap-2 py-2">
      <span className="text-h1 text-[var(--ds-success-text)]">Complete</span>
      <p className="text-body-sm text-[var(--ds-fg-secondary)]">
        {exercise.steps.length} steps, {score}% accuracy
        {session.mistakes > 0
          ? `, ${session.mistakes} ${session.mistakes === 1 ? 'mistake' : 'mistakes'}.`
          : ', clean.'}
      </p>
    </div>
  )
}
