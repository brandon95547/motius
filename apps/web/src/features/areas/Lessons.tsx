import * as React from 'react'
import { lessonAbout } from '@motius/shared'
import { ArrowRight, Check, GraduationCap, Info, Lightbulb, Trophy } from 'lucide-react'
import { BarButton } from '@/ui/BarButton'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { Drawer } from '@/ui/Drawer'
import { bestOf, percent, useScoredRuns, type Played } from '@/state/history-store'
import { introHidden, showIntroNextTime } from '@/state/lesson-intros'
import { useLearningStore } from '@/state/learning-store'
import { panelActions, usePanelStore } from '@/state/panel-store'
import { COMING_SOON, type Lesson, type Section } from '@/lib/outline/outline'
import { FingerNumbers } from './FingerNumbers'
import { resultsActions } from './results-store'
import { chapterOf, closeLessons, go, keyOf, SectionProgress, useHere } from './lesson-here'
import { remindThenRun } from '@/state/hands-reminder'

/**
 * A section's stage: a written lesson's introduction in a dialog, and the
 * section's lessons in a sheet from the right, opened from the bar's tools.
 *
 * The stage is where a section opens, so a player is two choices from the
 * dashboard to the keys however deep the outline goes. The topics under the
 * section are the list's chapters, not pages of cards to get through first.
 * The list slides in over the stage rather than standing beside it, so the
 * staff and the keys keep the whole width. A written lesson says what it asks
 * and plays in Listen, Learn and Practice from the bar; one not written yet
 * says so, and the keys are free to play. How a run of it went is in
 * `LessonResults`.
 */

/**
 * The lessons a chapter at a time, in the outline's order. Where a section has
 * lessons of its own among its topics, a run of them is headed with the
 * section's name, so it does not read as the end of the topic before it.
 */
function chapters(section: Section, lessons: readonly Lesson[]) {
  const topical = lessons.some((lesson) => lesson.topics.length > 0)
  const runs: { title: string; lessons: Lesson[] }[] = []
  for (const lesson of lessons) {
    const title = chapterOf(lesson) || (topical ? section.label : '')
    const last = runs[runs.length - 1]
    if (last && last.title === title) last.lessons.push(lesson)
    else runs.push({ title, lessons: [lesson] })
  }
  return runs
}

/**
 * The bar's way into the section's lessons: a cap, in the tools beside About
 * this lesson. The sheet comes in from the right, the side it is opened from.
 */
export function LessonsButton({ className }: { className?: string }) {
  const here = useHere()
  const open = usePanelStore((state) => state.panel === 'lessons')
  if (!here) return null
  return (
    <BarButton
      className={className}
      look="icon"
      label={`${here.section.label} lessons`}
      icon={<GraduationCap size={18} className="lessons-icon" aria-hidden />}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => (open ? panelActions.close() : panelActions.open('lessons'))}
    />
  )
}

/** The section's lessons, by chapter, the one that is up marked. */
export function LessonsDrawer() {
  const here = useHere()
  const open = usePanelStore((state) => state.panel === 'lessons')
  const runs = useScoredRuns()
  if (!here) return null
  const current = here.lessons[here.index]
  const count = here.lessons.length

  return (
    <Drawer
      side="right"
      fit
      open={open}
      onClose={closeLessons}
      title={here.section.label}
      description={`${count} ${count === 1 ? 'lesson' : 'lessons'}`}
    >
      <nav className="lesson-list" data-accent={here.section.accent} aria-label="Lessons">
        {chapters(here.section, here.lessons).map((chapter, index) => (
          <section key={index} className="lesson-list__chapter">
            {chapter.title && <h3 className="lesson-list__chapter-title">{chapter.title}</h3>}
            <ol>
              {chapter.lessons.map((lesson) => (
                // Numbered through the section, not the chapter: the card says "4 of 10".
                <li key={lesson.path.join('/')}>
                  <button
                    type="button"
                    className="lesson-list__item"
                    aria-current={lesson === current ? 'step' : undefined}
                    onClick={() => go(here, lesson)}
                  >
                    <span className="lesson-list__number" aria-hidden>
                      {String(here.lessons.indexOf(lesson) + 1).padStart(2, '0')}
                    </span>
                    <span className="lesson-list__name">{lesson.lesson.label}</span>
                    <Best record={bestOf(runs, keyOf(here, lesson))} />
                  </button>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </nav>
    </Drawer>
  )
}

/**
 * A lesson's best score beside its name, once it has been played: a summary of
 * its history, which Progress holds whole.
 */
function Best({ record }: { record: Played | null }) {
  if (!record) return null
  return (
    <span className="lesson-list__best" data-tabular>
      <Check size={14} aria-hidden />
      <span className="sr-only">Best </span>
      {percent(record.best.accuracy)}
    </span>
  )
}

/**
 * A written lesson's introduction: what it asks, as a teacher would say it
 * before the student starts — short. The app's own dialog, in the middle of
 * the screen. It goes when it is closed or a run starts — from it or from the
 * bar — and stays gone for that lesson: from then on the staff and the keys
 * are the player's. "Show lesson instructions next time", ticked unless the player unticks it,
 * brings it back on the next visit; unticked, that lesson opens straight on
 * the stage from then on, on this device. "About this lesson" on the bar opens
 * it again whenever it is wanted, its box as the player left it. A lesson not
 * written yet has nothing to say, and is a tag in the corner of the stage that
 * says so.
 *
 * The lessons before and after are a step either side of "Lesson 2 of 10"
 * at its top (`SectionProgress`); the end of a run has its own way on
 * (`LessonResults`), and the sheet's list goes anywhere.
 */
export function LessonIntro() {
  const here = useHere()
  const running = useLearningStore((state) => state.session.status !== 'idle')
  // A run of this lesson finished, and the player still on it: its results are
  // one click away from here.
  const finished = useLearningStore((state) => state.session.status === 'complete')
  const [closed, setClosed] = React.useState<string | null>(null)
  // The exercise on the keys: the introduction is read once it has loaded.
  const onKeys = useLearningStore((state) => state.exercise !== null)
  const [showNext, setShowNext] = React.useState(true)
  const asked = usePanelStore((state) => state.panel === 'lesson')
  // The lesson's whole address: its category, then the way down to it.
  const path = here?.lessons[here.index]?.path
  const key = here && path ? [here.category.id, ...path].join('/') : undefined
  React.useEffect(() => {
    if (running && key) setClosed(key)
  }, [running, key])
  // The box says what the player last said for this lesson: ticked, unless
  // they unticked it.
  React.useEffect(() => {
    if (key) setShowNext(!introHidden(key))
  }, [key, asked])
  if (!here || !key) return null
  const lesson = here.lessons[here.index]!
  // Content, loaded with the lesson's section: here once its exercise is.
  const about = lesson.lesson.exercise && onKeys ? lessonAbout(lesson.lesson.exercise) : null
  if (!about) return null
  const open = asked || (closed !== key && !introHidden(key))

  const close = () => {
    showIntroNextTime(key, showNext)
    setClosed(key)
    if (usePanelStore.getState().panel === 'lesson') panelActions.close()
  }
  // Listen has no run: the lesson begins in Lesson mode, as a teacher would
  // begin it, a step at a time.
  const start = () => {
    close()
    const learning = useLearningStore.getState()
    if (learning.mode !== 'learn') learning.setMode('learn')
    remindThenRun(() => useLearningStore.getState().start())
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      eyebrow={chapterOf(lesson) || here.section.label}
      title={lesson.lesson.label}
      showNext={{
        label: 'Show lesson instructions next time',
        checked: showNext,
        onChange: setShowNext,
      }}
      footer={
        <>
          {finished && (
            <Button
              variant="outlined"
              startIcon={<Trophy size={18} />}
              onClick={() => {
                close()
                resultsActions.open()
              }}
            >
              See results
            </Button>
          )}
          {/* Read again during a run: nothing to start, only to go back to. */}
          {running && !finished ? (
            <Button onClick={close}>Close</Button>
          ) : (
            <Button endIcon={<ArrowRight size={18} />} onClick={start}>
              Start lesson
            </Button>
          )}
        </>
      }
    >
      <div className="lesson-intro">
        <SectionProgress here={here} thin />
        <section className="lesson-intro__part">
          <h3 className="lesson-intro__heading">Your objective</h3>
          <p>{about.objective}</p>
        </section>
        <section className="lesson-intro__how">
          <div className="lesson-intro__how-head">
            <h3 className="lesson-intro__heading">How to play</h3>
            {/* On every lesson: what the numbers on the keys mean, for whoever looks. */}
            <FingerNumbers />
          </div>
          {about.how.map((line) => (
            <p key={line.text}>
              {line.who && <strong>{line.who}: </strong>}
              {line.text}
            </p>
          ))}
        </section>
        {about.remember && (
          <p className="lesson-intro__remember">
            <Lightbulb size={20} aria-hidden />
            <span>
              <strong>Remember: </strong>
              {about.remember}
            </span>
          </p>
        )}
      </div>
    </Dialog>
  )
}

/** The bar's way back to a written lesson's introduction, at any time. */
/** Whether the lesson up has an introduction to open again. */
export function useHasLessonAbout() {
  const here = useHere()
  return Boolean(here?.lessons[here.index]?.lesson.exercise)
}

/** Opens the lesson's introduction again. */
export const openLessonAbout = () => panelActions.open('lesson')

export function LessonAboutButton({ className }: { className?: string }) {
  const here = useHere()
  if (!here?.lessons[here.index]?.lesson.exercise) return null
  return (
    <BarButton
      className={className}
      look="icon"
      label="About this lesson"
      icon={<Info size={18} aria-hidden />}
      onClick={openLessonAbout}
    />
  )
}

/** A lesson not written yet, said in the corner of the stage. */
export function LessonSoon() {
  const here = useHere()
  if (!here || here.lessons[here.index]?.lesson.exercise) return null
  return <span className="stage-pill lesson-soon">{COMING_SOON}</span>
}
