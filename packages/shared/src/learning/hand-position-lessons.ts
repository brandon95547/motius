import type { NoteRange } from '../domain/device-schemas.js'
import type { LessonAbout, LessonBuilder } from './lesson-exercise.js'
import { LOW_C, MIDDLE_C } from './lesson-keys.js'
import { HANDS_REMINDER } from './lesson-reminders.js'
import { songLesson, type Song } from './song-lessons.js'

/*
 * Fingers & Hands' lessons, in their own module, loaded the first time one of
 * them opens (`lesson-exercise.ts`).
 *
 * The finger numbers, and the two positions a beginner starts
 * in, each learned by playing a song that fits the position exactly — five
 * white keys side by side under each hand, so the hand never moves and the
 * only thing that changes is which finger plays.
 *
 * The songs are the user's choice (2026-11-21): three to a lesson, every one
 * in the public domain, mostly not nursery tunes. Where one is a folk song, its
 * notes are as the Kodály collection at the University of Redlands transcribes
 * it from its source (a Library of Congress recording, a published collection),
 * moved to C; each says which.
 *
 * Fingering guide (`~/sites/piano knowledge`, `topics/fingering-rulebook.md`):
 * ground rules 1 and 3, and step 1 of the teaching order (§11) — finger numbers
 * and the C five-finger position first, then the other positions, middle C
 * among them. Every finger here is the position's: the key's place counted from
 * the thumb.
 */

/**
 * The right hand's finger numbers, in Goin' Home: the Largo theme of Dvořák's
 * New World Symphony (1893), a melody written in the style of the spirituals.
 * Thumb on middle C, the theme on C, D, E and G — fingers 1, 2, 3 and 5 — with
 * the keys named by finger, not letter: the numbers are the lesson.
 *
 * Fingering guide: ground rule 1 (thumb = 1) and rule 3 (the C position, thumb
 * on middle C). Alfred Level 1 teaches the numbers (p. 9) and then plays in the
 * right hand's C position (p. 14); Turner p. 15.
 */
const GOIN_HOME: Song = {
  id: 'right-hand-finger-numbers',
  title: 'Right hand (1–5)',
  subtitle: 'Goin’ Home · Dvořák · thumb on middle C',
  meter: { beats: 4, beatType: 4 },
  bpm: 60,
  thumbs: { right: MIDDLE_C },
  naming: 'finger',
  phrases: [
    {
      hand: 'right',
      notes: 'E4:1.5 G4:0.5 G4:2 E4:1.5 D4:0.5 C4:2 D4:1.5 E4:0.5 G4:1.5 E4:0.5 D4:4',
      cue: 'Right hand, thumb on middle C. Play the finger each key shows',
    },
    {
      hand: 'right',
      notes: 'E4:1.5 G4:0.5 G4:2 E4:1.5 D4:0.5 C4:2 D4:1.5 E4:0.5 D4:1.5 C4:0.5 C4:4',
      cue: 'The same again, ending on your thumb',
    },
  ],
}

/**
 * The left hand's finger numbers, in When the Saints Go Marching In: 5 on the
 * C below middle C, the thumb on G, every finger used. The numbers mirror the
 * right hand's, so 5 is now the lowest key.
 *
 * Fingering guide: ground rule 1 — "the same number means opposite directions
 * on the keyboard" — and rule 3. Alfred Level 1, the left hand's C position
 * (p. 18); Piano For Dummies p. 182. Learn & Master plays this song from its
 * second session.
 */
const SAINTS: Song = {
  id: 'left-hand-finger-numbers',
  title: 'Left hand (1–5)',
  subtitle: 'When the Saints Go Marching In · little finger on C',
  meter: { beats: 4, beatType: 4 },
  pickup: 3,
  bpm: 76,
  thumbs: { left: LOW_C + 7 },
  naming: 'finger',
  phrases: [
    {
      hand: 'left',
      notes: 'C3 E3 F3 G3:4 -1 C3 E3 F3 G3:4 -1 C3 E3 F3 G3:2 E3:2 C3:2 E3:2 D3:4 -1',
      cue: 'Left hand, little finger on the C below middle C. Play the finger each key shows',
    },
    {
      hand: 'left',
      notes: 'E3 E3 D3 C3:3 C3 E3:2 G3:2 G3 F3:3 -1 E3 F3 G3 E3:2 C3:2 D3:4 C3:4',
      cue: 'Oh Lord, I want to be in that number',
    },
  ],
}

/**
 * The C position in both hands, in Beethoven's Ode to Joy: the left hand plays
 * the first line an octave down, the right hand answers with the second, then
 * carries the tune on, the left hand's thumb taking its one low G. Each hand's
 * finger 1 is its thumb; the left hand's 5 and the right hand's 1 are both on
 * a C. Keys named by letter.
 *
 * Fingering guide: ground rule 3 — a five-finger position named for its lowest
 * right-hand note — and the teaching order's first position. Alfred Level 1:
 * the right hand's C position (p. 14), its first piece Ode to Joy (p. 15), and
 * the left hand's position (p. 18); Piano For Dummies plays it in C position
 * with one low G (p. 153), here the left hand's.
 */
const ODE_TO_JOY: Song = {
  id: 'c-position',
  title: 'C position',
  subtitle: 'Ode to Joy · Beethoven · both hands, C to G',
  meter: { beats: 4, beatType: 4 },
  bpm: 72,
  thumbs: { left: LOW_C + 7, right: MIDDLE_C },
  naming: 'letter',
  phrases: [
    {
      hand: 'left',
      notes: 'E3 E3 F3 G3 G3 F3 E3 D3 C3 C3 D3 E3 E3:1.5 D3:0.5 D3:2',
      cue: 'Left hand first, little finger on the C below middle C',
    },
    {
      hand: 'right',
      notes: 'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4:1.5 C4:0.5 C4:2',
      cue: 'Right hand answers, thumb on middle C',
    },
    {
      hand: 'right',
      notes: 'D4 D4 E4 C4 D4 E4:0.5 F4:0.5 E4 C4 D4 E4:0.5 F4:0.5 E4 D4 C4 D4',
      cue: 'Right hand carries on',
    },
    { hand: 'left', notes: 'G3:2', cue: 'Left thumb: the low G' },
    {
      hand: 'right',
      notes: 'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4:1.5 C4:0.5 C4:2',
      cue: 'And the tune once more',
    },
  ],
}

/**
 * The middle C position, in Amazing Grace: both thumbs on middle C, the left
 * hand over F to C and the right over C to G. The hymn runs from the G below
 * middle C to the G above it, so it needs both hands, the left taking G and A,
 * the right the rest. Keys named by letter.
 *
 * Fingering guide: ground rule 3 ("middle C position has both thumbs sharing
 * middle C") and rule 1 (the numbers mirror). Alfred Level 1, p. 74; the
 * teaching order (§11) puts it after the C position.
 */
const AMAZING_GRACE: Song = {
  id: 'middle-c-position',
  title: 'Middle C position',
  subtitle: 'Amazing Grace · both thumbs on middle C',
  meter: { beats: 3, beatType: 4 },
  pickup: 1,
  bpm: 72,
  thumbs: { left: MIDDLE_C, right: MIDDLE_C },
  naming: 'letter',
  phrases: [
    { hand: 'left', notes: 'G3', cue: 'Both thumbs on middle C. Left hand starts: G' },
    { hand: 'right', notes: 'C4:2 E4:0.5 C4:0.5 E4:2 D4 C4:2' },
    { hand: 'left', notes: 'A3 G3:2 G3' },
    {
      hand: 'right',
      notes: 'C4:2 E4:0.5 C4:0.5 E4:2 D4 G4:3 -2 E4 G4:2 E4:0.5 C4:0.5 E4:2 D4 C4:2',
    },
    { hand: 'left', notes: 'A3 G3:2 G3' },
    { hand: 'right', notes: 'C4:2 E4:0.5 C4:0.5 E4:2 D4 C4:3' },
  ],
}

/**
 * The right hand, in Rousseau's melody: the pantomime tune from his opera Le
 * Devin du village (1752), sung in America as Go Tell Aunt Nancy. As the
 * Kodály collection at the University of Redlands transcribes it from the 1939
 * Library of Congress recording (AFS 2638 B1, Comanche County, Texas), in D,
 * here in C: every finger, the hand still.
 */
const ROUSSEAU: Song = {
  id: 'right-hand-rousseau',
  title: 'Rousseau’s melody',
  subtitle: 'Right hand · Rousseau, 1752',
  meter: { beats: 2, beatType: 4 },
  bpm: 60,
  thumbs: { right: MIDDLE_C },
  naming: 'finger',
  phrases: [
    {
      hand: 'right',
      notes: 'E4 E4:0.5 D4:0.5 C4 C4 D4 D4:0.5 F4:0.5 E4:0.5 D4:0.5 C4',
      cue: 'Right hand, thumb on middle C. Play the finger each key shows',
    },
    {
      hand: 'right',
      notes: 'G4 G4:0.5 F4:0.5 E4 E4:0.75 E4:0.25 D4:0.5 C4:0.5 D4:0.5 E4:0.5 C4:2',
    },
  ],
}

/**
 * The right hand, in the chorus of Jingle Bells (James Lord Pierpont, 1857):
 * on C to G throughout, the thumb on middle C.
 */
const JINGLE_BELLS: Song = {
  id: 'right-hand-jingle-bells',
  title: 'Jingle Bells',
  subtitle: 'Right hand · the chorus · Pierpont, 1857',
  meter: { beats: 4, beatType: 4 },
  bpm: 96,
  thumbs: { right: MIDDLE_C },
  naming: 'finger',
  phrases: [
    {
      hand: 'right',
      notes:
        'E4 E4 E4:2 E4 E4 E4:2 E4 G4 C4:1.5 D4:0.5 E4:4 F4 F4 F4:1.5 F4:0.5 F4 E4 E4 E4:0.5 E4:0.5 E4 D4 D4 E4 D4:2 G4:2',
      cue: 'Right hand, thumb on middle C. Play the finger each key shows',
    },
    {
      hand: 'right',
      notes:
        'E4 E4 E4:2 E4 E4 E4:2 E4 G4 C4:1.5 D4:0.5 E4:4 F4 F4 F4 F4 F4 E4 E4 E4:0.5 E4:0.5 G4 G4 F4 D4 C4:4',
    },
  ],
}

/**
 * The left hand, in A-Working on the Railroad: the Kodály collection's
 * transcription of the 1938 Library of Congress recording (AFS 1637 B2,
 * collected by Alan Lomax), in 6/8 and D, here in C an octave below middle C:
 * a verse, then the chorus.
 */
const RAILROAD: Song = {
  id: 'left-hand-railroad',
  title: 'A-Working on the Railroad',
  subtitle: 'Left hand · a railroad song, 1938',
  meter: { beats: 6, beatType: 8 },
  bpm: 66,
  thumbs: { left: LOW_C + 7 },
  naming: 'finger',
  phrases: [
    {
      hand: 'left',
      notes:
        'E3 E3:0.5 E3:0.5 E3:0.5 D3:0.5 C3 C3:0.5 C3:1.5 D3 D3:0.5 D3 D3:0.5 E3:0.5 E3:0.5 D3:0.5 C3:1.5 G3 G3:0.5 G3 F3:0.5 E3:0.5 E3:0.5 E3:0.5 E3 E3:0.5 D3 C3:0.5 D3 E3:0.5 C3:1.5 C3:1.5',
      cue: 'Left hand, little finger on the C below middle C. Play the finger each key shows',
    },
    {
      hand: 'left',
      notes:
        'E3 E3:0.5 E3 D3:0.5 C3 C3:0.5 C3:1.5 D3 D3:0.5 D3 D3:0.5 E3 D3:0.5 C3:1.5 G3 G3:0.5 G3 F3:0.5 E3 E3:0.5 E3 E3:0.5 D3 C3:0.5 D3 E3:0.5 C3:1.5 C3:1.5',
      cue: 'The chorus',
    },
  ],
}

/**
 * The left hand, in Lightly Row, the German folk song Hänschen klein: every
 * finger, an octave below middle C.
 */
const LIGHTLY_ROW: Song = {
  id: 'left-hand-lightly-row',
  title: 'Lightly Row',
  subtitle: 'Left hand · a German folk song',
  meter: { beats: 4, beatType: 4 },
  bpm: 84,
  thumbs: { left: LOW_C + 7 },
  naming: 'finger',
  phrases: [
    {
      hand: 'left',
      notes: 'G3 E3 E3:2 F3 D3 D3:2 C3 D3 E3 F3 G3 G3 G3:2 G3 E3 E3:2 F3 D3 D3:2 C3 E3 G3 G3 C3:4',
      cue: 'Left hand, little finger on the C below middle C. Play the finger each key shows',
    },
    {
      hand: 'left',
      notes: 'D3 D3 D3 D3 D3 E3 F3:2 E3 E3 E3 E3 E3 F3 G3:2 G3 E3 E3:2 F3 D3 D3:2 C3 E3 G3 G3 C3:4',
    },
  ],
}

/**
 * The C position in both hands, in the chorus of Outshine the Sun: a spiritual
 * as the Kodály collection transcribes it from a 1938 recording (New York), in
 * B♭, here in C. The left hand sings it an octave down, the right hand answers.
 */
const OUTSHINE_THE_SUN: Song = {
  id: 'c-position-outshine-the-sun',
  title: 'Outshine the Sun',
  subtitle: 'C position · a spiritual · the hands in turn',
  meter: { beats: 2, beatType: 4 },
  bpm: 72,
  thumbs: { left: LOW_C + 7, right: MIDDLE_C },
  naming: 'letter',
  phrases: [
    {
      hand: 'left',
      notes: 'C3:0.5 C3 C3:0.5 D3:0.5 D3:0.5 D3 D3:0.5 D3:0.5 E3:0.5 E3:0.5 C3:1.5 -0.5',
      cue: 'Left hand first, little finger on the C below middle C',
    },
    {
      hand: 'right',
      notes: 'C4:0.5 C4 C4:0.5 D4:0.5 D4:0.5 D4 D4:0.5 D4:0.5 E4:0.5 E4:0.5 C4:2',
      cue: 'Right hand answers, thumb on middle C',
    },
  ],
}

/**
 * The C position in both hands, in Love Somebody: an American folk song as
 * the Kodály collection transcribes it, in D, here in C. The hands take two
 * bars each, the left an octave down.
 */
const LOVE_SOMEBODY: Song = {
  id: 'c-position-love-somebody',
  title: 'Love Somebody',
  subtitle: 'C position · an American folk song · the hands in turn',
  meter: { beats: 2, beatType: 4 },
  bpm: 52,
  thumbs: { left: LOW_C + 7, right: MIDDLE_C },
  naming: 'letter',
  phrases: [
    {
      hand: 'left',
      notes: 'C3:0.5 E3:0.5 G3:0.5 G3:0.5 D3:0.5 E3:0.5 F3',
      cue: 'Left hand first, little finger on the C below middle C',
    },
    {
      hand: 'right',
      notes: 'C4:0.5 E4:0.5 G4:0.5 G4:0.5 F4:0.5 E4:0.5 D4',
      cue: 'Right hand, thumb on middle C',
    },
    { hand: 'left', notes: 'C3:0.5 E3:0.5 G3:0.5 G3:0.5 D3:0.5 E3:0.5 F3', cue: 'Left' },
    {
      hand: 'right',
      notes: 'E4:0.5 E4:0.5 D4:0.25 D4:0.25 D4:0.25 D4:0.25 C4:0.5 C4:0.5 C4',
      cue: 'Right',
    },
  ],
}

/**
 * The middle C position, in When the Train Comes Along: a spiritual from St.
 * Helena Island, as Nicholas Ballanta-Taylor published it in St. Helena Island
 * Spirituals (1925) and the Kodály collection transcribes it. It runs from D
 * to A; here from the A below middle C to E, the left hand taking A and B.
 */
const TRAIN: Song = {
  id: 'middle-c-train',
  title: 'When the Train Comes Along',
  subtitle: 'Middle C position · a spiritual, 1925',
  meter: { beats: 4, beatType: 4 },
  pickup: 1,
  bpm: 52,
  thumbs: { left: MIDDLE_C, right: MIDDLE_C },
  naming: 'letter',
  phrases: [
    {
      hand: 'by-pitch',
      notes:
        'A3:0.5 C4:0.5 E4 E4:0.75 D4:0.25 E4 A3:0.5 C4:0.5 E4 D4:0.75 A3:0.25 C4 A3:0.5 C4:0.25 C4:0.25 D4:0.5 D4:0.5 D4:0.5 E4:0.5 D4:0.5 C4:0.5 A3:0.5 A3:0.5 C4 B3:0.75 B3:0.25 A3:2',
      cue: 'Both thumbs on middle C. The left hand plays below it, the right from it',
    },
  ],
}

/**
 * The middle C position, in the verse of Yankee Doodle, the colonial American
 * tune: from the G below middle C to the F above it, the left hand taking G,
 * A and B.
 */
const YANKEE_DOODLE: Song = {
  id: 'middle-c-yankee-doodle',
  title: 'Yankee Doodle',
  subtitle: 'Middle C position · the verse',
  meter: { beats: 2, beatType: 4 },
  bpm: 52,
  thumbs: { left: MIDDLE_C, right: MIDDLE_C },
  naming: 'letter',
  phrases: [
    {
      hand: 'by-pitch',
      notes:
        'C4:0.5 C4:0.5 D4:0.5 E4:0.5 C4:0.5 E4:0.5 D4:0.5 G3:0.5 C4:0.5 C4:0.5 D4:0.5 E4:0.5 C4 B3 C4:0.5 C4:0.5 D4:0.5 E4:0.5 F4:0.5 E4:0.5 D4:0.5 C4:0.5 B3:0.5 G3:0.5 A3:0.5 B3:0.5 C4 C4',
      cue: 'Both thumbs on middle C. The left hand plays below it, the right from it',
    },
  ],
}

export const HAND_POSITION_LESSONS = {
  'right-hand-finger-numbers': (range: NoteRange) => songLesson(GOIN_HOME, range),
  'left-hand-finger-numbers': (range: NoteRange) => songLesson(SAINTS, range),
  'c-position': (range: NoteRange) => songLesson(ODE_TO_JOY, range),
  'middle-c-position': (range: NoteRange) => songLesson(AMAZING_GRACE, range),
  'right-hand-rousseau': (range: NoteRange) => songLesson(ROUSSEAU, range),
  'right-hand-jingle-bells': (range: NoteRange) => songLesson(JINGLE_BELLS, range),
  'left-hand-railroad': (range: NoteRange) => songLesson(RAILROAD, range),
  'left-hand-lightly-row': (range: NoteRange) => songLesson(LIGHTLY_ROW, range),
  'c-position-outshine-the-sun': (range: NoteRange) => songLesson(OUTSHINE_THE_SUN, range),
  'c-position-love-somebody': (range: NoteRange) => songLesson(LOVE_SOMEBODY, range),
  'middle-c-train': (range: NoteRange) => songLesson(TRAIN, range),
  'middle-c-yankee-doodle': (range: NoteRange) => songLesson(YANKEE_DOODLE, range),
} as const satisfies Record<string, LessonBuilder>

/**
 * How each position is played, said once for its songs: the hands on the keys,
 * and the one thing to keep in mind.
 */
const POSITION_HOW = {
  right: {
    how: [
      {
        who: 'Right hand',
        text: 'Thumb on middle C, a finger on each white key up to G. Play the finger each key shows.',
      },
    ],
  },
  left: {
    how: [
      {
        who: 'Left hand',
        text: 'Little finger on the C below middle C, thumb on G. Play the finger each key shows.',
      },
    ],
  },
  c: {
    how: [
      { who: 'Left hand', text: 'Little finger on the C below middle C. You start the tune.' },
      { who: 'Right hand', text: 'Thumb on middle C. You answer, and carry it on.' },
    ],
  },
  'middle-c': {
    how: [
      {
        text: 'Right hand over C to G, left hand over C down to F. The left hand plays the low notes, the right hand the rest.',
      },
    ],
  },
} as const satisfies Record<string, Pick<LessonAbout, 'how'>>

const about = (
  position: keyof typeof POSITION_HOW,
  objective: string,
  narration?: string,
): LessonAbout => ({
  objective,
  ...(narration && { narration }),
  ...POSITION_HOW[position],
  remember: HANDS_REMINDER,
})

/** Finger numbering's songs, three a hand, share one objective and recording per hand (the user, 2026-11-24). */
const right = () =>
  about(
    'right',
    'Learn the basics of the key of C with your right hand.',
    'key-of-c-right-hand.mp3',
  )
const left = () =>
  about('left', 'Learn the basics of the key of C with your left hand.', 'key-of-c-left-hand.mp3')
/** The C position's three songs share one objective and recording too. */
const cPosition = () =>
  about('c', 'Learn the basics of the C position with both hands.', 'c-position.mp3')
/** And the middle C position's, Amazing Grace's words on all three (the user, 2026-11-24). */
const middleCPosition = () =>
  about(
    'middle-c',
    'Play Amazing Grace in the middle C position: both thumbs share middle C.',
    'middle-c-position.mp3',
  )

/** Each song's introduction: what it is, and how its position is played. */
export const HAND_POSITION_ABOUT = {
  'right-hand-finger-numbers': right(),
  'right-hand-rousseau': right(),
  'right-hand-jingle-bells': right(),
  'left-hand-finger-numbers': left(),
  'left-hand-railroad': left(),
  'left-hand-lightly-row': left(),
  'c-position': cPosition(),
  'c-position-outshine-the-sun': cPosition(),
  'c-position-love-somebody': cPosition(),
  'middle-c-position': middleCPosition(),
  'middle-c-train': middleCPosition(),
  'middle-c-yankee-doodle': middleCPosition(),
} as const satisfies Record<keyof typeof HAND_POSITION_LESSONS, LessonAbout>
