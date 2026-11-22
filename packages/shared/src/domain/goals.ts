/*
 * How large a weekly goal can be.
 *
 * Plain values, apart from the schemas (`goals-schemas.ts`), so the browser
 * can use them without carrying zod (docs/adr/0009).
 */

/**
 * What a player is aiming for, kept with their account: the weekly goal they
 * chose, and which badges they have already seen unlock, so each unlock is
 * shown once, on whichever device it happens.
 *
 * The badges themselves are not stored: whether one is earned is worked out
 * from the runs, so a reset takes them away as it takes the runs.
 */

/** A weekly goal: so many runs at 90% or better between Monday and Sunday. */
export const WEEKLY_GOAL = { min: 1, max: 100 } as const
