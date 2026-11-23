import type { NoteRange } from '../domain/device-schemas.js'
import { markCrossings } from './crossings.js'
import { scaleFingering, type Hand } from '../music/fingering.js'
import type { FingeringSystemId } from '../music/fingering-system.js'
import type { Exercise, ExerciseStep } from './exercise.js'
import type { LessonAbout, LessonBuilder, LessonExerciseId } from './lesson-exercise.js'
import { LETTER_OF, MIDDLE_C, positionFinger, whiteKeysUp } from './lesson-keys.js'

/*
 * Keyboard Layout's lessons: the black-key groups, the musical alphabet and
 * finding your way about the keyboard. Their own module, loaded the first time
 * one of them opens (`lesson-exercise.ts`): lessons are content, and adding
 * one adds nothing to what the app loads at first.
 */

/*
 * The fingers on the keys.
 *
 * The lessons on the names ask for the right keys, not the right fingers: no
 * line of theirs names a finger. The fingers are on the keys for a player who
 * looks (key labels set to fingers, or the hands over the keys), and they are
 * the real ones — a run up the white keys fingered as the scale it is part of,
 * thumb under and all, and a short walk from a key as the five-finger position
 * on it. A key on its own, found somewhere on the keyboard, takes finger 3.
 */

/** The scale a run up the white keys from each letter it starts on is fingered as. */
const RUN_SCALES: Readonly<Record<number, { tonic: string; scaleTypeId: string }>> = {
  0: { tonic: 'C', scaleTypeId: 'major' },
  5: { tonic: 'F', scaleTypeId: 'major' },
  9: { tonic: 'A', scaleTypeId: 'natural-minor' },
}

/**
 * A run up the white keys, fingered by the fingering system as the scale it
 * begins: A to G as A minor, C to C as C major, F to F as F major (the left
 * hand's F major fingers the B as it fingers B♭). The run is asked for in whole
 * octaves and the fingers for its own keys kept.
 */
function runFingers(
  keys: readonly number[],
  hand: Hand,
  system: FingeringSystemId | undefined,
): number[] {
  const scale = RUN_SCALES[keys[0]! % 12]!
  const octaves = Math.max(1, Math.ceil((keys.length - 1) / 7))
  const { fingers } = scaleFingering({
    rootName: scale.tonic,
    scaleTypeId: scale.scaleTypeId,
    hand,
    octaves,
    notes: whiteKeysUp(keys[0]!, octaves * 7 + 1),
    system,
  })
  return fingers.slice(0, keys.length)
}

/**
 * A group of black keys: its pitch classes, low to high, their names, and the
 * fingers each hand takes it with — low key first.
 */
interface BlackKeyGroup {
  readonly id: 'two-black-key-groups' | 'three-black-key-groups'
  readonly title: string
  readonly pitchClasses: readonly number[]
  readonly names: readonly string[]
  readonly fingers: Readonly<Record<Hand, readonly number[]>>
}

/**
 * Fingering guide (`~/sites/piano knowledge`): Verbalis, *Natural Fingering*,
 * stage 1 "black keys first" (pp. 203–204), the one source that fingers these
 * groups — LH 4-3 and 4-3-2, RH 3-4 and 2-3-4, the long fingers keeping the
 * arm balanced toward the little-finger side; the left hand going up and the
 * right hand coming down, each group pressed as a block. Alfred Level 1 (p. 10)
 * likewise plays the groups as clusters, before any note has a name.
 */
const TWO: BlackKeyGroup = {
  id: 'two-black-key-groups',
  title: 'Two black keys',
  pitchClasses: [1, 3],
  names: ['C♯', 'D♯'],
  fingers: { left: [4, 3], right: [3, 4] },
}
const THREE: BlackKeyGroup = {
  id: 'three-black-key-groups',
  title: 'Three black keys',
  pitchClasses: [6, 8, 10],
  names: ['F♯', 'G♯', 'A♯'],
  fingers: { left: [4, 3, 2], right: [2, 3, 4] },
}

/**
 * Every group of one kind on the keyboard, each pressed as a block: the left
 * hand climbs from the bottom of the keyboard to middle C, then the right hand
 * comes down from the top to meet it. Each hand moves only toward the middle,
 * the way the guide has a beginner find the groups; together the two walks
 * cover the whole keyboard, so every group is found, and the hand that plays
 * each half of the keyboard is the one on that side.
 */
function blackKeyGroups(kind: BlackKeyGroup, range: NoteRange): Exercise {
  const groups = groupsOf(kind, range)
  const handFor = (group: readonly number[]): Hand => (group[0]! < MIDDLE_C ? 'left' : 'right')
  // Left hand going up, then right hand coming down.
  const order = [
    ...groups.filter((group) => handFor(group) === 'left'),
    ...groups.filter((group) => handFor(group) === 'right').reverse(),
  ]

  const steps: ExerciseStep[] = order.map((group, index) => {
    const hand = handFor(group)
    const fingers = kind.fingers[hand]
    // Said once, where the hand that plays changes: on the first group of each.
    const first = index === 0 || handFor(order[index - 1]!) !== hand
    const cue = first
      ? hand === 'left'
        ? `Left hand, fingers ${fingers.join('-')}, going up`
        : `Right hand, fingers ${fingers.join('-')}, coming down`
      : undefined
    return {
      id: `group-${group[0]}`,
      notes: group,
      fingers: fingers.map((finger) => ({ finger, hand })),
      label: kind.names.join(' + '),
      noteLabels: kind.names,
      ...(cue && { cue }),
    }
  })
  const hands = (['left', 'right'] as const).filter((hand) =>
    groups.some((group) => handFor(group) === hand),
  )

  return {
    id: `lesson:${kind.id}`,
    kind: 'exercise',
    title: kind.title,
    subtitle: 'Left hand up · right hand down',
    steps,
    pitchClasses: kind.pitchClasses,
    rootPitchClass: null,
    pitchNames: Object.fromEntries(kind.pitchClasses.map((pc, i) => [pc, kind.names[i]!])),
    notes: steps.flatMap((step) => step.notes),
    // Written with every sharp printed: the lesson is in no key.
    keyFifths: null,
    facts: [{ label: 'Groups', value: String(groups.length) }],
    // From a published method (see above), not a scale system: `derived` is
    // the nearest of the sources a fingering can name.
    fingerings: hands.map((hand) => ({
      hand,
      fingers: kind.fingers[hand],
      source: 'derived',
      perStep: kind.pitchClasses.length,
    })),
    defaultBpm: 60,
    stepsAre: 'groups',
    // The whole pattern on the keys from the start, filling in as it is played.
    marksProgress: kind.id === 'two-black-key-groups',
    wrongHints:
      kind.id === 'two-black-key-groups'
        ? [{ pitchClasses: THREE.pitchClasses, text: "That's three. Look for a pair." }]
        : undefined,
  }
}

/** Every group of one kind wholly on the keyboard, low to high. */
function groupsOf(kind: BlackKeyGroup, range: NoteRange): number[][] {
  const groups: number[][] = []
  for (let octave = Math.floor(range.low / 12) * 12; octave <= range.high; octave += 12) {
    const group = kind.pitchClasses.map((pc) => octave + pc)
    if (group[0]! >= range.low && group[group.length - 1]! <= range.high) groups.push(group)
  }
  return groups
}

/**
 * The pattern the groups make: two, then three, over and over, two white keys
 * side by side between each. Every group on the keyboard in order, up and back
 * down, the hands taking turns — the left hand every group of two, the right
 * hand every group of three, each crossing over the other to its next group.
 *
 * Fingering guide (`~/sites/piano knowledge`): Verbalis, *Natural Fingering*,
 * stage 1 "black keys first", step 2 (pp. 203–204) — after each kind of group
 * alone, the groups up and down cross-hand, L-R-L-R going up and R-L-R-L coming
 * down, "then all five" keys of the octave; with step 3's long fingers, LH 4-3
 * for the two and RH 2-3-4 for the three. Still blocks, still no note names:
 * Alfred Level 1 (p. 10) and Cazaubon name the alternating pattern itself as
 * what the beginner learns to see before any key is named.
 */
function keyboardPatterns(range: NoteRange): Exercise {
  const handOf = (group: readonly number[]): Hand => (group.length === 2 ? 'left' : 'right')
  const kindOf = (group: readonly number[]) => (group.length === 2 ? TWO : THREE)
  const groups = [...groupsOf(TWO, range), ...groupsOf(THREE, range)].sort((a, b) => a[0]! - b[0]!)
  // Up, then back down from the group before the top: the turn is not played twice.
  const order = [...groups, ...groups.slice(0, -1).reverse()]
  const turn = groups.length

  const steps: ExerciseStep[] = order.map((group, index) => {
    const hand = handOf(group)
    const kind = kindOf(group)
    const fingers = kind.fingers[hand]
    const cue =
      index === 0
        ? 'Hand over hand, going up: left hand on the twos, 4-3; right hand on the threes, 2-3-4'
        : index === turn
          ? 'Now back down, the same way'
          : undefined
    return {
      id: `pattern-${index}-${group[0]}`,
      notes: group,
      fingers: fingers.map((finger) => ({ finger, hand })),
      label: kind.names.join(' + '),
      noteLabels: kind.names,
      ...(cue && { cue }),
    }
  })
  const pitchClasses = [...TWO.pitchClasses, ...THREE.pitchClasses]
  const names = [...TWO.names, ...THREE.names]

  return {
    id: 'lesson:keyboard-patterns',
    kind: 'exercise',
    title: 'Black-key pattern',
    subtitle: 'Twos and threes · hand over hand, up and back down',
    steps,
    pitchClasses,
    rootPitchClass: null,
    pitchNames: Object.fromEntries(pitchClasses.map((pc, i) => [pc, names[i]!])),
    notes: steps.flatMap((step) => step.notes),
    keyFifths: null,
    facts: [{ label: 'Groups', value: String(groups.length) }],
    fingerings: [
      { hand: 'left', fingers: TWO.fingers.left, source: 'derived', perStep: 2 },
      { hand: 'right', fingers: THREE.fingers.right, source: 'derived', perStep: 3 },
    ],
    defaultBpm: 60,
    stepsAre: 'groups',
  }
}

/** The seven letters, from A: the white keys' names in the order they come up the keyboard. */
const ALPHABET = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const
/** Each letter's distance above A in half steps: the white keys from A to G. */
const ABOVE_A = [0, 2, 3, 5, 7, 8, 10] as const

/**
 * The musical alphabet: the seven letters on the white keys, A to G, up from
 * an A — the left hand from the A an octave and a third below middle C, then
 * the right hand from the A just below middle C, up across it — and each hand
 * back down to its A. One key at a time, each named as it is played: the
 * lesson is the names, forwards and backwards, and the next ones ("Repeating
 * note names", "Finding C and F") take them round the keyboard.
 *
 * Fingering guide (`~/sites/piano knowledge`): "where is this note?" before
 * "which finger?" — Verbalis, *Natural Fingering*, stages 2 and 4 (p. 204). So
 * the lesson asks for the keys and names no finger; the fingers on the keys,
 * for a player who looks, are A minor's (the guide's §3: a natural minor takes
 * its relative major's fingering), from the fingering system.
 * The letters and where to find A: Alfred Level 1 (p. 11) — A is the white key
 * between the upper two keys of every three-black-key group, and the names
 * A–G repeat; Piano For Dummies (p. 76) — seven letters, and after G, A again.
 */
function notesAThroughG(range: NoteRange, system?: FingeringSystemId): Exercise {
  const walks: { hand: Hand; a: number }[] = [
    { hand: 'left', a: MIDDLE_C - 15 },
    { hand: 'right', a: MIDDLE_C - 3 },
  ]
  // A to G is the start of A minor: the right hand 1-2-3, thumb under, 1-2-3-4;
  // the left 5-4-3-2-1, 3 over, 2.
  const fingersOf = Object.fromEntries(
    walks.map(({ hand, a }) => [
      hand,
      runFingers(
        ABOVE_A.map((above) => a + above),
        hand,
        system,
      ),
    ]),
  ) as Record<Hand, number[]>
  // Up A to G and straight back down to A, without playing G twice: the way
  // down is where a beginner has to look, and its crossings are the other way
  // round — the right hand's 3 over the thumb, the left thumb passing under.
  // Each key keeps the finger it had going up.
  const path = [...ABOVE_A.keys(), ...[...ABOVE_A.keys()].reverse().slice(1)]
  const turn = ABOVE_A.length - 1
  const steps: ExerciseStep[] = walks.flatMap(({ hand, a }) => {
    const side = hand === 'left' ? 'Left' : 'Right'
    return (
      path
        .map((index, at) => ({ note: a + ABOVE_A[index]!, letter: ALPHABET[index]!, index, at }))
        .filter(({ note }) => note >= range.low && note <= range.high)
        // Said on the hand's first key — its A, or where a short keyboard starts
        // it — and on the first key of the way down.
        .map(({ note, letter, index, at }, first) => {
          const cue =
            first === 0
              ? index === 0
                ? `${side} hand: find A between the top two keys of a group of three, then up, saying each name`
                : `${side} hand: up from ${letter}, saying each name`
              : at === turn + 1
                ? 'Now back down to A, saying each name'
                : undefined
          return {
            id: `${hand}-${at}-${letter}`,
            notes: [note],
            fingers: [{ finger: fingersOf[hand][index]!, hand }],
            label: letter,
            noteLabels: [letter],
            ...(cue && { cue }),
          }
        })
    )
  })
  const pitchClasses = ABOVE_A.map((above) => (9 + above) % 12)
  const hands = (['left', 'right'] as const).filter((hand) =>
    steps.some((step) => step.fingers[0]!.hand === hand),
  )

  return {
    id: 'lesson:notes-a-through-g',
    kind: 'exercise',
    title: 'Notes A to G',
    subtitle: 'The seven letters up from A and back down · left hand, then right',
    // The first lesson past five keys: each crossing stops to show how (the
    // user, 2026-11-22).
    steps: markCrossings(steps),
    pitchClasses,
    rootPitchClass: null,
    pitchNames: Object.fromEntries(pitchClasses.map((pc, i) => [pc, ALPHABET[i]!])),
    notes: steps.flatMap((step) => step.notes),
    keyFifths: null,
    facts: [{ label: 'Letters', value: '7' }],
    fingerings: hands.map((hand) => ({ hand, fingers: fingersOf[hand], source: 'standard' })),
    defaultBpm: 60,
  }
}

/**
 * The alphabet over and over: every white key from the keyboard's lowest A to
 * its top, each named as it is played — A to G, and after G, A again. The left
 * hand up to middle C, then the right hand from middle C to the top, fingered
 * on the keys as A minor and C major runs and named nowhere, as in "Notes A to
 * G". Every A after the first is said: that is
 * where the names start again, and the lesson.
 *
 * Fingering guide (`~/sites/piano knowledge`): as "Notes A to G" —
 * Verbalis, stages 2 and 4 (p. 204), single fingers and the arm before any hand
 * position, the whole keyboard from the start (pp. 200–203). The names: Piano
 * For Dummies (p. 76) — seven letters, after G the series starts again at A, so
 * the eighth key has the first one's name, and a piano runs from its lowest A
 * to its highest; Alfred Level 1 (p. 11) — the letters repeat, the lowest key is
 * A and the highest C; Cazaubon — "then C again".
 */
function repeatingNoteNames(range: NoteRange, system?: FingeringSystemId): Exercise {
  const white = (note: number) => LETTER_OF[note % 12] !== undefined
  let from = range.low
  while (from <= range.high && from % 12 !== 9) from++
  const keys: number[] = []
  for (let note = from; note <= range.high; note++) if (white(note)) keys.push(note)
  const handOf = (note: number): Hand => (note < MIDDLE_C ? 'left' : 'right')
  // Each hand's keys are one run: the left hand's A minor up from the lowest A,
  // the right hand's C major up from middle C.
  const runOf = (hand: Hand) => keys.filter((note) => handOf(note) === hand)
  const fingersOf: Record<Hand, number[]> = {
    left: runOf('left').length > 0 ? runFingers(runOf('left'), 'left', system) : [],
    right: runOf('right').length > 0 ? runFingers(runOf('right'), 'right', system) : [],
  }

  const steps: ExerciseStep[] = keys.map((note, index) => {
    const letter = LETTER_OF[note % 12]!
    const hand = handOf(note)
    const cue =
      index === 0
        ? `${hand === 'left' ? 'Left' : 'Right'} hand: from the lowest A, up, saying each name`
        : hand !== handOf(keys[index - 1]!)
          ? 'Right hand, from the middle: keep going'
          : letter === 'A'
            ? 'After G, A again'
            : undefined
    return {
      id: `key-${note}`,
      notes: [note],
      fingers: [{ finger: fingersOf[hand][runOf(hand).indexOf(note)]!, hand }],
      label: letter,
      noteLabels: [letter],
      ...(cue && { cue }),
    }
  })
  const pitchClasses = [0, 2, 4, 5, 7, 9, 11]
  const hands = (['left', 'right'] as const).filter((hand) =>
    keys.some((note) => handOf(note) === hand),
  )

  return {
    id: 'lesson:repeating-note-names',
    kind: 'exercise',
    title: 'Repeating note names',
    subtitle: 'A to G, and A again · the whole keyboard',
    steps,
    pitchClasses,
    rootPitchClass: null,
    pitchNames: Object.fromEntries(pitchClasses.map((pc) => [pc, LETTER_OF[pc]!])),
    notes: keys,
    keyFifths: null,
    facts: [{ label: 'Rounds', value: String(keys.filter((note) => note % 12 === 9).length) }],
    fingerings: hands.map((hand) => ({ hand, fingers: fingersOf[hand], source: 'standard' })),
    defaultBpm: 60,
  }
}

/** One letter to find: every key of it on the keyboard, and where to look, said as it begins. */
interface Hunt {
  readonly letter: string
  readonly pitchClass: number
  readonly begin: string
}

/**
 * A landmark key hunt: for each letter in turn, every key of it on the
 * keyboard, bottom to top, one at a time — finger 3 on the keys, a key on its
 * own taking a long finger, and named nowhere — the left hand below
 * middle C, the right hand from it. Where each hunt begins, it says where that
 * letter is found; where the right hand takes over, it says so.
 */
function landmarkHunt(
  range: NoteRange,
  about: { id: LessonExerciseId; title: string; subtitle: string },
  hunts: readonly Hunt[],
): Exercise {
  const handOf = (note: number): Hand => (note < MIDDLE_C ? 'left' : 'right')
  const found = hunts.map((hunt) => {
    const keys: number[] = []
    for (let note = range.low; note <= range.high; note++)
      if (note % 12 === hunt.pitchClass) keys.push(note)
    return { ...hunt, keys }
  })

  const steps: ExerciseStep[] = found.flatMap(({ letter, keys, begin }) =>
    keys.map((note, index) => {
      const hand = handOf(note)
      const cue =
        index === 0 ? begin : hand !== handOf(keys[index - 1]!) ? 'Right hand from here' : undefined
      return {
        id: `${letter}-${note}`,
        notes: [note],
        fingers: [{ finger: 3, hand }],
        label: letter,
        noteLabels: [letter],
        ...(cue && { cue }),
      }
    }),
  )
  const hands = (['left', 'right'] as const).filter((hand) =>
    steps.some((step) => step.fingers[0]!.hand === hand),
  )

  return {
    id: `lesson:${about.id}`,
    kind: 'exercise',
    title: about.title,
    subtitle: about.subtitle,
    steps,
    pitchClasses: hunts.map((hunt) => hunt.pitchClass),
    rootPitchClass: null,
    pitchNames: Object.fromEntries(hunts.map((hunt) => [hunt.pitchClass, hunt.letter])),
    notes: steps.flatMap((step) => step.notes),
    keyFifths: null,
    facts: found.map(({ letter, keys }) => ({ label: `${letter}s`, value: String(keys.length) })),
    fingerings: hands.map((hand) => ({ hand, fingers: [3], source: 'derived', perStep: 1 })),
    defaultBpm: 60,
  }
}

/**
 * The two landmarks: every C on the keyboard, bottom to top, then every F — C
 * the white key just left of each group of two black keys, F the one just
 * left of each group of three.
 *
 * Fingering guide (`~/sites/piano knowledge`): as "Notes A to G" —
 * Verbalis, stages 2 and 4 (p. 204), single fingers and the arm, the whole
 * keyboard. The landmarks: Piano For Dummies (p. 77), the key finder — C left of
 * the two (chopsticks), F left of the three (fork) — and its landmark key hunt,
 * which begins with every C and every F from bottom to top; Cazaubon — find C
 * first, then F; Turner (p. 13) — find every C.
 */
const findingCAndF = (range: NoteRange) =>
  landmarkHunt(
    range,
    {
      id: 'finding-c-and-f',
      title: 'Finding C and F',
      subtitle: 'Every C, then every F · bottom to top',
    },
    [
      {
        letter: 'C',
        pitchClass: 0,
        begin:
          'Every C: the white key just left of each group of two black keys. From the bottom up',
      },
      {
        letter: 'F',
        pitchClass: 5,
        begin:
          'Now every F: the white key just left of each group of three. From the bottom up again',
      },
    ],
  )

/**
 * The rest of the white keys, each found from its group of black keys, as the
 * landmark hunt goes on after C and F: every D and every G, then every E, A
 * and B, bottom to top, finger 3.
 *
 * Fingering guide (`~/sites/piano knowledge`): as "Notes A to G" —
 * Verbalis, stages 2 and 4 (p. 204). Where each key is: the notes' keyboard
 * table (`data/keyboard.json`) — D between the two black keys, E right of
 * them; G between the first and second of the three, A between the second and
 * third, B right of them — with Alfred Level 1 (p. 11), every white key found by
 * its place beside a group, A between the upper two of the three. The order:
 * Piano For Dummies (p. 77), the landmark key hunt — C and F, then D and G,
 * then the rest, each name said aloud.
 */
const locatingNotes = (range: NoteRange) =>
  landmarkHunt(
    range,
    {
      id: 'locating-notes',
      title: 'Finding any note',
      subtitle: 'Every D and G, then every E, A and B · bottom to top',
    },
    [
      {
        letter: 'D',
        pitchClass: 2,
        begin: 'Every D: between the two black keys. From the bottom up',
      },
      {
        letter: 'G',
        pitchClass: 7,
        begin: 'Every G: between the first and second of the three black keys',
      },
      { letter: 'E', pitchClass: 4, begin: 'Every E: just right of the two black keys' },
      {
        letter: 'A',
        pitchClass: 9,
        begin: 'Every A: between the second and third of the three black keys',
      },
      { letter: 'B', pitchClass: 11, begin: 'Every B: just right of the three black keys' },
    ],
  )

/**
 * Middle C, found from anywhere: start on it, then out to another C and back
 * to middle C, each time a C further out — the nearest below, the nearest
 * above, then the next ones — until every C on the keyboard has led home to
 * it. The left hand takes the Cs below and the right hand those above, and
 * the hand that went out brings it back. Finger 3 on the keys, as for any key
 * found on its own, and named nowhere.
 *
 * Fingering guide (`~/sites/piano knowledge`): single fingers and the arm
 * before any hand position — Verbalis, stages 2 and 4 (p. 204), which also
 * warns against settling into the thumbs-on-middle-C position (that is Alfred's
 * Middle C position, p. 74, a later lesson). Middle C itself: Alfred Level 1
 * (p. 11), the C nearest the centre; Turner, the reference point every chord
 * diagram marks; Learn & Master, sit facing it, the left hand working mostly
 * below it and the right hand around and above; Piano For Dummies (p. 102),
 * either hand may play it.
 */
function findingMiddleC(range: NoteRange): Exercise {
  const others: number[] = []
  for (let note = range.low; note <= range.high; note++)
    if (note % 12 === 0 && note !== MIDDLE_C) others.push(note)
  // The nearest first, below before above at the same distance.
  others.sort((a, b) => Math.abs(a - MIDDLE_C) - Math.abs(b - MIDDLE_C) || a - b)
  const handOf = (note: number): Hand => (note < MIDDLE_C ? 'left' : 'right')
  const steps: ExerciseStep[] = []
  const step = (note: number, hand: Hand, cue?: string): ExerciseStep => ({
    id: `${hand}-${note}-${steps.length}`,
    notes: [note],
    fingers: [{ finger: 3, hand }],
    label: note === MIDDLE_C ? 'Middle C' : 'C',
    noteLabels: ['C'],
    ...(cue && { cue }),
  })

  if (MIDDLE_C >= range.low && MIDDLE_C <= range.high) {
    steps.push(step(MIDDLE_C, 'right', 'Find middle C, the C nearest the middle, marked C4'))
    for (const [index, note] of others.entries()) {
      const hand = handOf(note)
      steps.push(
        step(
          note,
          hand,
          index === 0 ? 'Out to another C, then straight back to middle C' : undefined,
        ),
      )
      steps.push(step(MIDDLE_C, hand))
    }
  }
  const hands = (['left', 'right'] as const).filter((hand) =>
    steps.some((each) => each.fingers[0]!.hand === hand),
  )

  return {
    id: 'lesson:finding-middle-c',
    kind: 'exercise',
    title: 'Finding Middle C',
    subtitle: 'Out to every C and back',
    steps,
    pitchClasses: [0],
    rootPitchClass: null,
    pitchNames: { 0: 'C' },
    notes: steps.flatMap((each) => each.notes),
    keyFifths: null,
    facts: [{ label: 'Trips', value: String(others.length) }],
    fingerings: hands.map((hand) => ({ hand, fingers: [3], source: 'derived', perStep: 1 })),
    defaultBpm: 60,
  }
}

/**
 * Which way is which: from middle C the right hand moves right, a white key at
 * a time, to G and back — each key higher — then the left hand moves left to
 * F and back — each key lower — each key named. The keys show the five-finger
 * position on middle C (the guide's ground rule 3); no line names a finger.
 *
 * Fingering guide (`~/sites/piano knowledge`): as "Notes A to G" —
 * Verbalis, stages 2 and 4 (p. 204), single fingers, the arm moving across the
 * keyboard. The directions: Alfred Level 1 (p. 10) — left is down and lower,
 * right is up and higher; Turner (p. 14) — low notes to the left, high to the
 * right; Learn & Master — the left hand works below middle C, the right hand
 * around and above it.
 */
function movingLeftAndRight(range: NoteRange): Exercise {
  const right = [60, 62, 64, 65, 67]
  const left = [59, 57, 55, 53]
  const walks: { hand: Hand; keys: number[]; out: string; back: string }[] = [
    {
      hand: 'right',
      keys: [...right, ...right.slice(0, -1).reverse()],
      out: 'Right hand, from middle C: move right, each key higher',
      back: 'Back left to middle C, each key lower',
    },
    {
      hand: 'left',
      keys: [...left, ...left.slice(0, -1).reverse(), MIDDLE_C],
      out: 'Left hand: move left from middle C, each key lower',
      back: 'Back right to middle C, each key higher',
    },
  ]
  const steps: ExerciseStep[] = walks.flatMap(({ hand, keys, out, back }) => {
    // The cue to come back goes on the first key after the far one.
    const far = hand === 'right' ? Math.max(...keys) : Math.min(...keys)
    const turnAt = keys.indexOf(far) + 1
    return keys
      .map((note, index) => ({ note, index }))
      .filter(({ note }) => note >= range.low && note <= range.high)
      .map(({ note, index }) => {
        const letter = LETTER_OF[note % 12]!
        const cue = index === 0 ? out : index === turnAt ? back : undefined
        return {
          id: `${hand}-${index}-${note}`,
          notes: [note],
          // The thumb on middle C: the C position for the right hand, and for
          // the left the five keys down to F.
          fingers: [{ finger: positionFinger(note, MIDDLE_C), hand }],
          label: letter,
          noteLabels: [letter],
          ...(cue && { cue }),
        }
      })
  })
  const pitchClasses = [0, 2, 4, 5, 7, 9, 11]

  return {
    id: 'lesson:moving-left-and-right',
    kind: 'exercise',
    title: 'Left and right',
    subtitle: 'Right is higher, left is lower · from middle C and back',
    steps,
    pitchClasses,
    rootPitchClass: null,
    pitchNames: Object.fromEntries(pitchClasses.map((pc) => [pc, LETTER_OF[pc]!])),
    notes: steps.flatMap((step) => step.notes),
    keyFifths: null,
    facts: [{ label: 'Keys', value: String(steps.length) }],
    fingerings: [
      {
        hand: 'right',
        fingers: right.map((note) => positionFinger(note, MIDDLE_C)),
        source: 'derived',
      },
      {
        hand: 'left',
        fingers: [MIDDLE_C, ...left].map((note) => positionFinger(note, MIDDLE_C)),
        source: 'derived',
      },
    ],
    defaultBpm: 60,
  }
}

/**
 * The octave, three ways: counted from middle C up the white keys to the next
 * C, eight names; counted the same from F to F in the left hand; then a short
 * line, C-D-E, played at middle C, the same an octave higher, and an octave
 * lower. The keys show the octaves as C and F major runs and the line as the
 * C position; no line names a finger, and the thumb-to-5 octave stretch is a
 * later lesson's.
 *
 * Fingering guide (`~/sites/piano knowledge`): as "Notes A to G" —
 * Verbalis, stages 2 and 4 (p. 204), single fingers and the arm; the thumb-to-5
 * octave stretch waits for the hand positions (Cazaubon: small hands skip it).
 * The octave: Piano For Dummies (p. 76) — from a key to the next of the same
 * name, eight letter names counted inclusively — and its octave groupings
 * (p. 79), C to C and F to F among them; Cazaubon — an 8th, counted up from the
 * bottom note. The line moved by an octave: Alfred Level 1 (p. 334), a line
 * replayed an octave higher or lower to practise moving around the keyboard.
 */
function recognizingOctaves(range: NoteRange, system?: FingeringSystemId): Exercise {
  const whites = (from: number, to: number) => {
    const keys: number[] = []
    for (let note = from; note <= to; note++)
      if (LETTER_OF[note % 12] !== undefined) keys.push(note)
    return keys
  }
  const line = [0, 2, 4]
  // The two octaves are runs, fingered as C major and F major; the short line
  // is the C position, the left hand's an octave down with 5 on its C.
  const lineFingers = (hand: Hand) => (hand === 'right' ? [1, 2, 3] : [5, 4, 3])
  const parts: { hand: Hand; keys: number[]; fingers: number[]; cue: string }[] = [
    {
      hand: 'right',
      keys: whites(MIDDLE_C, MIDDLE_C + 12),
      fingers: runFingers(whites(MIDDLE_C, MIDDLE_C + 12), 'right', system),
      cue: 'Right hand: middle C, then up the white keys to the next C. Eight names, C to C: an octave',
    },
    {
      hand: 'left',
      keys: whites(MIDDLE_C - 7, MIDDLE_C + 5),
      fingers: runFingers(whites(MIDDLE_C - 7, MIDDLE_C + 5), 'left', system),
      cue: 'Left hand: F to F the same way, eight names up to the next F',
    },
    {
      hand: 'right',
      keys: line.map((above) => MIDDLE_C + above),
      fingers: lineFingers('right'),
      cue: 'A short line from middle C: C, D, E',
    },
    {
      hand: 'right',
      keys: line.map((above) => MIDDLE_C + 12 + above),
      fingers: lineFingers('right'),
      cue: 'The same line an octave higher',
    },
    {
      hand: 'left',
      keys: line.map((above) => MIDDLE_C - 12 + above),
      fingers: lineFingers('left'),
      cue: 'And an octave lower, left hand',
    },
  ]

  const steps: ExerciseStep[] = parts.flatMap(({ hand, keys, fingers, cue }, part) =>
    keys
      .map((note, at) => ({ note, finger: fingers[at]! }))
      .filter(({ note }) => note >= range.low && note <= range.high)
      .map(({ note, finger }, index) => {
        const letter = LETTER_OF[note % 12]!
        return {
          id: `${part}-${note}`,
          notes: [note],
          fingers: [{ finger, hand }],
          label: letter,
          noteLabels: [letter],
          ...(index === 0 && { cue }),
        }
      }),
  )
  const pitchClasses = [0, 2, 4, 5, 7, 9, 11]

  return {
    id: 'lesson:recognizing-octaves',
    kind: 'exercise',
    title: 'Octaves',
    subtitle: 'C to C, F to F, and a line an octave higher and lower',
    steps,
    pitchClasses,
    rootPitchClass: null,
    pitchNames: Object.fromEntries(pitchClasses.map((pc) => [pc, LETTER_OF[pc]!])),
    notes: steps.flatMap((step) => step.notes),
    keyFifths: null,
    facts: [{ label: 'An octave', value: '8 names' }],
    fingerings: [
      { hand: 'right', fingers: parts[0]!.fingers, source: 'standard' },
      { hand: 'left', fingers: parts[1]!.fingers, source: 'standard' },
    ],
    defaultBpm: 60,
  }
}

export const KEYBOARD_LAYOUT_LESSONS = {
  'two-black-key-groups': (range) => blackKeyGroups(TWO, range),
  'three-black-key-groups': (range) => blackKeyGroups(THREE, range),
  'keyboard-patterns': (range) => keyboardPatterns(range),
  'notes-a-through-g': (range, options) => notesAThroughG(range, options.fingering),
  'repeating-note-names': (range, options) => repeatingNoteNames(range, options.fingering),
  'finding-c-and-f': (range) => findingCAndF(range),
  'finding-middle-c': (range) => findingMiddleC(range),
  'locating-notes': (range) => locatingNotes(range),
  'moving-left-and-right': (range) => movingLeftAndRight(range),
  'recognizing-octaves': (range, options) => recognizingOctaves(range, options.fingering),
} as const satisfies Record<string, LessonBuilder>

/** Each lesson's introduction: what it asks, as a teacher would say it before the student starts. */
export const KEYBOARD_LAYOUT_ABOUT = {
  'two-black-key-groups': {
    objective: 'Find the groups of two black keys. They repeat all the way across the keyboard.',
    how: [
      { text: 'Start with the pair that is lit up, and press both keys at once.' },
      { text: 'Then find the next pair. Each one turns green once you play it.' },
    ],
  },
  'three-black-key-groups': {
    objective: 'Find the groups of three black keys, and press all three keys at once.',
    how: [
      {
        who: 'Left hand',
        text: 'Ring finger (4) on the left key, middle (3) in the middle, index (2) on the right.',
      },
      {
        who: 'Right hand',
        text: 'Index finger (2) on the left key, middle (3) in the middle, ring (4) on the right.',
      },
    ],
  },
  'keyboard-patterns': {
    objective:
      'Play the black keys’ pattern up the keyboard: a group of two, then a group of three.',
    how: [
      {
        who: 'Left hand',
        text: 'On each group of two: ring finger (4) on the left key, middle (3) on the right.',
      },
      {
        who: 'Right hand',
        text: 'On each group of three: index (2) on the left key, middle (3) in the middle, ring (4) on the right.',
      },
    ],
    remember:
      'The piano keyboard repeats the same pattern of two and three black keys surrounded by white keys.',
  },
  'notes-a-through-g': {
    objective: 'Name the white keys with their seven letters: A, B, C, D, E, F and G.',
    how: [
      {
        text: 'Find A: the white key between the top two of a group of three black keys.',
      },
      {
        who: 'Left hand',
        text: 'From a low A, play the white keys up to G, then back down to A.',
      },
      {
        who: 'Right hand',
        text: 'Then the same from the A in the middle of the keyboard.',
      },
    ],
    remember: 'Say each letter as you play it.',
  },
  'repeating-note-names': {
    objective: 'Play every white key from the bottom of the keyboard to the top, saying each name.',
    how: [
      {
        who: 'Left hand',
        text: 'From the lowest A up to the middle of the keyboard.',
      },
      {
        who: 'Right hand',
        text: 'From the middle on to the top.',
      },
    ],
    remember: 'There are only seven letters: after G comes A again.',
  },
  'finding-c-and-f': {
    objective: 'Find every C and every F on the keyboard.',
    how: [
      {
        text: 'Play every C from the bottom of the keyboard to the top, then every F the same way.',
      },
      {
        who: 'Left hand',
        text: 'Up to the C in the middle of the keyboard, marked C4.',
      },
      { who: 'Right hand', text: 'From that C up.' },
    ],
    remember:
      'C is just left of every group of two black keys, and F just left of every group of three.',
  },
  'finding-middle-c': {
    objective: 'Find middle C, home base, and come back to it from every other C.',
    how: [
      { text: 'Start on middle C, marked C4.' },
      {
        text: 'Go out to another C and straight back, each time a C further away.',
      },
      { who: 'Left hand', text: 'The Cs below middle C, there and back.' },
      { who: 'Right hand', text: 'The Cs above it, there and back.' },
    ],
    remember: 'Middle C is the C nearest the middle of the piano: sit facing it.',
  },
  'locating-notes': {
    objective: 'Find every white key from its group of black keys.',
    how: [
      {
        text: 'Find every D from the bottom of the keyboard to the top, then every G, then every E, A and B, saying each name.',
      },
      { who: 'Left hand', text: 'Below middle C.' },
      { who: 'Right hand', text: 'From middle C up.' },
    ],
    remember:
      'D is between the two black keys and E just right of them. G and A are between the three, and B just right of them.',
  },
  'moving-left-and-right': {
    objective: 'Hear the keys go higher to the right and lower to the left.',
    how: [
      {
        who: 'Right hand',
        text: 'Move right from middle C one white key at a time up to G, then back.',
      },
      {
        who: 'Left hand',
        text: 'Move left from middle C down to F, then back.',
      },
    ],
    remember: 'Say each name, and listen to which way it goes.',
  },
  'recognizing-octaves': {
    objective: 'Learn the octave: from one key to the next key with the same name.',
    how: [
      {
        who: 'Right hand',
        text: 'Count the white keys from middle C up to the next C: eight names.',
      },
      { who: 'Left hand', text: 'Count F to F the same way.' },
      {
        text: 'Play C, D, E from middle C, then an octave higher, then an octave lower with the left hand.',
      },
    ],
    remember: 'It is the same tune, just higher or lower.',
  },
} as const satisfies Record<keyof typeof KEYBOARD_LAYOUT_LESSONS, LessonAbout>
