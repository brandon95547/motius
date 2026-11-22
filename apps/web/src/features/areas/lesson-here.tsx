import type * as React from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button, IconButton } from '@/ui/Button'
import { bestOf, useScoredRuns } from '@/state/history-store'
import { panelActions, usePanelStore } from '@/state/panel-store'
import { pageActions, usePageStore } from '@/state/page-store'
import {
  findCategory,
  lessonAt,
  lessonsOf,
  pagesUnder,
  type Category,
  type Lesson,
  type Section,
} from '@/lib/outline/outline'

/**
 * Where a section's stage is: the section, its lessons and which is up, and
 * the ways between them that the lesson's dialogs and its list share.
 */

export interface Here {
  readonly category: Category
  readonly section: Section
  readonly lessons: readonly Lesson[]
  /** Where the lesson that is up comes in them. */
  readonly index: number
}

/** The section whose stage is up, its lessons, and which of them is up. */
export function useHere(): Here | null {
  const category = findCategory(usePageStore((state) => state.category))
  const path = usePageStore((state) => state.path)
  const section = category ? pagesUnder(category, path)[0] : undefined
  if (!category || !section) return null
  const lessons = lessonsOf(section)
  return { category, section, lessons, index: lessonAt(lessons, path) }
}

export const closeLessons = () => {
  if (usePanelStore.getState().panel === 'lessons') panelActions.close()
}

export const go = (here: Here, lesson: Lesson | undefined) => {
  if (!lesson) return
  closeLessons()
  pageActions.openLesson(here.category, lesson.path)
}

/** What a run of lessons is under: the topics between the section and them. */
export const chapterOf = (lesson: Lesson) => lesson.topics.map((topic) => topic.label).join(' › ')

/** A lesson's address, as its history knows it. */
export const keyOf = (here: Here, lesson: Lesson) => [here.category.id, ...lesson.path].join('/')

/**
 * The way back to the lesson before this one, in both of a lesson's dialogs;
 * none on the first.
 */
export function PreviousLesson({ here }: { here: Here }) {
  const before = here.lessons[here.index - 1]
  if (!before) return null
  return (
    <Button
      variant="text"
      startIcon={<ArrowLeft size={18} />}
      title={before.lesson.label}
      onClick={() => go(here, before)}
    >
      Previous lesson
    </Button>
  )
}

/**
 * Where this lesson comes in the section, with the way to the lesson before
 * and the one after on either side: ‹ Lesson 2 of 10 ›. At either end the
 * arrow is there but dimmed, so the words do not move.
 */
function LessonSteps({ here }: { here: Here }) {
  const before = here.lessons[here.index - 1]
  const after = here.lessons[here.index + 1]
  return (
    <span className="lesson-steps">
      <IconButton
        size="sm"
        icon={<ChevronLeft />}
        label={before ? `Previous lesson: ${before.lesson.label}` : 'No lesson before this one'}
        disabled={!before}
        onClick={() => go(here, before)}
      />
      <span>
        Lesson {here.index + 1} of {here.lessons.length}
      </span>
      <IconButton
        size="sm"
        icon={<ChevronRight />}
        label={after ? `Next lesson: ${after.lesson.label}` : 'No lesson after this one'}
        disabled={!after}
        onClick={() => go(here, after)}
      />
    </span>
  )
}

/**
 * How many of the section's lessons have been played: at the end of a run, in
 * words ("10 / 10 lessons (100%)"); under an introduction, a thin bar that
 * fills, with where this lesson comes above it.
 */
export function SectionProgress({ here, thin }: { here: Here; thin?: boolean }) {
  const runs = useScoredRuns()
  const total = here.lessons.length
  const done = here.lessons.filter((lesson) => bestOf(runs, keyOf(here, lesson))).length
  const fraction = total > 0 ? done / total : 0
  const percent = `${Math.round(fraction * 100)}%`
  if (!thin) {
    return (
      <p className="lesson-progress__count" data-tabular>
        {done} / {total} lessons ({percent})
      </p>
    )
  }
  return (
    <div className="lesson-progress" data-tabular>
      <div className="lesson-progress__row">
        <LessonSteps here={here} />
        <span>{percent} played</span>
      </div>
      <div
        className="run-meter__track lesson-progress__bar"
        role="progressbar"
        aria-label={`Lessons played in ${here.section.label}`}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={`${done} of ${total} lessons`}
        style={{ '--fill': `${fraction * 100}%` } as React.CSSProperties}
      >
        <span className="run-meter__fill" />
      </div>
    </div>
  )
}
