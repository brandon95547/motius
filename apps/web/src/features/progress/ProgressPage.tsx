import { ArrowLeft, ChevronRight } from 'lucide-react'
import { pageActions } from '@/state/page-store'
import { useAchievements } from '@/state/achievements'
import { BadgeShelf } from './BadgeShelf'
import { Habits } from './Habits'
import { Journey } from './Journey'
import { ResetProgress } from './ResetProgress'
import { Standing } from './Standing'
import {
  percent,
  playedOf,
  useHistoryStore,
  useScoredRuns,
  type Played,
  type RunKind,
  type RunRecord,
} from '@/state/history-store'

/**
 * Progress: where the player stands and what they are aiming for — their
 * title, streak, weekly goal, place in the course and badges — then the
 * records, as a game keeps them: the latest runs, and everything played with
 * its best score, how many times it has been tried and when. Each record opens
 * what it is a record of, to play it again.
 *
 * It reads the player's runs (`history-store`) and goals (`goals-store`).
 */

/** How many of the latest runs head the page. */
const RECENT = 8

const GROUPS: readonly { kind: RunKind; title: string }[] = [
  { kind: 'lesson', title: 'Lessons' },
  { kind: 'exercise', title: 'Practice areas' },
  { kind: 'song', title: 'Songs' },
]

const DAY_MS = 86_400_000

/** "Today, 3:04 PM", "Yesterday, 9:12 AM", or "Nov 12". */
export function whenOf(at: number, now = Date.now()): string {
  const day = (ms: number) => Math.floor((ms - new Date(ms).getTimezoneOffset() * 60_000) / DAY_MS)
  const ago = day(now) - day(at)
  const time = new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (ago === 0) return `Today, ${time}`
  if (ago === 1) return `Yesterday, ${time}`
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const MODE_WORDS = { learn: 'Learn', practice: 'Practice' } as const

/** How one run went, in a line. */
function scoreOf(run: RunRecord): string {
  const faults = [
    run.mistakes > 0 && `${run.mistakes} ${run.mistakes === 1 ? 'mistake' : 'mistakes'}`,
    run.missed > 0 && `${run.missed} missed`,
  ].filter(Boolean)
  return [
    percent(run.accuracy),
    run.timing && `${run.timing.onTime} on time`,
    ...faults,
    // A lesson's Learn is called the lesson, as its tab is.
    `${run.kind === 'lesson' && run.mode === 'learn' ? 'Lesson' : MODE_WORDS[run.mode]} at ${run.bpm} BPM`,
  ]
    .filter(Boolean)
    .join(' · ')
}

const open = (run: RunRecord) => {
  globalThis.location.hash = run.opens
}

export function ProgressPage() {
  // The totals and the latest runs are the whole history; each piece's best is
  // from the runs that count since the lessons were last started over.
  const runs = useHistoryStore((state) => state.runs)
  const played = playedOf(useScoredRuns())
  const pieces = playedOf(runs).length
  const recent = runs.slice(-RECENT).reverse()
  const achievements = useAchievements()

  return (
    <main className="dashboard" aria-label="Progress">
      <div className="dashboard__inner progress">
        <Standing achievements={achievements} />
        <Habits achievements={achievements} />
        <Journey journey={achievements.journey} />
        <BadgeShelf achievements={achievements} />
        {runs.length === 0 ? (
          <section className="progress__empty">
            <h2 className="progress__title">Nothing played yet</h2>
            <p className="progress__line">
              Finish a lesson, a run in a practice area, or a song in Practice, and it is kept here:
              how it went, your best, and how many times you have played it.
            </p>
            <button type="button" className="placeholder__back" onClick={pageActions.openDashboard}>
              <ArrowLeft size={16} aria-hidden />
              Back to Dashboard
            </button>
          </section>
        ) : (
          <>
            <dl className="progress__totals">
              <Total label="Runs" value={runs.length} />
              <Total label="Pieces played" value={pieces} />
            </dl>
            <Group title="Recent">
              {recent.map((run) => (
                <Row
                  key={run.id}
                  run={run}
                  name={run.title}
                  about={[run.detail ?? run.place, whenOf(run.at)].join(' · ')}
                  score={scoreOf(run)}
                />
              ))}
            </Group>
            {GROUPS.map(({ kind, title }) => {
              const these = played.filter((each) => each.latest.kind === kind)
              if (these.length === 0) return null
              return (
                <Group key={kind} title={title}>
                  {these.map((each) => (
                    <PlayedRow key={each.key} played={each} />
                  ))}
                </Group>
              )
            })}
            <ResetProgress />
          </>
        )}
      </div>
    </main>
  )
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="progress__total">
      <dt>{label}</dt>
      <dd data-tabular>{value}</dd>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="progress__group" aria-label={title}>
      <h2 className="progress__title">{title}</h2>
      <ol className="progress__list">{children}</ol>
    </section>
  )
}

function PlayedRow({ played }: { played: Played }) {
  const { latest, best, tries } = played
  return (
    <Row
      run={latest}
      name={latest.title}
      about={[latest.detail ?? latest.place, whenOf(latest.at)].join(' · ')}
      score={`Best ${percent(best.accuracy)} · ${tries} ${tries === 1 ? 'try' : 'tries'}`}
    />
  )
}

function Row({
  run,
  name,
  about,
  score,
}: {
  run: RunRecord
  name: string
  about: string
  score: string
}) {
  return (
    <li>
      <button type="button" className="progress__row" onClick={() => open(run)}>
        <span className="progress__what">
          <span className="progress__name">{name}</span>
          <span className="progress__about">{about}</span>
        </span>
        <span className="progress__score" data-tabular>
          {score}
        </span>
        <ChevronRight size={18} aria-hidden className="progress__open" />
      </button>
    </li>
  )
}
