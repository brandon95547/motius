import type { NoteRange } from '../domain/device-schemas.js'
import type { LessonAbout, LessonBuilder } from './lesson-exercise.js'
import { LOW_C, MIDDLE_C } from './lesson-keys.js'
import { HANDS_REMINDER } from './lesson-reminders.js'
import { noteOf, songLesson, type Phrase, type Song } from './song-lessons.js'

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
  title: 'Both Hands on C',
  subtitle: 'Both hands on C · the five keys, C to G',
  ...IN_C,
  phrases: [
    { hand: 'right', notes: 'C4 D4 E4 F4 G4:4', cue: 'Right hand: C, D, E, F, G' },
    { hand: 'left', notes: 'C3 D3 E3 F3 G3:4', cue: 'Left hand: C, D, E, F, G' },
  ],
}

/**
 * Steps and skips, in the same five keys: a step to the next key, a skip over
 * one. C, E and G in skips is the sound of the key of C, and pattern 1's C to
 * E is one (the user, 2026-11-25, from the books' reading by interval).
 */
const STEPS_AND_SKIPS: Song = {
  id: 'steps-and-skips',
  title: 'Steps and Skips: Key of C',
  subtitle: 'Steps C, D, E · skips C, E, G',
  ...IN_C,
  phrases: [
    { hand: 'right', notes: 'C4 D4 E4 D4 C4:4', cue: 'Right hand steps: C, D, E and back' },
    { hand: 'right', notes: 'C4 E4 G4 E4 C4:4', cue: 'Right hand skips: C, E, G and back' },
    { hand: 'left', notes: 'C3 E3 G3 E3 C3:4', cue: 'Left hand skips: C, E, G and back' },
  ],
}

/**
 * Steps and skips mixed: all five keys one at a time, as the hands on C
 * played them, and the skips back, then the other way round (the user,
 * 2026-11-25).
 */
const MIXING_STEPS_AND_SKIPS: Song = {
  id: 'mixing-steps-and-skips',
  title: 'Mixing Steps and Skips: Key of C',
  subtitle: 'Up in steps, down in skips, then the opposite',
  ...IN_C,
  phrases: [
    {
      hand: 'right',
      notes: 'C4 D4 E4 F4 G4 E4 C4:2',
      cue: 'Right hand: up in steps, down in skips',
    },
    {
      hand: 'right',
      notes: 'C4 E4 G4 F4 E4 D4 C4:2',
      cue: 'Right hand: up in skips, down in steps',
    },
    { hand: 'left', notes: 'C3 D3 E3 F3 G3 E3 C3:2', cue: 'Left hand: up in steps, down in skips' },
    { hand: 'left', notes: 'C3 E3 G3 F3 E3 D3 C3:2', cue: 'Left hand: up in skips, down in steps' },
  ],
}

const WHITE = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const

/** The white key `by` letters from `at` (`C4` and 2 make `E4`; -2, `A3`). */
const whiteKey = (at: string, by: number) => {
  const index = WHITE.indexOf(at[0] as (typeof WHITE)[number]) + Number(at.slice(1)) * 7 + by
  return `${WHITE[((index % 7) + 7) % 7]}${Math.floor(index / 7)}`
}

/**
 * The skips pattern, fingers 1 3 5 3 1, moved one white key at a time, the
 * thumb on the key each starts from: the right hand from middle C up to G,
 * then the left from its C position's G down to C (the user, 2026-11-25, from
 * Faber's Primer Technique & Artistry, where a pattern moves this way).
 */
const moved = (hand: 'right' | 'left', from: string): Phrase[] => {
  const way = hand === 'right' ? 1 : -1
  return [0, 1, 2, 3, 4].map((moves) => {
    const one = whiteKey(from, moves * way)
    const [three, five] = [whiteKey(one, 2 * way), whiteKey(one, 4 * way)]
    return {
      hand,
      thumb: noteOf(one),
      notes: `${one} ${three} ${five} ${three} ${one}:2 -2`,
      cue: `${hand === 'right' ? 'Right' : 'Left'} hand: thumb on ${one[0]}`,
    }
  })
}

const MOVING_THE_PATTERN: Song = {
  id: 'moving-the-pattern',
  title: 'Same Pattern, Any Key',
  subtitle: 'The skips pattern, a key higher each time, then lower',
  ...IN_C,
  phrases: [...moved('right', 'C4'), ...moved('left', 'G3')],
}

/** The right hand's last key in each pattern; the rest never changes. */
type LastKey = 'D' | 'E' | 'F'

/**
 * A pattern played: left C, left G, right C, then the right hand's last key,
 * one key at a time, four times round unless told otherwise.
 */
const played = (number: number, last: LastKey, rounds = 4): Phrase => ({
  hand: 'by-pitch',
  notes: Array<string>(rounds).fill(`C3 G3 C4 ${last}4`).join(' '),
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

/**
 * All four together, the whole melody, mixed up: each pattern twice, so 1 and
 * 2 make four rounds, then 1 and 4 another four (the user, 2026-11-22).
 */
const WHOLE_MELODY: Song = {
  id: 'whole-melody',
  title: 'Your First Melody: Key of C',
  subtitle: 'The whole melody, each pattern twice',
  ...IN_C,
  phrases: [played(1, 'E', 2), played(2, 'D', 2), played(1, 'E', 2), played(4, 'F', 2)],
}

export const FIRST_NOTES_LESSONS = {
  'hands-on-c': (range: NoteRange) => songLesson(HANDS_ON_C, range),
  'steps-and-skips': (range: NoteRange) => songLesson(STEPS_AND_SKIPS, range),
  'mixing-steps-and-skips': (range: NoteRange) => songLesson(MIXING_STEPS_AND_SKIPS, range),
  'moving-the-pattern': (range: NoteRange) => songLesson(MOVING_THE_PATTERN, range),
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
    narration: 'put-both-hands-on-c.mp3',
    how: [
      { who: 'Right hand', text: 'Put your thumb on middle C. Then play C, D, E, F, G.' },
      {
        who: 'Left hand',
        text: 'Put your pinky on the C below middle C. Then play C, D, E, F, G.',
      },
    ],
    remember: HANDS_REMINDER,
  },
  'steps-and-skips': {
    objective:
      'A step moves to the next key, and a skip jumps over one. Play C, D, E in steps, then C, E, G in skips: the sound of the key of C.',
    narration: 'steps-and-skips.mp3',
    how: [
      {
        who: 'Right hand',
        text: 'Thumb on middle C. Step C, D, E and back, then skip C, E, G and back.',
      },
      { who: 'Left hand', text: 'Pinky on the C below middle C. Skip C, E, G and back.' },
    ],
    remember: HANDS_REMINDER,
  },
  'mixing-steps-and-skips': {
    objective: 'Play up to G one key at a time, then skip back down to C. Then do the opposite.',
    narration: 'mixing-steps-and-skips.mp3',
    how: [
      {
        who: 'Right hand',
        text: 'Thumb on middle C. Step up to G and skip back down, then skip up and step back down.',
      },
      {
        who: 'Left hand',
        text: 'Pinky on the C below middle C. The same, up in steps and down in skips, then the opposite.',
      },
    ],
    remember: HANDS_REMINDER,
  },
  'moving-the-pattern': {
    objective:
      'A pattern can start on any key. Play C, E, G and back, then play the same pattern from D, E, F and G.',
    narration: 'same-pattern-any-key.mp3',
    how: [
      {
        who: 'Right hand',
        text: 'Thumb on middle C. Skip C, E, G and back, then start again one key higher, up to G.',
      },
      {
        who: 'Left hand',
        text: 'Thumb on G. Skip G, E, C and back, then start again one key lower, down to C.',
      },
    ],
    remember: HANDS_REMINDER,
  },
  'pattern-1': {
    objective:
      'Play C and G with your left hand, then the same C one octave higher and E with your right. That’s pattern 1 in the key of C.',
    narration: 'pattern-1.mp3',
    how: [
      LEFT_HAND,
      { who: 'Right hand', text: 'Thumb on middle C, middle finger on E. Play C, then E.' },
    ],
    remember: HANDS_REMINDER,
  },
  'pattern-2': {
    objective:
      'Play pattern 2. It’s just like pattern 1, but your right hand ends on D instead of E.',
    narration: 'pattern-2.mp3',
    how: [
      LEFT_HAND,
      { who: 'Right hand', text: 'Thumb on middle C, pointer finger on D. Play C, then D.' },
    ],
    remember: HANDS_REMINDER,
  },
  'patterns-1-and-2': {
    objective:
      'Play pattern 1, then pattern 2. Your left hand stays the same, and only your right hand’s last note changes.',
    narration: 'patterns-1-and-2.mp3',
    how: [
      LEFT_HAND,
      {
        who: 'Right hand',
        text: 'Thumb on middle C. Play C, then E for pattern 1, and C, then D for pattern 2.',
      },
    ],
    remember: HANDS_REMINDER,
  },
  'pattern-4': {
    objective: 'Play pattern 4. This time your right hand ends on F.',
    narration: 'pattern-4.mp3',
    how: [
      LEFT_HAND,
      { who: 'Right hand', text: 'Thumb on middle C, ring finger on F. Play C, then F.' },
    ],
    remember: HANDS_REMINDER,
  },
  'whole-melody': {
    objective: 'Put the patterns together: You’re playing your first melody in the key of C.',
    narration: 'whole-melody.mp3',
    how: [
      LEFT_HAND,
      {
        who: 'Right hand',
        text: 'Thumb on middle C. Play C, then E, D, E or F, pattern by pattern.',
      },
    ],
    remember: HANDS_REMINDER,
    // Then faster, from 72 (the user, 2026-11-22).
    tempoChallenge: 92,
  },
} as const satisfies Record<keyof typeof FIRST_NOTES_LESSONS, LessonAbout>
