import * as React from 'react'
import { Info } from 'lucide-react'
import { fingeringSystem, type Exercise, type ExerciseFingering } from '@motius/shared'
import { Card } from '@/ui/Surface'
import { Chip, Divider } from '@/ui/Display'
import { IconButton } from '@/ui/Button'
import { cn } from '@/lib/cn'
import { useLearningStore } from '@/state/learning-store'
import { panelActions } from '@/state/panel-store'
import { theoryTitle } from '@/lib/theory-titles'
import { HAND_NAMES } from './session-hands'

/* ===========================================================================
   MATERIAL — what you are playing
   ======================================================================== */

/** A fingering's numbers, in the groups they are played in. */
function fingerGroups(fingering: ExerciseFingering): number[][] {
  const size = fingering.perStep ?? 1
  const groups: number[][] = []
  for (let at = 0; at < fingering.fingers.length; at += size) {
    groups.push(fingering.fingers.slice(at, at + size))
  }
  return groups
}

/**
 * What a fingering's chip says, where it is not the chosen system's own.
 *
 * Three different claims. The system's name means "this is what its source
 * prints". Alfred means the same of the Alfred book, for material only that
 * book has. Suggested means nobody prints it, and it follows the same rules.
 */
const FINGERING_SOURCE_NAMES: Partial<Record<ExerciseFingering['source'], string>> = {
  derived: 'Suggested',
  alfred: 'Alfred',
}

/**
 * What the scale is — with the why one click away rather than printed under it.
 *
 * The card states the scale; the dialog behind the ⓘ explains it. Keeping the
 * explanation out of the card is what lets it be a real explanation: there is
 * room in a dialog for the tetrachords, the degree names and the fingering
 * principle, and no room for any of them above a keyboard someone came here to
 * play.
 */
export function MaterialCard({ exercise }: { exercise: Exercise }) {
  const system = fingeringSystem(useLearningStore((state) => state.fingeringSystem))
  const topic = useLearningStore((state) => state.topic)
  return (
    <Card variant="elevated" className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-h2 text-[var(--ds-fg)]">{exercise.title}</h3>
          <p className="text-caption text-[var(--ds-fg-muted)]">{exercise.subtitle}</p>
        </div>
        {/* The explanation of what is on the keys: how it is built, what its
            parts are called, why it is fingered as it is. */}
        <IconButton
          size="sm"
          variant="text"
          className="-mr-1 shrink-0"
          label={theoryTitle(topic, exercise.kind)}
          icon={<Info />}
          onClick={() => panelActions.open('theory')}
        />
      </div>

      <dl className="flex flex-col gap-2">
        {exercise.facts.map((fact) => (
          <div key={fact.label} className="flex gap-3">
            <dt className="w-[4.5rem] shrink-0 text-label text-[var(--ds-fg-muted)]">
              {fact.label}
            </dt>
            <dd className="text-ui text-[var(--ds-fg)]" data-tabular>
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>

      {exercise.fingerings.length > 0 && (
        <>
          <Divider />
          <div className="flex flex-col gap-1.5">
            {exercise.fingerings.map((fingering, index) => {
              // Named for the system means "this is what its source prints";
              // Suggested means "the source does not print this scale, and
              // this follows the same rules". They are different claims and
              // the card makes the difference visible — per hand, because one
              // hand's fingering can be printed where the other's is not.
              const source = (
                <Chip tone={fingering.source === 'derived' ? 'warning' : 'neutral'}>
                  {FINGERING_SOURCE_NAMES[fingering.source] ?? system.shortName}
                </Chip>
              )
              const hands = exercise.fingerings.length > 1
              return (
                <React.Fragment key={fingering.hand}>
                  {index === 0 && (
                    <div className="flex flex-wrap items-baseline gap-2">
                      <h4 className="text-label text-[var(--ds-accent-text)]">
                        Recommended fingering
                      </h4>
                      {!hands && source}
                    </div>
                  )}
                  {hands && (
                    <div
                      className={cn('flex flex-wrap items-baseline gap-2', index > 0 && 'mt-1.5')}
                    >
                      <span className="text-label-sm text-[var(--ds-fg-muted)]">
                        {HAND_NAMES[fingering.hand]}
                      </span>
                      {source}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1" data-tabular>
                    {/* Fingers played together share a chip: a third is 1 3,
                        not a 1 and then a 3. */}
                    {fingerGroups(fingering).map((group, at) => (
                      <span
                        key={at}
                        className={cn(
                          'grid h-6 place-items-center rounded-[var(--radius-xs)] bg-[var(--ds-surface-inset)] text-label-sm text-[var(--ds-fg-secondary)]',
                          group.length > 1 ? 'px-1.5' : 'w-6',
                        )}
                      >
                        {group.join(' ')}
                      </span>
                    ))}
                  </div>
                </React.Fragment>
              )
            })}
            <p className="text-caption text-[var(--ds-fg-muted)]">
              A suggestion, not a reading. MIDI reports the note and how hard it was played — never
              which finger played it.
            </p>
          </div>
        </>
      )}
    </Card>
  )
}
