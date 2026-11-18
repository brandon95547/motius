import * as React from 'react'
import { ArrowLeft, ArrowRight, Hammer, ListTree, X } from 'lucide-react'
import { panelActions, usePanelStore } from '@/state/panel-store'
import { pageActions, usePageStore } from '@/state/page-store'
import {
  COMING_SOON,
  findCategory,
  lessonAt,
  lessonsOf,
  pagesUnder,
  type Category,
  type Lesson,
  type Section,
} from './areas'

/**
 * A section's stage: its lessons in a list beside the staff, and the lesson
 * that is up over it, with the way to the one before and the one after.
 *
 * The stage is where a section opens, so a player is two choices from the
 * dashboard to the keys however deep the outline goes. The topics under the
 * section are the list's chapters, not pages of cards to get through first.
 * No lesson is written yet, so each says so and the keys are free to play.
 */

interface Here {
  readonly category: Category
  readonly section: Section
  readonly lessons: readonly Lesson[]
  /** Where the lesson that is up comes in them. */
  readonly index: number
}

/** The section whose stage is up, its lessons, and which of them is up. */
function useHere(): Here | null {
  const category = findCategory(usePageStore((state) => state.category))
  const path = usePageStore((state) => state.path)
  const section = category ? pagesUnder(category, path)[0] : undefined
  if (!category || !section) return null
  const lessons = lessonsOf(section)
  return { category, section, lessons, index: lessonAt(lessons, path) }
}

const go = (here: Here, lesson: Lesson | undefined) => {
  if (!lesson) return
  if (usePanelStore.getState().panel === 'lessons') panelActions.close()
  pageActions.openLesson(here.category, lesson.path)
}

/** What a run of lessons is under: the topics between the section and them. */
const chapterOf = (lesson: Lesson) => lesson.topics.map((topic) => topic.label).join(' › ')

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
 * The section's lessons, beside the stage on a wide screen. On a narrower one
 * the stage needs the width, and the list is a panel over its left edge,
 * opened from the lesson over the staff.
 */
export function LessonRail() {
  const here = useHere()
  const open = usePanelStore((state) => state.panel === 'lessons')
  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') panelActions.close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])
  // Leaving the stage puts the list away with it.
  React.useEffect(
    () => () => {
      if (usePanelStore.getState().panel === 'lessons') panelActions.close()
    },
    [],
  )
  if (!here) return null
  const current = here.lessons[here.index]

  return (
    <nav
      className="lesson-rail"
      data-accent={here.section.accent}
      data-open={open}
      aria-label={`${here.section.label} lessons`}
    >
      <header className="lesson-rail__header">
        <h2 className="lesson-rail__title">{here.section.label}</h2>
        <button
          type="button"
          className="bar-icon-button lesson-rail__close"
          aria-label="Close the lessons"
          title="Close"
          onClick={panelActions.close}
        >
          <X size={18} aria-hidden />
        </button>
      </header>
      <div className="lesson-rail__body">
        {chapters(here.section, here.lessons).map((chapter, index) => (
          <section key={index} className="lesson-rail__chapter">
            {chapter.title && <h3 className="lesson-rail__chapter-title">{chapter.title}</h3>}
            <ol className="lesson-rail__list">
              {chapter.lessons.map((lesson) => (
                // Numbered through the section, not the chapter: the card says "4 of 11".
                <li key={lesson.path.join('/')}>
                  <button
                    type="button"
                    className="lesson-rail__item"
                    aria-current={lesson === current ? 'step' : undefined}
                    onClick={() => go(here, lesson)}
                  >
                    <span className="lesson-rail__number" aria-hidden>
                      {String(here.lessons.indexOf(lesson) + 1).padStart(2, '0')}
                    </span>
                    {lesson.lesson.label}
                  </button>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </nav>
  )
}

/** The lesson that is up, over the staff: its name, where it is, and the way on. */
export function LessonCard() {
  const here = useHere()
  if (!here) return null
  const lesson = here.lessons[here.index]!
  const before = here.lessons[here.index - 1]
  const after = here.lessons[here.index + 1]
  const where = chapterOf(lesson) || here.section.label

  return (
    <section className="lesson-card" data-accent={here.section.accent} aria-label="Lesson">
      <p className="lesson-card__where">
        {where} · <span data-tabular>{`${here.index + 1} of ${here.lessons.length}`}</span>
      </p>
      <h2 className="lesson-card__name">{lesson.lesson.label}</h2>
      <p className="lesson-card__status">
        <Hammer size={14} aria-hidden />
        {COMING_SOON}. The keys are yours to play meanwhile.
      </p>
      <div className="lesson-card__steps">
        <button
          type="button"
          className="lesson-card__step lesson-card__all"
          aria-label="All lessons"
          onClick={() => panelActions.open('lessons')}
        >
          <ListTree size={16} aria-hidden />
          <span className="lesson-card__step-word">All lessons</span>
        </button>
        <span className="lesson-card__spacer" />
        <button
          type="button"
          className="lesson-card__step"
          disabled={!before}
          aria-label="Previous lesson"
          title={before ? before.lesson.label : undefined}
          onClick={() => go(here, before)}
        >
          <ArrowLeft size={16} aria-hidden />
          <span className="lesson-card__step-word">Previous</span>
        </button>
        <button
          type="button"
          className="lesson-card__step lesson-card__step--next"
          disabled={!after}
          aria-label="Next lesson"
          title={after ? after.lesson.label : undefined}
          onClick={() => go(here, after)}
        >
          Next
          <ArrowRight size={16} aria-hidden />
        </button>
      </div>
    </section>
  )
}
