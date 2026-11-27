import type { NoteValue } from '@motius/shared'

/**
 * Scanning MusicXML: reading one element's text or number out of a stretch of
 * the file, and the tables that turn what the format writes into what a song
 * holds.
 */

export const STEP_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
export const LETTER_INDEX: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 }

/** MusicXML note types onto the values the engraver draws. */
export const TYPE_VALUES: Record<string, NoteValue> = {
  maxima: 'whole',
  long: 'whole',
  breve: 'whole',
  whole: 'whole',
  half: 'half',
  quarter: 'quarter',
  eighth: 'eighth',
  '16th': 'sixteenth',
  '32nd': 'thirty-second',
  '64th': 'thirty-second',
  '128th': 'thirty-second',
  '256th': 'thirty-second',
}

/** Kinds a `<harmony>` names, as the suffix a lead sheet prints. */
export const KIND_SUFFIX: Record<string, string> = {
  major: '',
  minor: 'm',
  augmented: '+',
  diminished: '°',
  dominant: '7',
  'major-seventh': 'maj7',
  'minor-seventh': 'm7',
  'diminished-seventh': '°7',
  'augmented-seventh': '+7',
  'half-diminished': 'ø7',
  'major-minor': 'm(maj7)',
  'major-sixth': '6',
  'minor-sixth': 'm6',
  'dominant-ninth': '9',
  'major-ninth': 'maj9',
  'minor-ninth': 'm9',
  'dominant-11th': '11',
  'dominant-13th': '13',
  'suspended-second': 'sus2',
  'suspended-fourth': 'sus4',
  power: '5',
  none: '',
}

/** How long before its beat a grace note is struck: one number for the importers and the exports. */
export { GRACE_Q } from '@motius/shared'

export const inner = (xml: string, tag: string): string | undefined =>
  new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`).exec(xml)?.[1]

export const num = (xml: string, tag: string): number | undefined => {
  const text = inner(xml, tag)
  if (text === undefined) return undefined
  const value = Number(text.trim())
  return Number.isFinite(value) ? value : undefined
}

export const flag = (xml: string, tag: string): boolean =>
  new RegExp(`<${tag}(?:\\s[^>]*)?/>|<${tag}(?:\\s[^>]*)?>`).test(xml)
