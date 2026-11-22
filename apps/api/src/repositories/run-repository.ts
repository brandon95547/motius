import type { Db } from '../db/index.js'
import { MAX_RUNS, newRunSchema, type NewRun, type ResetScope, type Run } from '@motius/shared'
import { storedJson, type Warn } from './stored-json.js'

/**
 * The runs a player has finished, kept with their account so the scores, the
 * bests and the Progress page follow them to any device they sign in on.
 * Every method takes the player's id: each sees, adds and resets only their own.
 */

interface Row {
  id: number
  record: string
}

export class RunRepository {
  readonly #read: ReturnType<typeof storedJson>

  constructor(
    private readonly db: Db,
    warn: Warn,
  ) {
    this.#read = storedJson('runs', warn)
  }

  /**
   * A row as the app takes it. One this build cannot read (written by an
   * older release, or corrupt) is left out rather than failing the rest.
   */
  #runOf(row: Row): Run | null {
    const stored = this.#read(row.id, row.record)
    if (!stored) return null
    const parsed = newRunSchema.safeParse(stored.value)
    return parsed.success ? { ...parsed.data, id: String(row.id) } : null
  }

  /** The player's latest runs, oldest first: as many as the Progress page reads. */
  latest(userId: number): Run[] {
    const rows = this.db
      .prepare(
        `SELECT id, record FROM (
           SELECT id, at, record FROM runs WHERE user_id = ? ORDER BY at DESC, id DESC LIMIT ?
         ) ORDER BY at, id`,
      )
      .all(userId, MAX_RUNS) as Row[]
    return rows.map((row) => this.#runOf(row)).filter((run): run is Run => run !== null)
  }

  /** When the player last started the lessons over, in ms since 1970; null for never. */
  lessonsResetAt(userId: number): number | null {
    const row = this.db.prepare('SELECT lessons_reset_at AS at FROM users WHERE id = ?').get(userId)
    return (row as { at: number | null } | undefined)?.at ?? null
  }

  /** Keeps runs, all or none, and returns them with their ids. */
  add(userId: number, runs: readonly NewRun[]): Run[] {
    const insert = this.db.prepare(
      'INSERT INTO runs (user_id, at, run_key, record) VALUES (?, ?, ?, ?) RETURNING id',
    )
    return this.db.transaction(() =>
      runs.map((run) => {
        const { id } = insert.get(userId, run.at, run.key, JSON.stringify(run)) as { id: number }
        return { ...run, id: String(id) }
      }),
    )()
  }

  /**
   * Starting over: `lessons` marks now as when the lessons started over and
   * keeps every run, and forgets the course badges seen, which go with the
   * lesson scores (earning one again shows it again); `everything` deletes
   * every run, the weekly goal and every badge seen, as for a new account.
   * Returns when the lessons were last started over, after it.
   */
  reset(userId: number, scope: ResetScope): number | null {
    this.db.transaction(() => {
      if (scope === 'everything') {
        this.db.prepare('DELETE FROM runs WHERE user_id = ?').run(userId)
        this.db
          .prepare('UPDATE users SET lessons_reset_at = NULL, weekly_goal = NULL WHERE id = ?')
          .run(userId)
        this.db.prepare('DELETE FROM seen_badges WHERE user_id = ?').run(userId)
      } else {
        this.db
          .prepare('UPDATE users SET lessons_reset_at = ? WHERE id = ?')
          .run(Date.now(), userId)
        this.db
          .prepare("DELETE FROM seen_badges WHERE user_id = ? AND badge_id LIKE 'course-%'")
          .run(userId)
      }
    })()
    return this.lessonsResetAt(userId)
  }
}
