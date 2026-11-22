import type { NoteRange } from '../domain/device-schemas.js'
import type { LessonAbout, LessonBuilder } from './lesson-exercise.js'
import { LOW_C, MIDDLE_C } from './lesson-keys.js'
import { songLesson, type Song } from './song-lessons.js'

/*
 * First Notes' lessons, in their own module, loaded the first time one of them
 * opens (`lesson-exercise.ts`).
 *
 * The patterns a tune is made of, played on the keys before they are read on
 * the staff: which way the notes go, then a repeated note, a step and a skip
 * (Faber's Primer words), then the three together in a tune. Alfred Level 1 reads a
 * melody as a starting key and a chain of directions and intervals (pp. 26,
 * 35); Hoffman Academy plays steps and skips on the keys before reading them.
 * How long a note lasts, and how loud, are not judged here: timing comes with
 * the staff (the user, 2026-11-22).
 *
 * Each lesson shows its pattern in short exercises, then a tune known for it.
 * Every key is in a C five-finger position, so the hand never moves.
 *
 * Fingering guide (`~/sites/piano knowledge`, `topics/fingering-rulebook.md`):
 * ground rules 1 and 3, the right hand's C position (thumb on middle C) and
 * the left hand's (little finger on the C below it). Every finger is the
 * position's: the key's place counted from the thumb.
 */

const RIGHT = { right: MIDDLE_C } as const
const BOTH = { left: LOW_C + 7, right: MIDDLE_C } as const
const PATTERN = { meter: { beats: 4, beatType: 4 }, bpm: 80, naming: 'letter' } as const

/** Which way notes go: up is to the right and higher, down to the left and lower. */
const WHICH_WAY: Song = {
  id: 'which-way-notes-go',
  title: 'Which way notes go',
  subtitle: 'Up and down · each hand in C position',
  ...PATTERN,
  thumbs: BOTH,
  phrases: [
    { hand: 'right', notes: 'C4 D4 E4 F4 G4:4', cue: 'Up: each key to the right, higher' },
    { hand: 'right', notes: 'G4 F4 E4 D4 C4:4', cue: 'Down: each key to the left, lower' },
    { hand: 'right', notes: 'C4 D4 E4 D4 C4:4', cue: 'Up, then back down' },
    { hand: 'right', notes: 'G4 F4 E4 F4 G4:4', cue: 'Down, then back up' },
    { hand: 'left', notes: 'C3 D3 E3 F3 G3:4', cue: 'Left hand: up, from the little finger' },
    { hand: 'left', notes: 'G3 F3 E3 D3 C3:4', cue: 'And down, from the thumb' },
  ],
}

/** Repeated notes: the same key again, the hand still. Then Hot Cross Buns. */
const REPEATED: Song = {
  id: 'repeated-notes',
  title: 'Repeated notes',
  subtitle: 'The same key again · then Hot Cross Buns',
  ...PATTERN,
  thumbs: RIGHT,
  phrases: [
    { hand: 'right', notes: 'C4 C4 C4 C4', cue: 'A repeat: the same key again' },
    { hand: 'right', notes: 'E4 E4 E4 E4 G4 G4 G4 G4', cue: 'Nothing moves but the finger' },
    { hand: 'right', notes: 'E4 E4 D4 D4 C4 C4 C4:2', cue: 'Two of each, going down' },
    {
      hand: 'right',
      notes:
        'E4 D4 C4:2 E4 D4 C4:2 C4:0.5 C4:0.5 C4:0.5 C4:0.5 D4:0.5 D4:0.5 D4:0.5 D4:0.5 E4 D4 C4:2',
      cue: 'Hot Cross Buns: listen for the repeats',
    },
  ],
}

/** Steps: from a key to the one beside it, a finger to the next. Then Mary Had a Little Lamb. */
const STEPS: Song = {
  id: 'steps',
  title: 'Steps',
  subtitle: 'The next key, the next finger · then Mary Had a Little Lamb',
  ...PATTERN,
  thumbs: RIGHT,
  phrases: [
    { hand: 'right', notes: 'C4 D4 C4 D4', cue: 'A step: the very next key' },
    { hand: 'right', notes: 'E4 F4 E4 F4 G4 F4 E4:2', cue: 'Up a step, down a step' },
    { hand: 'right', notes: 'C4 D4 E4 F4 G4 F4 E4 D4 C4:4', cue: 'Step all the way up and back' },
    {
      hand: 'right',
      notes:
        'E4 D4 C4 D4 E4 E4 E4:2 D4 D4 D4:2 E4 G4 G4:2 E4 D4 C4 D4 E4 E4 E4 E4 D4 D4 E4 D4 C4:4',
      cue: 'Mary Had a Little Lamb: steps and repeats, and one skip',
    },
  ],
}

/** Skips: over one key to the next but one, missing a finger out. Then Frère Jacques. */
const SKIPS: Song = {
  id: 'skips',
  title: 'Skips',
  subtitle: 'Miss out a key · then Frère Jacques',
  ...PATTERN,
  thumbs: RIGHT,
  phrases: [
    { hand: 'right', notes: 'C4 E4 C4 E4', cue: 'A skip: over one key, missing a finger' },
    { hand: 'right', notes: 'D4 F4 D4 F4', cue: 'Skip from D' },
    { hand: 'right', notes: 'E4 G4 E4 G4', cue: 'And from E' },
    { hand: 'right', notes: 'C4 E4 G4 E4 C4:4', cue: 'Skip up to G and back' },
    {
      hand: 'right',
      notes: 'C4 D4 E4 C4 C4 D4 E4 C4 E4 F4 G4:2 E4 F4 G4:2',
      cue: 'Frère Jacques: steps, and a skip back down',
    },
  ],
}

/**
 * Combining patterns: Au clair de la lune, its first two lines, which has every
 * pattern in it. The first time, each bit says which pattern it is; the second
 * time, the tune whole, the patterns found by the player; then the left hand.
 */
const COMBINING: Song = {
  id: 'combining-patterns',
  title: 'Combining patterns',
  subtitle: 'Au clair de la lune · repeats, steps and a skip',
  ...PATTERN,
  thumbs: BOTH,
  phrases: [
    { hand: 'right', notes: 'C4 C4 C4', cue: 'Au clair de la lune. Repeats: C, C, C' },
    { hand: 'right', notes: 'D4 E4:2', cue: 'Steps up: D, then E' },
    { hand: 'right', notes: 'D4:2 C4', cue: 'Steps down: D, then C' },
    { hand: 'right', notes: 'E4', cue: 'A skip up to E' },
    { hand: 'right', notes: 'D4 D4', cue: 'A step down, and a repeat' },
    { hand: 'right', notes: 'C4:4', cue: 'A step down, home to C' },
    {
      hand: 'right',
      notes: 'C4 C4 C4 D4 E4:2 D4:2 C4 E4 D4 D4 C4:4',
      cue: 'Again, the whole line: find the patterns yourself',
    },
    {
      hand: 'left',
      notes: 'C3 C3 C3 D3 E3:2 D3:2 C3 E3 D3 D3 C3:4',
      cue: 'Now the left hand: the same patterns, lower',
    },
  ],
}

export const FIRST_NOTES_LESSONS = {
  'which-way-notes-go': (range: NoteRange) => songLesson(WHICH_WAY, range),
  'repeated-notes': (range: NoteRange) => songLesson(REPEATED, range),
  steps: (range: NoteRange) => songLesson(STEPS, range),
  skips: (range: NoteRange) => songLesson(SKIPS, range),
  'combining-patterns': (range: NoteRange) => songLesson(COMBINING, range),
} as const satisfies Record<string, LessonBuilder>

const RIGHT_HAND = {
  who: 'Right hand',
  text: 'Thumb on middle C, a finger on each white key up to G.',
} as const
const LEFT_HAND = {
  who: 'Left hand',
  text: 'Little finger on the C below middle C, thumb on G.',
} as const

/** Each lesson's introduction: what it asks, as a teacher would say it. */
export const FIRST_NOTES_ABOUT = {
  'which-way-notes-go': {
    objective: 'Notes go up to the right and down to the left. Play up and down in each hand.',
    how: [RIGHT_HAND, LEFT_HAND],
    remember: 'Up is higher, down is lower, whichever hand plays.',
  },
  'repeated-notes': {
    objective: 'Play the same key again, then Hot Cross Buns, which is full of repeats.',
    how: [RIGHT_HAND],
    remember: 'On a repeat the hand stays still: only the finger lifts and plays again.',
  },
  steps: {
    objective: 'Step from a key to the one beside it, then play Mary Had a Little Lamb.',
    how: [RIGHT_HAND],
    remember: 'A step is the next key, and the next finger.',
  },
  skips: {
    objective: 'Skip over a key to the next but one, then play the start of Frère Jacques.',
    how: [RIGHT_HAND],
    remember: 'A skip misses out one key, and one finger.',
  },
  'combining-patterns': {
    objective:
      'Find the repeats, steps and skip in Au clair de la lune, a French song, as you play it in each hand.',
    how: [RIGHT_HAND, LEFT_HAND],
    remember: 'Each move is one of three: the same key, the next key, or one over.',
  },
} as const satisfies Record<keyof typeof FIRST_NOTES_LESSONS, LessonAbout>
