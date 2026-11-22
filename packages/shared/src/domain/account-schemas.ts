import { z } from 'zod'
import {
  KEY_LABELS,
  LESSON_BPM,
  MAX_RUNS,
  RESET_SCOPES,
  RUN_KINDS,
  STAGE_VIEWS,
} from './account.js'

/**
 * Accounts, and what is kept for them: who is signed in, how each lesson opens
 * (set by an admin, for everybody), and every run a player has finished.
 *
 * Here, in the contract, because the server stores all three and checks
 * what it is sent and what it sends back with these schemas; the app takes
 * their types (docs/adr/0009).
 */

/** The one signed in. An admin is one whose address the server's `.env` names. */
export const userSchema = z.object({
  email: z.string().email(),
  name: z.string(),
  picture: z.string().url().nullable(),
  isAdmin: z.boolean(),
})

export type User = z.infer<typeof userSchema>

/** What the sign-in page needs before anyone is signed in. */
export const authConfigSchema = z.object({
  /** Null where the server has none set: there is no way to sign in yet. */
  googleClientId: z.string().nullable(),
})

export type AuthConfig = z.infer<typeof authConfigSchema>

/** The credential Google's sign-in button hands the page: an ID token. */
export const googleSignInSchema = z.object({
  credential: z.string().min(20).max(4096),
})

/**
 * How a lesson opens, where an admin has said: each is null where it has not
 * been set, and the lesson opens as the player left things (or, for the
 * tempo, at the lesson's own). The player can change any of them once in.
 */
export const lessonSettingsInputSchema = z.object({
  keyLabels: z.enum(KEY_LABELS).nullable(),
  stageView: z.enum(STAGE_VIEWS).nullable(),
  hands: z.boolean().nullable(),
  bpm: z.number().int().min(LESSON_BPM.min).max(LESSON_BPM.max).nullable(),
})

export type LessonSettingsInput = z.infer<typeof lessonSettingsInputSchema>

/** A lesson's address, as the app writes it: `piano-foundations/keyboard-layout/…`. */
export const lessonKeySchema = z
  .string()
  .min(1)
  .max(300)
  .regex(/^[a-z0-9-]+(\/[a-z0-9-]+)*$/)

export const lessonSettingsSchema = lessonSettingsInputSchema.extend({
  lessonKey: lessonKeySchema,
})

export type LessonSettings = z.infer<typeof lessonSettingsSchema>

export const setLessonSettingsSchema = lessonSettingsSchema

const count = z.number().int().min(0).max(100_000)

/** A run as the player finished it, before the server has kept it. */
export const newRunSchema = z.object({
  /** When it ended, in milliseconds since 1970. */
  at: z.number().int().min(0),
  kind: z.enum(RUN_KINDS),
  /** What it was a run of: a lesson's address, an exercise's or a song's id. */
  key: z.string().min(1).max(300),
  title: z.string().min(1).max(200),
  detail: z.string().max(200).optional(),
  place: z.string().min(1).max(200),
  /** Where to open it again, as a hash. */
  opens: z.string().startsWith('#/').max(300),
  mode: z.enum(['learn', 'practice']),
  bpm: z.number().int().min(1).max(400),
  steps: count,
  accuracy: z.number().min(0).max(1),
  mistakes: count,
  missed: count,
  timing: z.object({ onTime: count, early: count, late: count }).optional(),
})

export type NewRun = z.infer<typeof newRunSchema>

export const runSchema = newRunSchema.extend({ id: z.string() })

export type Run = z.infer<typeof runSchema>

/**
 * Runs to keep: one as it ends, or the ones a device held before sign-in. Each
 * is checked on its own (`newRunSchema`), so one this build cannot read (kept
 * by an older release, or corrupt) is skipped and the rest are kept.
 */
export const addRunsSchema = z.object({ runs: z.array(z.unknown()).min(1).max(MAX_RUNS) })

/** The runs kept, with their ids, and how many were skipped as unreadable. */
export const addedRunsSchema = z.object({
  items: z.array(runSchema),
  skipped: z.number().int().min(0),
})

export type AddedRuns = z.infer<typeof addedRunsSchema>

/**
 * The player's runs, and when they last started the lessons over: lesson
 * scores (bests, lessons done) count only the lesson runs after it, while the
 * history keeps every run. Null for never.
 */
export const runsSchema = z.object({
  items: z.array(runSchema),
  lessonsResetAt: z.number().int().nullable(),
})

export type Runs = z.infer<typeof runsSchema>

export const resetProgressSchema = z.object({ scope: z.enum(RESET_SCOPES) })

export const resetResultSchema = z.object({ lessonsResetAt: z.number().int().nullable() })

export type ResetResult = z.infer<typeof resetResultSchema>
