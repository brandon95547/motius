/*
 * The keys the lessons are written on: their letters, middle C, and the
 * five-finger position over the white keys. Shared by every lesson's builder.
 */

export const MIDDLE_C = 60

/** A white key's letter, by its pitch class. */
export const LETTER_OF: Readonly<Record<number, string>> = {
  0: 'C',
  2: 'D',
  4: 'E',
  5: 'F',
  7: 'G',
  9: 'A',
  11: 'B',
}

/** White keys up from a white key, as many as asked for. */
export function whiteKeysUp(from: number, count: number): number[] {
  const keys: number[] = []
  for (let note = from; keys.length < count; note++)
    if (LETTER_OF[note % 12] !== undefined) keys.push(note)
  return keys
}

/**
 * A walk from one key over the white keys beside it, a finger to a key: the
 * five-finger position on that key (the fingering guide's ground rule 3). The
 * thumb is on `thumb`; each white key away from it is the next finger.
 */
export function positionFinger(note: number, thumb: number): number {
  const whitesBetween = whiteKeysUp(Math.min(note, thumb), 64).indexOf(Math.max(note, thumb))
  return whitesBetween + 1
}
