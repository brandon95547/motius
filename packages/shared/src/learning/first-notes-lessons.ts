import type { NoteRange } from '../domain/device-schemas.js'
import type { LessonAbout, LessonBuilder } from './lesson-exercise.js'
import { MIDDLE_C } from './lesson-keys.js'
import { songLesson, type Song } from './song-lessons.js'

/*
 * First Notes' lessons, in their own module, loaded the first time one of them
 * opens (`lesson-exercise.ts`).
 *
 * Single notes: what one key can do. Soft and loud, and short and long, on the
 * keys of the right hand's C position, as games, then in a tune.
 *
 * As the books teach it: Alfred Level 1, tone production before any piece —
 * more weight into the key is louder, and the loudness is chosen before the key
 * is played (p. 9); Turner Ex. 1, one note played steadily. The drill teachers
 * use (Cursa, "sound control from day one"): one note five times soft, five
 * loud, then taking turns. Made a game here: the key says how, and a right key
 * played otherwise is told which way to go (`session.ts`).
 *
 * Fingering guide (`~/sites/piano knowledge`, `topics/fingering-rulebook.md`):
 * ground rule 3, the right hand's C position, thumb on middle C.
 */

const RIGHT_HAND = { right: MIDDLE_C } as const

/**
 * Whisper and Shout: middle C soft four times, loud four times, then taking
 * turns; then a call, loud, and its echo, soft, and the other way round.
 */
const WHISPER_AND_SHOUT: Song = {
  id: 'whisper-and-shout',
  title: 'Whisper and Shout',
  subtitle: 'Soft and loud · one key, then a few',
  meter: { beats: 4, beatType: 4 },
  bpm: 72,
  thumbs: RIGHT_HAND,
  naming: 'letter',
  phrases: [
    { hand: 'right', notes: 'C4p C4p C4p C4p', cue: 'Soft: press lightly, from the finger' },
    {
      hand: 'right',
      notes: 'C4f C4f C4f C4f',
      cue: 'Loud: let the weight of your arm go into the key',
    },
    { hand: 'right', notes: 'C4p C4f C4p C4f', cue: 'Now take turns: soft, loud' },
    { hand: 'right', notes: 'E4f D4f C4:2f E4p D4p C4:2p', cue: 'A shout, then its echo' },
    { hand: 'right', notes: 'G4p F4p E4:2p G4f F4f E4:2f', cue: 'The other way round' },
    { hand: 'right', notes: 'C4:4f', cue: 'And one last shout' },
  ],
}

/**
 * Hold It: short notes let go at once, then notes held for two beats and for
 * four, then a few keys with the long ones held.
 */
const HOLD_IT: Song = {
  id: 'hold-it',
  title: 'Hold It',
  subtitle: 'Short and long · let go, or hold',
  meter: { beats: 4, beatType: 4 },
  bpm: 72,
  thumbs: RIGHT_HAND,
  naming: 'letter',
  phrases: [
    { hand: 'right', notes: 'C4 C4 C4 C4', cue: 'Short: play, and let go' },
    { hand: 'right', notes: 'C4:2~ C4:2~', cue: 'Long: hold for two beats' },
    { hand: 'right', notes: 'C4:4~', cue: 'Longer: hold the whole bar' },
    { hand: 'right', notes: 'E4 F4 G4:2~ G4 F4 E4:2~', cue: 'Now a few keys: hold the long ones' },
    { hand: 'right', notes: 'D4 E4 D4:2~ C4:4~', cue: 'And the longest last' },
  ],
}

/**
 * Ode to Joy, Loud and Soft: the tune's first line loud, its second as the soft
 * echo, the long notes at the ends held — as the C position plays it, the right
 * hand only.
 */
const ODE_TO_JOY_ECHO: Song = {
  id: 'ode-to-joy-echo',
  title: 'Ode to Joy, Loud and Soft',
  subtitle: 'Beethoven · a loud line and its soft echo',
  meter: { beats: 4, beatType: 4 },
  bpm: 80,
  thumbs: RIGHT_HAND,
  naming: 'letter',
  phrases: [
    {
      hand: 'right',
      notes: 'E4f E4f F4f G4f G4f F4f E4f D4f C4f C4f D4f E4f E4:1.5f D4:0.5f D4:2f~',
      cue: 'Loud: the weight of your arm',
    },
    {
      hand: 'right',
      notes: 'E4p E4p F4p G4p G4p F4p E4p D4p C4p C4p D4p E4p D4:1.5p C4:0.5p C4:2p~',
      cue: 'The echo: soft, from the fingers',
    },
  ],
}

export const FIRST_NOTES_LESSONS = {
  'whisper-and-shout': (range: NoteRange) => songLesson(WHISPER_AND_SHOUT, range),
  'hold-it': (range: NoteRange) => songLesson(HOLD_IT, range),
  'ode-to-joy-echo': (range: NoteRange) => songLesson(ODE_TO_JOY_ECHO, range),
} as const satisfies Record<string, LessonBuilder>

const RIGHT_THUMB = {
  who: 'Right hand',
  text: 'Thumb on middle C, a finger on each white key up to G. Each key says how to play it.',
} as const

/** Each lesson's introduction: what it asks, as a teacher would say it. */
export const FIRST_NOTES_ABOUT = {
  'whisper-and-shout': {
    objective: 'Make a soft sound and a loud one, on purpose: first on one key, then on a few.',
    how: [RIGHT_THUMB],
    remember:
      'Choose how loud before you press. With a mouse, click near the top of a key for soft, near the bottom for loud.',
  },
  'hold-it': {
    objective: 'Let short notes go at once, and hold long ones until they end.',
    how: [RIGHT_THUMB],
    remember: 'Let go of a long note too soon and it is played again.',
  },
  'ode-to-joy-echo': {
    objective: 'Play Ode to Joy loud, then its echo soft, holding the long notes at the ends.',
    how: [RIGHT_THUMB],
    remember: 'Loud is weight, not speed: the beat stays the same.',
  },
} as const satisfies Record<keyof typeof FIRST_NOTES_LESSONS, LessonAbout>
