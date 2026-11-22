/*
 * What accounts keep, as the app needs it: the choices a lesson opens
 * with, the kinds of run, and the limits.
 *
 * Plain values, apart from the schemas (`account-schemas.ts`), so the browser
 * can use them without carrying zod (docs/adr/0009).
 */

/* ---- How a lesson opens -------------------------------------------------- */

/** What is written on the keys: note names, fingers, scale degrees, or nothing. */
export const KEY_LABELS = ['notes', 'fingers', 'degrees', 'off'] as const

export type KeyLabels = (typeof KEY_LABELS)[number]

/** The stage above the keys: the staff, or the notes falling toward the keys. */
export const STAGE_VIEWS = ['staff', 'falling'] as const

export type StageView = (typeof STAGE_VIEWS)[number]

/** The tempo a lesson can be set to, the same range the app's tempo takes. */
export const LESSON_BPM = { min: 30, max: 208 } as const

/* ---- Finished runs ------------------------------------------------------- */

export const RUN_KINDS = ['lesson', 'exercise', 'song'] as const

export type RunKind = (typeof RUN_KINDS)[number]

/**
 * The most runs kept in one go, and the most the server sends back: as many as
 * the Progress page reads, and as many as a device holds before sign-in.
 */
export const MAX_RUNS = 5000

/**
 * Starting over: `lessons` starts the lessons over and keeps the history;
 * `everything` deletes every run, as for a new account.
 */
export const RESET_SCOPES = ['lessons', 'everything'] as const

export type ResetScope = (typeof RESET_SCOPES)[number]
