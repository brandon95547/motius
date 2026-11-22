/*
 * The API's address: its version, and where it is served.
 *
 * Plain values, apart from the schemas (`api-schemas.ts`), so the browser
 * can use them without carrying zod (docs/adr/0009).
 */

export const API_VERSION = 'v1' as const

export const API_PREFIX = `/api/${API_VERSION}` as const
