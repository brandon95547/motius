import {
  accuracy,
  progress,
  tempo,
  upcomingSteps,
  type Exercise,
  type LearningMode,
  type SessionState,
} from '@motius/shared'
import { Card } from '@/ui/Surface'
import { cn } from '@/lib/cn'
import { useLearningStore } from '@/state/learning-store'

/* ===========================================================================
   PROGRESS — how it is going
   ======================================================================== */

export function ProgressCard({
  exercise,
  mode,
  session,
}: {
  exercise: Exercise
  mode: LearningMode
  session: SessionState
}) {
  const targetBpm = useLearningStore((state) => state.targetBpm)
  const fraction = progress(exercise, session)
  const measured = tempo(session, exercise)
  const upcoming = upcomingSteps(exercise, session, 7)

  if (mode === 'listen') {
    return (
      <Card variant="elevated" className="flex flex-col gap-2">
        <h3 className="text-label text-[var(--ds-fg-muted)] uppercase tracking-[0.09em]">
          Progress
        </h3>
        <p className="text-body-sm text-[var(--ds-fg-muted)]">
          Nothing is being scored in Listen. Switch to Learn or Practice to run it and keep a
          record.
        </p>
      </Card>
    )
  }

  return (
    <Card variant="elevated" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-label text-[var(--ds-fg-muted)] uppercase tracking-[0.09em]">
          Progress
        </h3>
        <span className="text-label text-[var(--ds-fg)]" data-tabular>
          {session.completedSteps} / {exercise.steps.length}
        </span>
      </div>

      <div
        className="h-2 w-full overflow-hidden rounded-full bg-[var(--ds-surface-inset)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={exercise.steps.length}
        aria-valuenow={session.completedSteps}
      >
        <div
          className="h-full rounded-full bg-[var(--ds-accent)] transition-[width] duration-[220ms] ease-[cubic-bezier(0.2,0,0,1)]"
          style={{ width: `${fraction * 100}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Metric
          label="Accuracy"
          value={`${Math.round(accuracy(session) * 100)}%`}
          tone={
            accuracy(session) >= 0.95 ? 'success' : accuracy(session) >= 0.8 ? 'warning' : 'danger'
          }
        />
        <Metric
          label={`Tempo · aim ${targetBpm}`}
          value={measured === null ? '—' : `${measured}`}
          tone="info"
        />
        <Metric
          label="Mistakes"
          value={String(session.mistakes)}
          tone={session.mistakes === 0 ? 'success' : 'danger'}
        />
      </div>

      {upcoming.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-label-sm text-[var(--ds-fg-muted)]">Upcoming notes</span>
          <div className="flex flex-wrap gap-1.5">
            {upcoming.map((step, index) => (
              <span
                key={step.id}
                className={cn(
                  'grid h-8 min-w-8 place-items-center rounded-[var(--radius-sm)] px-2 text-label',
                  index === 0
                    ? 'bg-[var(--ds-accent-subtle)] text-[var(--ds-accent-text)] ring-1 ring-[var(--ds-accent-border)]'
                    : 'bg-[var(--ds-surface-inset)] text-[var(--ds-fg-secondary)]',
                )}
              >
                {mode === 'learn' ? step.label : '·'}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

const METRIC_TONE = {
  success: 'text-[var(--ds-success-text)]',
  warning: 'text-[var(--ds-warning-text)]',
  danger: 'text-[var(--ds-danger-text)]',
  info: 'text-[var(--ds-info-text)]',
} as const

function Metric({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: keyof typeof METRIC_TONE
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className={cn('text-h3', METRIC_TONE[tone])} data-tabular>
        {value}
      </span>
      <span className="text-caption text-[var(--ds-fg-muted)]">{label}</span>
    </div>
  )
}
