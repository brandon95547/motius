import { Check } from 'lucide-react'
import type { JourneyStage, StageState } from '@/lib/achievements/journey'
import { pageActions } from '@/state/page-store'

/**
 * The course, category by category, in the order it is taught: what is done,
 * what is under way, what is next, and what is still to be written. Each opens
 * its category's page.
 */

const SAID: Record<StageState, string> = {
  complete: 'Complete',
  'in-progress': 'In progress',
  next: 'Up next',
  'not-started': 'Not started',
  'to-come': 'Coming soon',
}

export function Journey({ journey }: { journey: readonly JourneyStage[] }) {
  return (
    <section className="progress__group" aria-label="Lesson journey">
      <h2 className="progress__title">Lesson journey</h2>
      <ol className="journey">
        {journey.map((stage, index) => (
          <li key={stage.category.id} className="journey__stage" data-state={stage.state}>
            <button
              type="button"
              className="journey__open"
              onClick={() => pageActions.openCategory(stage.category)}
            >
              <span className="journey__mark" aria-hidden>
                {stage.state === 'complete' ? <Check size={16} /> : index + 1}
              </span>
              <span className="journey__name">{stage.category.label}</span>
              <span className="journey__state">
                {SAID[stage.state]}
                {stage.written > 0 && stage.state !== 'complete' && (
                  <span data-tabular>
                    {' '}
                    · {stage.done} / {stage.written}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}
