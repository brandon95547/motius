import type { NoteRange } from '../domain/device-schemas.js'
import type { LessonAbout, LessonBuilder } from './lesson-exercise.js'
import { LOW_C, MIDDLE_C } from './lesson-keys.js'
import { songLesson, type Phrase, type Song } from './song-lessons.js'

/*
 * First Notes' lessons, in their own module, loaded the first time one of them
 * opens (`lesson-exercise.ts`).
 *
 * A first melody in C, built pattern by pattern (the user's design,
 * 2026-11-22, after a YouTube lesson that builds one this way). It starts with
 * the hands: the right thumb on middle C and the left pinky on the C below,
 * each playing the five keys under it, C to G. Then the first song, pattern 1:
 * the left hand's C and G, then the right hand's C and E, one key at a time.
 * The next patterns follow from here.
 *
 * Fingering guide (`~/sites/piano knowledge`, `topics/fingering-rulebook.md`):
 * ground rules 1 and 3, both hands in C position. Every finger is the
 * position's: the key's place counted from the thumb.
 */

const IN_C = {
  meter: { beats: 4, beatType: 4 },
  bpm: 72,
  thumbs: { left: LOW_C + 7, right: MIDDLE_C },
  naming: 'letter',
} as const

/** The hands on C, and the five keys under each, one at a time. */
const HANDS_ON_C: Song = {
  id: 'hands-on-c',
  title: 'Play in the Key of C',
  subtitle: 'Both hands on C · the five keys, C to G',
  ...IN_C,
  phrases: [
    { hand: 'right', notes: 'C4 D4 E4 F4 G4:4', cue: 'Right hand: C, D, E, F, G' },
    { hand: 'left', notes: 'C3 D3 E3 F3 G3:4', cue: 'Left hand: C, D, E, F, G' },
  ],
}

/** The right hand's last key in each pattern; the rest never changes. */
type LastKey = 'D' | 'E' | 'F'

/**
 * A pattern played: left C, left G, right C, then the right hand's last key,
 * one key at a time, four times round.
 */
const played = (number: number, last: LastKey): Phrase => ({
  hand: 'by-pitch',
  notes: Array<string>(4).fill(`C3 G3 C4 ${last}4`).join(' '),
  cue: `Pattern ${number}: left hand C, G, then right hand C, ${last}`,
})

/** A pattern's own lesson. Only the last key changes from one to the next. */
const pattern = (number: number, last: LastKey): Song => ({
  id: `pattern-${number}`,
  title: `Pattern ${number}: Key of C`,
  subtitle: `Left hand C, G · right hand C, ${last}`,
  ...IN_C,
  phrases: [played(number, last)],
})

/** The first song: the right hand's last key E, with the middle finger. */
const PATTERN_1 = pattern(1, 'E')
/** The same, with the pointer finger on D. */
const PATTERN_2 = pattern(2, 'D')
/** The ring finger on F: the pattern that finishes the melody. */
const PATTERN_4 = pattern(4, 'F')
/** Patterns 1 and 2, four times each, one after the other: the start of the melody. */
const PATTERNS_1_AND_2: Song = {
  id: 'patterns-1-and-2',
  title: 'Patterns 1 and 2: Key of C',
  subtitle: 'Pattern 1 four times, then pattern 2',
  ...IN_C,
  phrases: [played(1, 'E'), played(2, 'D')],
}

/** All four together, four times each: patterns 1, 2, 1 and 4, the whole melody. */
const WHOLE_MELODY: Song = {
  id: 'whole-melody',
  title: 'Patterns 1, 2, 1 and 4: Key of C',
  subtitle: 'The whole melody, each pattern four times',
  ...IN_C,
  phrases: [played(1, 'E'), played(2, 'D'), played(1, 'E'), played(4, 'F')],
}

export const FIRST_NOTES_LESSONS = {
  'hands-on-c': (range: NoteRange) => songLesson(HANDS_ON_C, range),
  'pattern-1': (range: NoteRange) => songLesson(PATTERN_1, range),
  'pattern-2': (range: NoteRange) => songLesson(PATTERN_2, range),
  'patterns-1-and-2': (range: NoteRange) => songLesson(PATTERNS_1_AND_2, range),
  'pattern-4': (range: NoteRange) => songLesson(PATTERN_4, range),
  'whole-melody': (range: NoteRange) => songLesson(WHOLE_MELODY, range),
} as const satisfies Record<string, LessonBuilder>

/** The left hand's part, the same in every pattern. */
const LEFT_HAND = { who: 'Left hand', text: 'Pinky on C, thumb on G. Play C, then G.' } as const

/** Each lesson's introduction: what it asks, as a teacher would say it. */
export const FIRST_NOTES_ABOUT = {
  'hands-on-c': {
    objective: 'Put both hands on C, then play the five keys under each hand.',
    how: [
      { who: 'Right hand', text: 'Put your thumb on middle C. Then play C, D, E, F, G.' },
      {
        who: 'Left hand',
        text: 'Put your pinky on the C below middle C. Then play C, D, E, F, G.',
      },
    ],
    remember: 'One finger for each key, one key at a time.',
  },
  'pattern-1': {
    objective: 'Play your first song: C and G with your left hand, then C and E with your right.',
    how: [
      LEFT_HAND,
      { who: 'Right hand', text: 'Thumb on middle C, middle finger on E. Play C, then E.' },
    ],
    remember: 'One key at a time: left C, left G, right C, right E.',
  },
  'pattern-2': {
    objective: 'Play pattern 2: C and G with your left hand, then C and D with your right.',
    how: [
      LEFT_HAND,
      { who: 'Right hand', text: 'Thumb on middle C, pointer finger on D. Play C, then D.' },
    ],
    remember: 'Only the last key changes from pattern 1: D instead of E.',
  },
  'patterns-1-and-2': {
    objective: 'Play pattern 1, then pattern 2: the start of the melody.',
    how: [
      LEFT_HAND,
      {
        who: 'Right hand',
        text: 'Thumb on middle C. Play C, then E for pattern 1, and C, then D for pattern 2.',
      },
    ],
    remember:
      'Four times each: the middle finger for pattern 1, then the pointer finger for pattern 2.',
  },
  'pattern-4': {
    objective: 'Play pattern 4: C and G with your left hand, then C and F with your right.',
    how: [
      LEFT_HAND,
      { who: 'Right hand', text: 'Thumb on middle C, ring finger on F. Play C, then F.' },
    ],
    remember: 'Only the last key changes again: F, with your ring finger.',
  },
  'whole-melody': {
    objective: 'Play the whole melody: patterns 1, 2, 1 and 4, four times each.',
    how: [
      LEFT_HAND,
      {
        who: 'Right hand',
        text: 'Thumb on middle C. Play C, then E, D, E or F, pattern by pattern.',
      },
    ],
    remember: 'Pattern 1 comes back after pattern 2, and pattern 4 ends the melody.',
  },
} as const satisfies Record<keyof typeof FIRST_NOTES_LESSONS, LessonAbout>
