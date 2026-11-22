import * as React from 'react'
import { RotateCcw } from 'lucide-react'
import type { ResetScope } from '@motius/shared'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { useGoalsStore } from '@/state/goals-store'
import { useHistoryStore } from '@/state/history-store'
import { showAllIntros } from '@/state/lesson-intros'

/**
 * Starting over, from the Progress page: a button, and a dialog with the two
 * ways to do it.
 *
 * - **Start the lessons over** (soft): the lessons' scores, bests and the
 *   lessons done start fresh, and the history stays — every run, piece and
 *   practice session still counts in the totals.
 * - **Start fresh, like a new account** (hard): every run is deleted, and the
 *   lessons' introductions show again. It cannot be undone, so the dialog says
 *   so and its button is the danger one.
 */

interface Choice {
  scope: ResetScope
  title: string
  about: string
  action: string
}

const CHOICES: readonly Choice[] = [
  {
    scope: 'lessons',
    title: 'Start the lessons over',
    about:
      'Your lesson scores, bests and finished lessons start fresh. Your history stays: every run, piece and practice session still counts in your totals.',
    action: 'Start lessons over',
  },
  {
    scope: 'everything',
    title: 'Start fresh, like a new account',
    about:
      'Deletes every run from your account, in lessons, practice areas and songs, with all your scores and history. Lesson introductions show again. This cannot be undone.',
    action: 'Delete everything',
  },
]

export function ResetProgress() {
  const [open, setOpen] = React.useState(false)
  return (
    <section className="progress__group" aria-label="Start over">
      <h2 className="progress__title">Start over</h2>
      <p className="progress__line">
        Start the lessons over and keep your history, or start fresh as if your account were new.
      </p>
      <div>
        <Button variant="inverse" startIcon={<RotateCcw size={18} />} onClick={() => setOpen(true)}>
          Reset progress…
        </Button>
      </div>
      <ResetDialog open={open} onClose={() => setOpen(false)} />
    </section>
  )
}

function ResetDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reset = useHistoryStore((state) => state.reset)
  const [scope, setScope] = React.useState<ResetScope>('lessons')
  const [status, setStatus] = React.useState<'idle' | 'working' | 'failed'>('idle')
  // Each time it opens, it opens on the gentler choice, with nothing pending.
  React.useEffect(() => {
    if (open) {
      setScope('lessons')
      setStatus('idle')
    }
  }, [open])
  const choice = CHOICES.find((each) => each.scope === scope)!

  const confirm = () => {
    setStatus('working')
    reset(scope)
      .then(() => {
        if (scope === 'everything') showAllIntros()
        // The server cleared the goal or the badges seen with them; read them again.
        void useGoalsStore.getState().load()
        onClose()
      })
      .catch((error: unknown) => {
        console.error('Motius could not reset the progress.', error)
        setStatus('failed')
      })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Reset progress"
      description="Choose how you would like to start over."
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2.5 coarse:gap-3">
          {status === 'failed' && (
            <p className="mr-auto text-[var(--ds-danger-text)]" role="alert">
              That did not work. Try again.
            </p>
          )}
          <Button variant="outlined" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={scope === 'everything' ? 'danger-outline' : 'filled'}
            disabled={status === 'working'}
            onClick={confirm}
          >
            {status === 'working' ? 'Resetting…' : choice.action}
          </Button>
        </div>
      }
    >
      <fieldset className="reset-choices">
        <legend className="sr-only">How to start over</legend>
        {CHOICES.map((each) => (
          <label
            key={each.scope}
            className="reset-choice"
            data-danger={each.scope === 'everything'}
          >
            <input
              type="radio"
              name="reset-scope"
              value={each.scope}
              checked={scope === each.scope}
              onChange={() => setScope(each.scope)}
            />
            <span className="reset-choice__text">
              <span className="reset-choice__title">{each.title}</span>
              <span className="reset-choice__about">{each.about}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </Dialog>
  )
}
