import * as React from 'react'
import { ArrowRight, Check, LibraryBig, RotateCcw, Target, Trophy, X } from 'lucide-react'
import { accuracy, stepsCalled } from '@motius/shared'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { lazyExport, OnDemand } from '@/ui/OnDemand'
import { bestOf, percent, useScoredRuns } from '@/state/history-store'
import { useLearningStore } from '@/state/learning-store'
import { pageActions } from '@/state/page-store'
import { resultsActions, useResultsStore } from './results-store'
import { chapterOf, go, keyOf, PreviousLesson, SectionProgress, useHere } from './lesson-here'

/**
 * The end of a lesson's run, in a dialog as its introduction is: how far
 * through the section the player is, the run's score as a ring, what it was
 * made of and the best so far, and what a teacher offers next — to try again,
 * back to the lesson before, or on to the next; after the last, back to the
 * unit the section is in, which is where the next section starts.
 * Closed, it stays closed until the next run ends, or the lesson's
 * introduction opens it again (See results).
 */
const LessonBadges = lazyExport(() => import('./goal-lines'), 'LessonBadges')
const LessonFanfare = lazyExport(() => import('./goal-lines'), 'LessonFanfare')

export function LessonComplete() {
  const here = useHere()
  const session = useLearningStore((state) => state.session)
  const exercise = useLearningStore((state) => state.exercise)
  const start = useLearningStore((state) => state.start)
  const runs = useScoredRuns()
  const closed = useResultsStore((state) => state.closed)
  const complete = session.status === 'complete'
  React.useEffect(() => {
    if (!complete) resultsActions.open()
  }, [complete])
  const lesson = here?.lessons[here.index]
  if (!here || !lesson || !exercise) return null
  const after = here.lessons[here.index + 1]
  const total = here.lessons.length
  // This run is in it already: it is kept the moment it ends.
  const record = bestOf(runs, keyOf(here, lesson))
  const missed = session.missedSteps.length

  return (
    <>
      {/* The sound the lesson ends on, loaded with the lesson so it is ready. */}
      <OnDemand when>
        <LessonFanfare />
      </OnDemand>
      <Dialog
        open={complete && !closed}
        onClose={resultsActions.close}
        title={`Lesson ${here.index + 1} results`}
        description={lesson.lesson.label}
        footer={
          <div className="flex w-full flex-wrap items-center gap-2.5 coarse:gap-3">
            <PreviousLesson here={here} />
            <div className="ml-auto flex items-center gap-2.5 coarse:gap-3">
              <Button variant="outlined" startIcon={<RotateCcw size={18} />} onClick={start}>
                Try again
              </Button>
              {after ? (
                <Button
                  endIcon={<ArrowRight size={18} />}
                  title={after.lesson.label}
                  onClick={() => go(here, after)}
                >
                  Next lesson
                </Button>
              ) : (
                <Button
                  startIcon={<LibraryBig size={18} />}
                  onClick={() => pageActions.openCategory(here.category)}
                >
                  Back to {here.category.label}
                </Button>
              )}
            </div>
          </div>
        }
      >
        <div className="lesson-results" data-tabular>
          <div className="lesson-results__place">
            <span>{chapterOf(lesson) || here.section.label}</span>
            <span>
              Lesson {here.index + 1} of {total}
            </span>
          </div>
          <SectionProgress here={here} />

          <div className="lesson-results__score">
            <AccuracyRing value={accuracy(session)} />
            <ul className="lesson-results__facts">
              <li>
                <Target size={20} aria-hidden />
                {exercise.steps.length} {stepsCalled(exercise)} played
              </li>
              <li>
                {session.mistakes > 0 ? (
                  <X size={20} aria-hidden />
                ) : (
                  <Check size={20} aria-hidden />
                )}
                {session.mistakes === 0
                  ? 'No wrong notes'
                  : `${session.mistakes} wrong ${session.mistakes === 1 ? 'note' : 'notes'}`}
              </li>
              {missed > 0 && (
                <li>
                  <X size={20} aria-hidden />
                  {missed} missed
                </li>
              )}
              {record && (
                <li>
                  <Trophy size={20} aria-hidden />
                  Your best: {percent(record.best.accuracy)} ({record.tries}{' '}
                  {record.tries === 1 ? 'try' : 'tries'})
                </li>
              )}
            </ul>
          </div>

          {/* The badges this run earned, or the next: loaded with the first results shown. */}
          <OnDemand when={complete}>
            <LessonBadges />
          </OnDemand>

          {!after && (
            <p className="lesson-results__note">
              That was the last lesson in {here.section.label}.
            </p>
          )}
        </div>
      </Dialog>
    </>
  )
}

/** The ring's radius and its line's width, in the drawing's own units. */
const RADIUS = 52
const STROKE = 12
const AROUND = 2 * Math.PI * RADIUS

/** A run's accuracy as a ring that fills round from the top. */
function AccuracyRing({ value }: { value: number }) {
  const shown = Math.max(0, Math.min(1, value))
  return (
    <div className="lesson-results__ring">
      <svg viewBox="0 0 128 128" aria-hidden>
        <circle
          className="lesson-results__ring-track"
          cx="64"
          cy="64"
          r={RADIUS}
          strokeWidth={STROKE}
        />
        {shown > 0 && (
          <circle
            className="lesson-results__ring-fill"
            cx="64"
            cy="64"
            r={RADIUS}
            strokeWidth={STROKE}
            strokeDasharray={`${shown * AROUND} ${AROUND}`}
          />
        )}
      </svg>
      <p className="lesson-results__ring-text">
        <span className="lesson-results__percent">{percent(shown)}</span>
        <span>accuracy</span>
      </p>
    </div>
  )
}
