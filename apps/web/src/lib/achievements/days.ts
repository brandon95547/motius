/**
 * Days and weeks as the player lives them: in their own time zone, a week
 * from Monday to Sunday. A streak and a weekly goal are counted in these.
 */

const DAY_MS = 86_400_000

/** The day a moment falls on, as a number that goes up by one a day. */
export function dayOf(ms: number): number {
  return Math.floor((ms - new Date(ms).getTimezoneOffset() * 60_000) / DAY_MS)
}

/** Monday of the week a day is in. Day 0 (1 January 1970) was a Thursday. */
export function mondayOf(day: number): number {
  return day - ((day + 3) % 7)
}
