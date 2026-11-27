import type { NoteRange } from '../domain/device-schemas.js'
import type { Hand } from '../music/fingering.js'
import type { Exercise, ExerciseStep } from './exercise.js'
import type { LessonAbout, LessonBuilder } from './lesson-exercise.js'
import { MIDDLE_C } from './lesson-keys.js'

/*
 * Intervals' lessons, in their own module, loaded the first time one of them
 * opens (`lesson-exercise.ts`).
 *
 * The unit starts by ear, as Faber's primer does (Theory book p. 7: the
 * teacher plays, the child says higher or lower) and as Hargrave would have
 * it: an interval is heard before it is named. Which way is higher on the keys
 * is Piano Foundations' to teach (Left and right); here it is heard.
 */

/** The second note of each question, from middle C: wide gaps first, then nearer, up and down mixed. */
const HIGH_OR_LOW = [
  MIDDLE_C + 12, // an octave up
  MIDDLE_C - 12, // an octave down
  MIDDLE_C - 7, // a fifth down
  MIDDLE_C + 7, // a fifth up
  MIDDLE_C + 4, // a third up
  MIDDLE_C - 3, // a third down
  MIDDLE_C + 2, // a step up
  MIDDLE_C - 1, // a half step down, the nearest of all
]

/**
 * High or low: the app plays middle C and then another note, and the player
 * answers on the keys, any key to the right of middle C for higher and any
 * to the left for lower. Middle C stays marked as the line between the two.
 */
function highOrLow(range: NoteRange): Exercise {
  const steps: ExerciseStep[] = HIGH_OR_LOW.map((second, index) => {
    const higher = second > MIDDLE_C
    return {
      id: `question-${index + 1}`,
      notes: [],
      fingers: [],
      // Named by number, not by its answer: the label is read out (the staff's, a screen reader's).
      label: `Question ${index + 1}`,
      prompt: [MIDDLE_C, second],
      answer: higher
        ? { from: MIDDLE_C + 1, to: range.high }
        : { from: range.low, to: MIDDLE_C - 1 },
      landmark: MIDDLE_C,
      ask: 'Higher? A key to the right\nLower? A key to the left',
    }
  })
  return {
    id: 'lesson:high-or-low',
    kind: 'exercise',
    title: 'High or low?',
    subtitle: 'Hear two notes, then answer on the keys',
    steps,
    pitchClasses: [],
    rootPitchClass: null,
    pitchNames: { 0: 'C' },
    notes: [],
    keyFifths: null,
    facts: [{ label: 'Questions', value: String(steps.length) }],
    fingerings: [],
    defaultBpm: 72,
    stepsAre: 'questions',
    waits: true,
  }
}

/** C position's five keys, from middle C: the keys First Notes put under the right hand. */
const C_POSITION = [MIDDLE_C, MIDDLE_C + 2, MIDDLE_C + 4, MIDDLE_C + 5, MIDDLE_C + 7]
const [C, D, E, F, G] = C_POSITION as [number, number, number, number, number]

/** A note to find after middle C: far from it first, then nearer, and once C itself. */
const TO_FIND = [G, E, D, F, C]

/** Tunes to play back, each from middle C: steps, then skips, then both, as First Notes played them. */
const TO_ECHO = [
  [C, D, E],
  [C, D, C],
  [C, E, G],
  [C, E, G, E, C],
]

/**
 * Pitch recognition: the app plays middle C and then a note of C position, and
 * the player finds it on the keys, told Higher or Lower after a wrong key.
 * Then short tunes from middle C, played back a note at a time. Middle C is
 * the note every question is heard against: no one can name a note from
 * nothing, but anyone can hear how far it is from one they know.
 */
function pitchRecognition(): Exercise {
  const steps: ExerciseStep[] = []
  const ask = (prompt: readonly number[], note: number, says: string) =>
    steps.push({
      // Named by number, not by its answer: the label is read out.
      id: `question-${steps.length + 1}`,
      notes: [],
      fingers: [],
      label: `Question ${steps.length + 1}`,
      prompt,
      answer: { from: note, to: note },
      landmark: MIDDLE_C,
      ask: says,
    })
  for (const note of TO_FIND) ask([C, note], note, 'Play the second note')
  for (const tune of TO_ECHO) {
    // One prompt for the whole tune: it plays once, and is answered a note a step.
    tune.forEach((note, at) => ask(tune, note, at === 0 ? 'Play it back' : 'Next note'))
  }
  return {
    id: 'lesson:pitch-recognition',
    kind: 'exercise',
    title: 'Pitch recognition',
    subtitle: 'Find the note you hear, then play tunes back',
    steps,
    pitchClasses: [],
    rootPitchClass: null,
    pitchNames: { 0: 'C' },
    notes: [],
    keyFifths: null,
    facts: [
      { label: 'Notes to find', value: String(TO_FIND.length) },
      { label: 'Tunes', value: String(TO_ECHO.length) },
    ],
    fingerings: [],
    defaultBpm: 72,
    stepsAre: 'notes',
    waits: true,
  }
}

/** Every key's name, the black keys by their sharps: a half step up is a sharp. */
const SHARP_NAMES: Readonly<Record<number, string>> = {
  0: 'C',
  1: 'C♯',
  2: 'D',
  3: 'D♯',
  4: 'E',
  5: 'F',
  6: 'F♯',
  7: 'G',
  8: 'G♯',
  9: 'A',
  10: 'A♯',
  11: 'B',
}
const nameOf = (note: number) => SHARP_NAMES[note % 12]!

/** The A below middle C, where the first walk through the letters starts. */
const LOW_A = MIDDLE_C - 3
/** The G above middle C, where it turns. */
const HIGH_G = MIDDLE_C + 7

/** What a walk says on the way, by pitch class: going up, and coming back down. */
interface Cues {
  up: Readonly<Record<number, string>>
  down: Readonly<Record<number, string>>
}

/**
 * The half steps' cues: what a half step is, the two places where the next key
 * is white (every source: B to C and E to F), and where to turn.
 */
const HALF_STEP_CUES: Cues = {
  up: {
    9: 'Each key is the very next one: a half step',
    11: 'No black key here: the next key is white',
    4: 'The other place with no black key between',
  },
  down: {
    7: 'Now back down, a half step at a time',
    5: 'No black key between F and E',
    0: 'None between C and B either',
  },
}

/**
 * The whole steps' cues: a whole step skips one key, and the two places where
 * the key skipped is white, so the step lands on a black key (B to C♯, D♯ to F).
 */
const WHOLE_STEP_CUES: Cues = {
  up: {
    9: 'Skip one key each time: a whole step',
    11: 'Skip C, a white key, to land on C♯',
    3: 'Skip E, a white key, to land on F',
  },
  down: {
    7: 'Now back down, a whole step at a time',
    5: 'Skip E, to land on D♯',
    1: 'Skip C, to land on B',
  },
}

/** Which walk: the one around middle C, an octave lower, or an octave higher. */
type Octave = -1 | 0 | 1
const OCTAVE_TITLES = { 0: '', [-1]: ': one octave lower', 1: ': one octave higher' }
const OCTAVE_IDS = { 0: '', [-1]: '-lower', 1: '-higher' }

/** A walk by one size of step: its lesson's name, how many keys a step moves, and what it says. */
interface Walk {
  id: 'half-steps' | 'whole-steps'
  title: string
  subtitle: string
  keys: 1 | 2
  value: string
  cues: Cues
}
const HALF_STEPS: Walk = {
  id: 'half-steps',
  title: 'Half steps',
  subtitle: 'The very next key, black or white',
  keys: 1,
  value: 'A to G and back, every key',
  cues: HALF_STEP_CUES,
}
const WHOLE_STEPS: Walk = {
  id: 'whole-steps',
  title: 'Whole steps',
  subtitle: 'Skip one key, black or white',
  keys: 2,
  value: 'A to G and back, every other key',
  cues: WHOLE_STEP_CUES,
}

/**
 * A walk through the letters A to G and back down, a half step or a whole step
 * at a time: every move the same size, and the places where the keyboard's
 * pattern changes come up each way. A whole step from A lands on G as a half
 * step does (A, B, C♯, D♯, F, G). Practice is the same walk without the
 * guidance. Then the same an octave lower, in the left hand, which plays below
 * middle C, and an octave higher. A key the keyboard does not have is left out.
 *
 * One finger for every key, on purpose (the user, 2026-11-26): this is no scale
 * to be fingered as one, only the step, and one finger says so.
 */
function stepWalk(range: NoteRange, walk: Walk, octave: Octave): Exercise {
  const low = LOW_A + 12 * octave
  const high = HIGH_G + 12 * octave
  const hand: Hand = octave < 0 ? 'left' : 'right'
  const { up, down } = walk.cues
  const steps: ExerciseStep[] = []
  const play = (note: number, cue?: string) => {
    if (note < range.low || note > range.high) return
    steps.push({
      id: `${note}-${steps.length}`,
      notes: [note],
      fingers: [{ finger: 3, hand, ...(cue && { cue }) }],
      label: nameOf(note),
    })
  }
  for (let note = low; note <= high; note += walk.keys)
    play(note, (note === high ? down : up)[note % 12])
  for (let note = high - walk.keys; note >= low; note -= walk.keys) play(note, down[note % 12])
  const played = steps.flatMap((step) => step.notes)
  return {
    id: `lesson:${walk.id}${OCTAVE_IDS[octave]}`,
    kind: 'exercise',
    title: `${walk.title}${OCTAVE_TITLES[octave]}`,
    subtitle: walk.subtitle,
    steps,
    pitchClasses: [...new Set(played.map((note) => note % 12))].sort((a, b) => a - b),
    rootPitchClass: null,
    pitchNames: SHARP_NAMES,
    notes: played,
    keyFifths: null,
    facts: [{ label: 'Walk', value: walk.value }],
    fingerings: [{ hand, fingers: [3], source: 'derived', perStep: 1 }],
    defaultBpm: 72,
  }
}

/** The letters of C position, from middle C, for counting aloud. */
const C_LETTERS = ['C', 'D', 'E', 'F', 'G']
const SIZE_NAMES = ['', '', '2nd', '3rd', '4th', '5th']
const COUNT_WORDS = ['', '', 'two', 'three', 'four', 'five']

/**
 * Counting intervals: an interval's number is how many letters it spans,
 * counting both notes, the first and the last (every source; Alfred reads it
 * as white keys skipped, one fewer). In C position, a pair at a time: middle
 * C and each key up to G, a 2nd to a 5th, then G and each key down to C. As
 * each second note is played, its letters are counted out. The fingers are C
 * position's own, thumb on C: only 2nds to 5ths fit under the hand, so the
 * wider sizes wait for Interval sizes.
 */
function countingIntervals(): Exercise {
  const steps: ExerciseStep[] = []
  const play = (at: number, cue?: string) =>
    steps.push({
      id: `${C_POSITION[at]}-${steps.length}`,
      notes: [C_POSITION[at]!],
      fingers: [{ finger: at + 1, hand: 'right', ...(cue && { cue }) }],
      label: C_LETTERS[at]!,
    })
  const counted = (from: number, to: number) => {
    const letters =
      from < to ? C_LETTERS.slice(from, to + 1) : C_LETTERS.slice(to, from + 1).reverse()
    const size = letters.length
    return `${letters.join(', ')}: ${COUNT_WORDS[size]} letters, a ${SIZE_NAMES[size]}`
  }
  for (let to = 1; to < C_LETTERS.length; to++) {
    play(0, to === 1 ? 'Count every letter, the first and the last' : undefined)
    play(to, counted(0, to))
  }
  const top = C_LETTERS.length - 1
  for (let to = top - 1; to >= 0; to--) {
    play(top, to === top - 1 ? 'Now count down from G' : undefined)
    play(to, counted(top, to))
  }
  return {
    id: 'lesson:counting-intervals',
    kind: 'exercise',
    title: 'Counting intervals',
    subtitle: 'Count the letters, both notes included',
    steps,
    pitchClasses: C_POSITION.map((note) => note % 12),
    rootPitchClass: null,
    pitchNames: Object.fromEntries(C_POSITION.map((note, at) => [note % 12, C_LETTERS[at]!])),
    notes: steps.flatMap((step) => step.notes),
    keyFifths: null,
    facts: [{ label: 'Intervals', value: '2nd to 5th, up and down' }],
    fingerings: [{ hand: 'right', fingers: [1, 2, 3, 4, 5], source: 'standard' }],
    defaultBpm: 60,
  }
}

export const INTERVAL_LESSONS = {
  'high-or-low': (range) => highOrLow(range),
  'pitch-recognition': () => pitchRecognition(),
  'half-steps': (range) => stepWalk(range, HALF_STEPS, 0),
  'half-steps-lower': (range) => stepWalk(range, HALF_STEPS, -1),
  'half-steps-higher': (range) => stepWalk(range, HALF_STEPS, 1),
  'whole-steps': (range) => stepWalk(range, WHOLE_STEPS, 0),
  'whole-steps-lower': (range) => stepWalk(range, WHOLE_STEPS, -1),
  'whole-steps-higher': (range) => stepWalk(range, WHOLE_STEPS, 1),
  'counting-intervals': () => countingIntervals(),
} as const satisfies Record<string, LessonBuilder>

/** Each lesson's introduction: what it asks, as a teacher would say it before the student starts. */
export const INTERVAL_ABOUT = {
  'high-or-low': {
    objective:
      'Listen to two notes. If the second one sounds higher, play any key to the right of middle C. If it sounds lower, play any key to the left.',
    narration: 'high-or-low.mp3',
    how: [
      { text: 'Each question plays middle C, then a second note.' },
      { text: 'Press Hear it again as often as you like.' },
    ],
    remember: 'The notes start far apart and get closer, so listen carefully.',
  },
  'pitch-recognition': {
    objective:
      'Listen to middle C, then a second note, and find that note on the keys. If you miss, you are told to go higher or lower. Then listen to short tunes that start on middle C and play them back.',
    narration: 'pitch-recognition.mp3',
    how: [
      { text: 'Right hand in C position: thumb on middle C, fingers over D, E, F and G.' },
      { text: 'Every note is one of those five keys.' },
      { text: 'Press Hear it again as often as you like.' },
    ],
    remember: 'Compare each note with middle C: is it higher, and how far?',
  },
  'half-steps': {
    objective:
      'A half step is the very next key, black or white. Walk from A up to G one key at a time, then back down.',
    narration: 'half-steps.mp3',
    how: [
      {
        who: 'Right hand',
        text: 'Finger 3 on each key, from the A below middle C up to G, then back down.',
      },
      { text: 'Each key is the very next one: no key is skipped.' },
    ],
    remember: 'E to F and B to C are half steps with no black key between them.',
  },
  'half-steps-lower': {
    objective:
      'The same half steps, one octave lower, with your left hand. Walk from A up to G one key at a time, then back down.',
    narration: 'half-steps-lower.mp3',
    how: [
      {
        who: 'Left hand',
        text: 'Finger 3 on each key, from A up to G below middle C, then back down.',
      },
    ],
    remember: 'B to C and E to F are half steps with no black key between them, in every octave.',
  },
  'half-steps-higher': {
    objective:
      'The same half steps, one octave higher, with your right hand. Walk from A up to G one key at a time, then back down.',
    narration: 'half-steps-higher.mp3',
    how: [
      {
        who: 'Right hand',
        text: 'Finger 3 on each key, from the A above middle C up to G, then back down.',
      },
    ],
    remember: 'B to C and E to F are half steps with no black key between them, in every octave.',
  },
  'whole-steps': {
    objective:
      'A whole step is two half steps: skip one key, black or white. Walk from A up to G a whole step at a time, then back down, and find the two places where the key you skip is white.',
    narration: 'whole-steps.mp3',
    how: [
      {
        who: 'Right hand',
        text: 'Finger 3 on every other key, from the A below middle C up to G, then back down.',
      },
      { text: 'Each move skips exactly one key.' },
    ],
    remember:
      'A whole step skips one key. From B and from E, the key skipped is white, so you land on a black key.',
  },
  'whole-steps-lower': {
    objective:
      'The same whole steps, one octave lower, with your left hand. Walk from A up to G a whole step at a time, then back down, and find the two places where the key you skip is white.',
    narration: 'whole-steps-lower.mp3',
    how: [
      {
        who: 'Left hand',
        text: 'Finger 3 on every other key, from A up to G below middle C, then back down.',
      },
    ],
    remember: 'A whole step skips one key, in every octave.',
  },
  'whole-steps-higher': {
    objective:
      'The same whole steps, one octave higher, with your right hand. Walk from A up to G a whole step at a time, then back down, and find the two places where the key you skip is white.',
    narration: 'whole-steps-higher.mp3',
    how: [
      {
        who: 'Right hand',
        text: 'Finger 3 on every other key, from the A above middle C up to G, then back down.',
      },
    ],
    remember: 'A whole step skips one key, in every octave.',
  },
  'counting-intervals': {
    objective:
      'An interval is the distance from one note to another. To name it, count the letters from the first note to the second, counting both. C to E is C, D, E: three letters, a 3rd. Play each pair and count along.',
    how: [
      { who: 'Right hand', text: 'C position: thumb on middle C, a finger on each key up to G.' },
      { text: 'Middle C and each key up to G, then G and each key down to C.' },
    ],
    remember: 'Always count the first note as one.',
  },
} as const satisfies Record<keyof typeof INTERVAL_LESSONS, LessonAbout>
