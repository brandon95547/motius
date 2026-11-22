import type { Db } from '../db/index.js'
import {
  KEY_LABELS,
  STAGE_VIEWS,
  type LessonSettings,
  type LessonSettingsInput,
} from '@motius/shared'

/**
 * How each lesson opens: what is written on the keys, the view, the hands and
 * the tempo, set by an admin for everybody. The lessons themselves are the
 * app's, so any well-formed lesson address is kept; a lesson with no row
 * opens as the player left things.
 */

interface Row {
  lessonKey: string
  keyLabels: string | null
  stageView: string | null
  hands: number | null
  bpm: number | null
}

const SELECT = `SELECT lesson_key AS lessonKey, key_labels AS keyLabels, stage_view AS stageView,
                       hands, bpm
                  FROM lesson_settings`

const oneOf = <T extends string>(list: readonly T[], value: string | null): T | null =>
  list.find((item) => item === value) ?? null

/** A row as the app takes it, less anything this build has no name for. */
const settingsOf = (row: Row): LessonSettings => ({
  lessonKey: row.lessonKey,
  keyLabels: oneOf(KEY_LABELS, row.keyLabels),
  stageView: oneOf(STAGE_VIEWS, row.stageView),
  hands: row.hands === null ? null : row.hands === 1,
  bpm: row.bpm,
})

const isCleared = (settings: LessonSettingsInput) =>
  Object.values(settings).every((value) => value === null)

export class LessonSettingsRepository {
  constructor(private readonly db: Db) {}

  list(): LessonSettings[] {
    return (this.db.prepare(`${SELECT} ORDER BY lesson_key`).all() as Row[]).map(settingsOf)
  }

  /**
   * The whole of a lesson's settings, set by the admin `by`. All null clears
   * the lesson, and what comes back is then what was sent.
   */
  set(settings: LessonSettings, by: string): LessonSettings {
    const { lessonKey, ...input } = settings
    if (isCleared(input)) {
      this.db.prepare('DELETE FROM lesson_settings WHERE lesson_key = ?').run(lessonKey)
      return { ...settings }
    }
    this.db
      .prepare(
        `INSERT INTO lesson_settings
           (lesson_key, key_labels, stage_view, hands, bpm, updated_at, updated_by)
         VALUES (@lessonKey, @keyLabels, @stageView, @hands, @bpm, @at, @by)
         ON CONFLICT (lesson_key) DO UPDATE SET
           key_labels = excluded.key_labels,
           stage_view = excluded.stage_view,
           hands = excluded.hands,
           bpm = excluded.bpm,
           updated_at = excluded.updated_at,
           updated_by = excluded.updated_by`,
      )
      .run({
        ...settings,
        hands: settings.hands === null ? null : settings.hands ? 1 : 0,
        at: new Date().toISOString(),
        by,
      })
    return settingsOf(this.db.prepare(`${SELECT} WHERE lesson_key = ?`).get(lessonKey) as Row)
  }
}
