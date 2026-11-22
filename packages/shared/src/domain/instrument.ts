/*
 * The kinds of piano in the catalog.
 *
 * Plain values, apart from the schemas (`instrument-schemas.ts`), so the browser
 * can use them without carrying zod (docs/adr/0009).
 */

export const INSTRUMENT_FAMILIES = ['acoustic', 'electric'] as const
