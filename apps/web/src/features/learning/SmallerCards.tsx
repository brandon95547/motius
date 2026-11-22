import { Info, Lightbulb, Minus, Plus, RotateCcw } from 'lucide-react'
import {
  currentStep,
  LEARNING_MODE_DESCRIPTIONS,
  type Exercise,
  type LearningMode,
  type SessionState,
} from '@motius/shared'
import { Card } from '@/ui/Surface'
import { Divider } from '@/ui/Display'
import { Button, IconButton } from '@/ui/Button'
import { Switch } from '@/ui/Controls'
import { cn } from '@/lib/cn'
import { useLearningStore } from '@/state/learning-store'
import { HandDiagram } from './HandDiagram'
import { HAND_NAMES, handsOf } from './session-hands'

/* ===========================================================================
   THE SMALLER CARDS
   ======================================================================== */

export function InstructionsCard({ mode }: { mode: LearningMode }) {
  return (
    <Card className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-label text-[var(--ds-fg)]">
        <Info size={15} className="text-[var(--ds-accent-text)]" aria-hidden />
        Instructions
      </h3>
      <p className="text-body-sm leading-relaxed text-[var(--ds-fg-secondary)]">
        {LEARNING_MODE_DESCRIPTIONS[mode]}
      </p>
      <p className="text-caption text-[var(--ds-fg-muted)]">
        Play with a connected MIDI keyboard, or with the on-screen keys.
      </p>
    </Card>
  )
}

/** `finger 1`, `fingers 1 3 5`. */
const fingerWord = (fingers: string | undefined) =>
  fingers && fingers.length > 1 ? 'fingers' : 'finger'

export function HandPositionCard({
  exercise,
  session,
}: {
  exercise: Exercise
  session: SessionState
}) {
  const step = currentStep(exercise, session)
  const hands = handsOf(exercise, step)
  const together = hands.length > 1
  const first = exercise.steps[0]
  // The crossing is the moment a scale is won or lost, so it is named up front
  // rather than only when it arrives on the key. Each hand has its own: they do
  // not cross on the same note.
  const advice = hands.map(({ hand }) => {
    const crossing = exercise.steps.find((entry) =>
      entry.fingers.some((finger) => finger.hand === hand && finger.cue),
    )
    return {
      hand,
      // Every finger this hand starts on: one for a scale, three or four for a chord.
      start: first?.fingers
        .filter((finger) => finger.hand === hand)
        .map((finger) => finger.finger)
        .join(' '),
      cue: crossing?.fingers.find((finger) => finger.hand === hand)?.cue?.toLowerCase(),
      on: crossing?.label,
    }
  })

  return (
    <Card className="flex gap-3">
      <div className="flex shrink-0 gap-1 opacity-70">
        {hands.map(({ hand, fingers }) => (
          <div key={hand} className={cn('h-20', together ? 'w-12' : 'w-16')}>
            <HandDiagram hand={hand} fingers={fingers} />
          </div>
        ))}
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <h3 className="flex items-center gap-2 text-label text-[var(--ds-fg)]">
          <Lightbulb size={15} className="text-[var(--ds-warning-text)]" aria-hidden />
          Hand position
        </h3>
        {together ? (
          <p className="text-body-sm leading-relaxed text-[var(--ds-fg-secondary)]">
            {first &&
              `Start on ${first.label}: ${advice
                .map(
                  ({ hand, start }) =>
                    `${HAND_NAMES[hand].toLowerCase()} ${fingerWord(start)} ${start}`,
                )
                .join(', ')}. `}
            Keep the wrists level and the fingers curved.
            {advice.map(({ hand, cue, on }) =>
              cue ? ` ${HAND_NAMES[hand]}: ${cue} on ${on}.` : '',
            )}
          </p>
        ) : (
          <p className="text-body-sm leading-relaxed text-[var(--ds-fg-secondary)]">
            {first &&
              `Start with ${fingerWord(advice[0]?.start)} ${advice[0]?.start} on ${first.label}. `}
            Keep the wrist level and the fingers curved
            {advice[0]?.cue ? `, and ${advice[0].cue} on ${advice[0].on}.` : '.'}
          </p>
        )}
      </div>
    </Card>
  )
}

export function PracticeControlsCard() {
  const { targetBpm, setTargetBpm, autoTempo, setAutoTempo, start, session } = useLearningStore()

  return (
    <Card className="flex flex-col gap-3">
      <h3 className="text-label text-[var(--ds-fg)]">Practice controls</h3>

      <div className="flex flex-wrap items-center gap-2 coarse:gap-3">
        <Button
          size="sm"
          variant="outlined"
          startIcon={<RotateCcw />}
          onClick={start}
          disabled={session.status === 'idle'}
        >
          Restart
        </Button>

        <div className="flex items-center gap-1 coarse:gap-3">
          <IconButton
            label="Slower"
            icon={<Minus />}
            size="sm"
            variant="outlined"
            onClick={() => setTargetBpm(targetBpm - 4)}
          />
          <span
            className="min-w-[4.5rem] text-center text-label text-[var(--ds-fg)]"
            data-tabular
            aria-live="polite"
          >
            {targetBpm} BPM
          </span>
          <IconButton
            label="Faster"
            icon={<Plus />}
            size="sm"
            variant="outlined"
            onClick={() => setTargetBpm(targetBpm + 4)}
          />
        </div>
      </div>

      <Divider />

      {/* A target to aim at, not a metronome. Motius measures what you actually
          played and shows it next to this number; it does not click at you. */}
      <Switch
        label="Auto tempo"
        description="Raises the target after a clean run at this speed, and eases off after a scrappy one."
        checked={autoTempo}
        onChange={setAutoTempo}
      />
    </Card>
  )
}
