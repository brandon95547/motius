import * as React from 'react'
import { ArrowRight, Info, ListTree } from 'lucide-react'
import { BarButton } from '@/ui/BarButton'
import { Button } from '@/ui/Button'
import { Checkbox } from '@/ui/Controls'
import { Dialog } from '@/ui/Dialog'
import { Drawer } from '@/ui/Drawer'
import { useLearningStore } from '@/state/learning-store'
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
 * A section's stage: a written lesson's introduction in a dialog, and the
 * section's lessons in a sheet from the left, opened from the bar.
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
 * The lessons whose introduction the player has said not to show again, by
 * address, kept on this device.
 */
const HIDDEN_INTROS_KEY = 'motius.lesson-intros-hidden'

function hiddenIntros(): string[] {
  try {
    const stored = JSON.parse(globalThis.localStorage?.getItem(HIDDEN_INTROS_KEY) ?? '[]')
    return Array.isArray(stored) ? stored.filter((entry) => typeof entry === 'string') : []
  } catch {
    return []
  }
}

const introHidden = (key: string) => hiddenIntros().includes(key)

/** Keeps the player's answer to Show next time for one lesson. */
function showIntroNextTime(key: string, show: boolean) {
  const others = hiddenIntros().filter((entry) => entry !== key)
  try {
    globalThis.localStorage?.setItem(
      HIDDEN_INTROS_KEY,
      JSON.stringify(show ? others : [...others, key]),
    )
  } catch {
    // Storage off: it shows again next time, which is what the box says by default.
  }
}

/**
 * A written lesson's introduction: what it asks, as a teacher would say it
 * before the student starts. The app's own dialog, in the middle of the
 * screen. It goes when it is closed or a run starts — from it or from the bar —
 * and stays gone for that lesson: from then on the staff and the keys are the
 * player's. "Show next time", ticked unless the player unticks it, brings it
 * back on the next visit; unticked, that lesson opens straight on the stage
 * from then on, on this device. "About this lesson" on the bar opens it again
 * whenever it is wanted, its box as the player left it, so ticking it again
 * turns the introduction back on. A lesson not written yet has nothing to say, and is a tag in the
 * corner of the stage that says so.
 *
 * Which lesson is next is not asked here: the list in the sheet is the way to
 * any lesson, and the end of a run is the way on to the next.
 */
export function LessonIntro() {
  const here = useHere()
  const running = useLearningStore((state) => state.session.status !== 'idle')
  const [closed, setClosed] = React.useState<string | null>(null)
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
  if (!lesson.lesson.about) return null
  const open = asked || (closed !== key && !introHidden(key))

  const close = () => {
    showIntroNextTime(key, showNext)
    setClosed(key)
    if (usePanelStore.getState().panel === 'lesson') panelActions.close()
  }
  // Explore has nothing to start: the lesson begins in Learn, as a teacher
  // would begin it, a step at a time.
  const start = () => {
    close()
    const learning = useLearningStore.getState()
    if (learning.mode === 'explore') learning.setMode('learn')
    useLearningStore.getState().start()
  }
  const where = chapterOf(lesson) || here.section.label

  return (
    <Dialog
      open={open}
      onClose={close}
      title={lesson.lesson.label}
      description={`${where} · ${here.index + 1} of ${here.lessons.length}`}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <Checkbox label="Show next time" checked={showNext} onChange={setShowNext} />
          <div className="flex items-center gap-2.5 coarse:gap-3">
            {/* Read again during a run: nothing to start, only to go back to. */}
            <Button variant={running ? 'filled' : 'outlined'} onClick={close}>
              {running ? 'Close' : 'Not now'}
            </Button>
            {!running && <Button onClick={start}>Start</Button>}
          </div>
        </div>
      }
    >
      <p className="text-body text-[var(--ds-fg-secondary)]">{lesson.lesson.about}</p>
    </Dialog>
  )
}

/** The bar's way back to a written lesson's introduction, at any time. */
export function LessonAboutButton() {
  const here = useHere()
  if (!here?.lessons[here.index]?.lesson.about) return null
  return (
    <BarButton
      look="icon"
      label="About this lesson"
      icon={<Info size={18} aria-hidden />}
      onClick={() => panelActions.open('lesson')}
    />
  )
}

/** A lesson not written yet, said in the corner of the stage. */
export function LessonSoon() {
  const here = useHere()
  if (!here || here.lessons[here.index]?.lesson.about) return null
  return <span className="stage-pill lesson-soon">{COMING_SOON}</span>
}

/** On to the next lesson, where there is one: at the end of a run, beside Again. */
export function NextLessonButton() {
  const here = useHere()
  const page = usePageStore((state) => state.page)
  const after = here?.lessons[here.index + 1]
  if (page !== 'lesson' || !here || !after) return null
  return (
    <button
      type="button"
      className="bar-start bar-start--stop"
      title={after.lesson.label}
      onClick={() => go(here, after)}
    >
      <span className="bar-start__label">Next lesson</span>
      <ArrowRight size={18} aria-hidden />
    </button>
  )
}
