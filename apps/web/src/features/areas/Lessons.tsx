import * as React from 'react'
import { ArrowLeft, ArrowRight, Hammer, ListTree, X } from 'lucide-react'
import { Drawer } from '@/ui/Drawer'
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
 * A section's stage: the lesson that is up over the staff, with the way to the
 * one before and the one after, and the section's lessons in a sheet from the
 * left, opened from the bar.
 *
 * The stage is where a section opens, so a player is two choices from the
 * dashboard to the keys however deep the outline goes. The topics under the
 * section are the list's chapters, not pages of cards to get through first.
 * The list slides in over the stage rather than standing beside it, so the
 * staff and the keys keep the whole width. A written lesson says what it asks
 * and plays in Explore, Learn and Practice from the bar; one not written yet
 * says so, and the keys are free to play.
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

const close = () => {
  if (usePanelStore.getState().panel === 'lessons') panelActions.close()
}

const go = (here: Here, lesson: Lesson | undefined) => {
  if (!lesson) return
  close()
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
 * The bar's way into the section's lessons, on its left where an area has its
 * options: the sheet comes in from that side, under it.
 */
export function LessonsButton() {
  const here = useHere()
  const open = usePanelStore((state) => state.panel === 'lessons')
  if (!here) return null
  const label = `${here.section.label} lessons`
  return (
    <button
      type="button"
      className="bar-options"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={label}
      title={label}
      onClick={() => (open ? panelActions.close() : panelActions.open('lessons'))}
    >
      <ListTree size={18} aria-hidden />
    </button>
  )
}

/** The section's lessons, by chapter, the one that is up marked. */
export function LessonsDrawer() {
  const here = useHere()
  const open = usePanelStore((state) => state.panel === 'lessons')
  if (!here) return null
  const current = here.lessons[here.index]
  const count = here.lessons.length

  return (
    <Drawer
      side="left"
      fit
      open={open}
      onClose={close}
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
                    {lesson.lesson.label}
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
 * The lesson that is up, over the staff: its name, where it is, and the way on.
 * Closed, it is gone until another lesson is up: the staff is the player's.
 */
export function LessonCard() {
  const here = useHere()
  const [closed, setClosed] = React.useState<string | null>(null)
  if (!here) return null
  const lesson = here.lessons[here.index]!
  const key = lesson.path.join('/')
  if (closed === key) return null
  const before = here.lessons[here.index - 1]
  const after = here.lessons[here.index + 1]
  const where = chapterOf(lesson) || here.section.label

  return (
    <section className="lesson-card" data-accent={here.section.accent} aria-label="Lesson">
      <button
        type="button"
        className="bar-icon-button lesson-card__close"
        aria-label="Close"
        title="Close"
        onClick={() => setClosed(key)}
      >
        <X size={18} aria-hidden />
      </button>
      <p className="lesson-card__where">
        {where} · <span data-tabular>{`${here.index + 1} of ${here.lessons.length}`}</span>
      </p>
      <h2 className="lesson-card__name">{lesson.lesson.label}</h2>
      {lesson.lesson.about ? (
        <p className="lesson-card__about">{lesson.lesson.about}</p>
      ) : (
        <p className="lesson-card__status">
          <Hammer size={14} aria-hidden />
          {COMING_SOON}. The keys are yours to play meanwhile.
        </p>
      )}
      <div className="lesson-card__steps">
        <button
          type="button"
          className="lesson-card__step"
          disabled={!before}
          aria-label="Previous lesson"
          title={before ? before.lesson.label : undefined}
          onClick={() => go(here, before)}
        >
          <ArrowLeft size={16} aria-hidden />
          Previous
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
