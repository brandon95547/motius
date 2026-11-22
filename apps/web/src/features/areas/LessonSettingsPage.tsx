import * as React from 'react'
import { Check } from 'lucide-react'
import {
  KEY_LABELS,
  LESSON_BPM,
  STAGE_VIEWS,
  type KeyLabels,
  type LessonSettings,
  type StageView,
} from '@motius/shared'
import { Select } from '@/ui/Controls'
import { useLessonSettingsStore } from '@/state/lesson-settings-store'
import {
  CATEGORIES,
  lessonsOf,
  type Category,
  type Lesson,
  type Section,
} from '@/lib/outline/outline'

/**
 * The admin's page: how each written lesson opens, for every player — what is
 * written on the keys, the stage's view, the hands, and the tempo. Each is
 * where the lesson starts, not a rule: the player can change any of it once
 * in. "Player's choice" leaves it as the player left things.
 *
 * A change is saved as it is made. Only an admin is shown this page, and the
 * server takes a change from an admin only.
 */

const KEY_LABEL_NAMES: Record<KeyLabels, string> = {
  notes: 'Note names',
  fingers: 'Finger numbers',
  degrees: 'Scale degrees',
  off: 'Nothing',
}
const VIEW_NAMES: Record<StageView, string> = { staff: 'Staff', falling: 'Falling notes' }
/** The tempos offered: a lesson's own, or one of these. */
const TEMPOS = [40, 50, 60, 70, 80, 90, 100, 110, 120].filter(
  (bpm) => bpm >= LESSON_BPM.min && bpm <= LESSON_BPM.max,
)

const PLAYERS = { value: '', label: 'Player’s choice' }
const KEY_LABEL_OPTIONS = [
  PLAYERS,
  ...KEY_LABELS.map((value) => ({ value, label: KEY_LABEL_NAMES[value] })),
]
const VIEW_OPTIONS = [PLAYERS, ...STAGE_VIEWS.map((value) => ({ value, label: VIEW_NAMES[value] }))]
const HANDS_OPTIONS = [PLAYERS, { value: 'on', label: 'Shown' }, { value: 'off', label: 'Hidden' }]
const TEMPO_OPTIONS = [
  { value: '', label: 'Lesson’s own' },
  ...TEMPOS.map((bpm) => ({ value: String(bpm), label: `${bpm} BPM` })),
]

/** A section's written lessons, by its address: only those have anything to set. */
function writtenLessons(category: Category, section: Section) {
  return lessonsOf(section)
    .filter((lesson) => lesson.lesson.exercise)
    .map((lesson) => ({ lesson, key: [category.id, ...lesson.path].join('/') }))
}

export function LessonSettingsPage() {
  const sections = CATEGORIES.flatMap((category) =>
    category.sections.map((section) => ({
      category,
      section,
      lessons: writtenLessons(category, section),
    })),
  ).filter((each) => each.lessons.length > 0)

  return (
    <main className="dashboard" aria-label="Lesson settings">
      <div className="dashboard__inner lesson-settings">
        <header className="lesson-settings__header">
          <h1 className="lesson-settings__title">Lesson settings</h1>
          <p className="lesson-settings__line">
            How each lesson opens for every player. Players can still change these once they are in
            a lesson. Lessons are listed here once they are written.
          </p>
        </header>
        {sections.map(({ category, section, lessons }) => (
          <section key={`${category.id}/${section.id}`} className="lesson-settings__section">
            <h2 className="lesson-settings__section-title">
              {category.label} › {section.label}
            </h2>
            <ul className="lesson-settings__rows">
              {lessons.map(({ lesson, key }) => (
                <LessonRow key={key} lesson={lesson} lessonKey={key} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  )
}

const NONE: Omit<LessonSettings, 'lessonKey'> = {
  keyLabels: null,
  stageView: null,
  hands: null,
  bpm: null,
}

function LessonRow({ lesson, lessonKey }: { lesson: Lesson; lessonKey: string }) {
  const stored = useLessonSettingsStore((state) => state.byLesson[lessonKey])
  const save = useLessonSettingsStore((state) => state.save)
  const [status, setStatus] = React.useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const current: LessonSettings = { ...NONE, ...stored, lessonKey }
  const name = lesson.lesson.label

  const change = (patch: Partial<LessonSettings>) => {
    setStatus('saving')
    save({ ...current, ...patch })
      .then(() => setStatus('saved'))
      .catch((error: unknown) => {
        console.error(`Motius could not save the settings of ${name}.`, error)
        setStatus('failed')
      })
  }

  return (
    <li className="lesson-settings__row">
      <div className="lesson-settings__lesson">
        <span className="lesson-settings__name">{name}</span>
        <span className="lesson-settings__status" role="status">
          {status === 'saving' && 'Saving…'}
          {status === 'saved' && (
            <>
              <Check size={14} aria-hidden /> Saved
            </>
          )}
          {status === 'failed' && 'Not saved. Try again.'}
        </span>
      </div>
      <label className="lesson-settings__field">
        <span>Key labels</span>
        <Select
          size="sm"
          aria-label={`Key labels for ${name}`}
          options={KEY_LABEL_OPTIONS}
          value={current.keyLabels ?? ''}
          onChange={(event) =>
            change({ keyLabels: (event.target.value || null) as KeyLabels | null })
          }
        />
      </label>
      <label className="lesson-settings__field">
        <span>View</span>
        <Select
          size="sm"
          aria-label={`View for ${name}`}
          options={VIEW_OPTIONS}
          value={current.stageView ?? ''}
          onChange={(event) =>
            change({ stageView: (event.target.value || null) as StageView | null })
          }
        />
      </label>
      <label className="lesson-settings__field">
        <span>Hands</span>
        <Select
          size="sm"
          aria-label={`Hands for ${name}`}
          options={HANDS_OPTIONS}
          value={current.hands === null ? '' : current.hands ? 'on' : 'off'}
          onChange={(event) =>
            change({ hands: event.target.value === '' ? null : event.target.value === 'on' })
          }
        />
      </label>
      <label className="lesson-settings__field">
        <span>Tempo</span>
        <Select
          size="sm"
          aria-label={`Tempo for ${name}`}
          options={TEMPO_OPTIONS}
          value={current.bpm === null ? '' : String(current.bpm)}
          onChange={(event) =>
            change({ bpm: event.target.value ? Number(event.target.value) : null })
          }
        />
      </label>
    </li>
  )
}
