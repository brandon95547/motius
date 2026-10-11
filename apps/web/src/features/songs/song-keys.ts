import { keyName, type Song } from '@sonara/shared'

/**
 * The keys songs are in, as the chooser offers them to be narrowed by.
 *
 * A key is named the way `keyName` names it — "E♭ major", "C minor". That name
 * is what a built-in song's catalog entry carries, and what an imported song's
 * own key is turned into, so the two can be asked for by the same button.
 */

const LETTERS = 'ABCDEFG'
/** Under a letter: the natural, then its flat, then its sharp. */
const SIGNS = ['', '♭', '♯']

/**
 * A key as a button says it: E♭ for E♭ major, and Cm for C minor.
 *
 * The minor is marked because a letter alone names the major. Every song here
 * that would be under "A" is in A minor, and a button reading A would be
 * offering a key none of them is in.
 */
export function shortKey(name: string): string {
  const [tonic = name, mode] = name.split(' ')
  return mode === 'minor' ? `${tonic}m` : tonic
}

/** The key an imported song is in, or null where nothing could be made of it. */
export const songKey = (song: Song): string | null => (song.key ? keyName(song.key) : null)

/** Each key once, A through G, and under a letter the major before the minor. */
export function sortKeys(names: Iterable<string>): string[] {
  const rank = (name: string): [number, number, number] => {
    const [tonic = '', mode] = name.split(' ')
    return [
      LETTERS.indexOf(tonic.charAt(0)),
      SIGNS.indexOf(tonic.slice(1)),
      mode === 'minor' ? 1 : 0,
    ]
  }
  return [...new Set(names)].sort((a, b) => {
    const [letter, sign, mode] = rank(a)
    const [otherLetter, otherSign, otherMode] = rank(b)
    return letter - otherLetter || sign - otherSign || mode - otherMode
  })
}
