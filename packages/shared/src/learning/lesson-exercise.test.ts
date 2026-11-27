import { describe, expect, it } from 'vitest'
import { isBlackKey } from '../midi/notes.js'
import { buildLessonExercise } from './lesson-builders.js'
import { IDLE_SESSION, sessionReducer } from './session.js'

/**
 * The lessons' exercises.
 *
 * The black-key groups are taught as the fingering guide has them (Verbalis,
 * stage 1): every group on the keyboard pressed as a block, the left hand
 * going up from the bottom to middle C and the right hand coming down from the
 * top to meet it, with the long fingers — LH 4-3 and 4-3-2, RH 3-4 and 2-3-4.
 * What is pinned is that and nothing else: no group of the other kind in it,
 * none left out, and each hand moving only toward the middle.
 */
const fingering = (exercise: ReturnType<typeof buildLessonExercise>) =>
  exercise.steps.map((step) =>
    step.fingers.map((finger) => `${finger.hand[0]}${finger.finger}`).join(' '),
  )

describe('two-black-key groups', () => {
  const exercise = buildLessonExercise('two-black-key-groups')

  it('finds every group of two black keys on a 61-key keyboard: up in the left hand, down in the right', () => {
    expect(exercise.steps.map((step) => step.notes)).toEqual([
      [37, 39],
      [49, 51],
      [85, 87],
      [73, 75],
      [61, 63],
    ])
    for (const step of exercise.steps) expect(step.notes.every(isBlackKey)).toBe(true)
  })

  it('plays them with the guide’s long fingers: left hand 4-3, right hand 3-4', () => {
    expect(fingering(exercise)).toEqual(['l4 l3', 'l4 l3', 'r3 r4', 'r3 r4', 'r3 r4'])
    // Said where the hand changes, and nowhere else.
    expect(exercise.steps.map((step) => step.cue)).toEqual([
      'Left hand, fingers 4-3, going up',
      undefined,
      'Right hand, fingers 3-4, coming down',
      undefined,
      undefined,
    ])
  })

  it('takes every group the keyboard has, and only those wholly on it', () => {
    const all = buildLessonExercise('two-black-key-groups', { range: { low: 21, high: 108 } })
    expect(all.steps.map((step) => step.notes[0])).toEqual([25, 37, 49, 97, 85, 73, 61])
    // A keyboard that starts on D has lost the first group's C♯.
    const cut = buildLessonExercise('two-black-key-groups', { range: { low: 38, high: 96 } })
    expect(cut.steps[0]!.notes).toEqual([49, 51])
  })

  it('is in no key, and a run of it is counted in groups', () => {
    expect(exercise.pitchClasses).toEqual([1, 3])
    expect(exercise.rootPitchClass).toBeNull()
    expect(exercise.stepsAre).toBe('groups')
  })

  it('takes both keys of a group to move on, and counts a three-black-key group as a mistake', () => {
    let session = sessionReducer(IDLE_SESSION, { type: 'start', at: 0 }, exercise)
    session = sessionReducer(session, { type: 'noteOn', note: 42, at: 1 }, exercise) // F♯
    expect(session.mistakes).toBe(1)
    session = sessionReducer(session, { type: 'noteOn', note: 37, at: 2 }, exercise)
    expect(session.stepIndex).toBe(0)
    session = sessionReducer(session, { type: 'noteOn', note: 39, at: 3 }, exercise)
    expect(session.stepIndex).toBe(1)
  })
})

describe('three-black-key groups', () => {
  const exercise = buildLessonExercise('three-black-key-groups')

  it('finds every group of three black keys: up in the left hand, down in the right', () => {
    expect(exercise.steps.map((step) => step.notes)).toEqual([
      [42, 44, 46],
      [54, 56, 58],
      [90, 92, 94],
      [78, 80, 82],
      [66, 68, 70],
    ])
    expect(exercise.pitchClasses).toEqual([6, 8, 10])
    expect(exercise.pitchNames).toEqual({ 6: 'F♯', 8: 'G♯', 10: 'A♯' })
  })

  it('plays them with the guide’s long fingers: left hand 4-3-2, right hand 2-3-4', () => {
    expect(fingering(exercise)).toEqual([
      'l4 l3 l2',
      'l4 l3 l2',
      'r2 r3 r4',
      'r2 r3 r4',
      'r2 r3 r4',
    ])
    expect(exercise.steps[0]!.cue).toBe('Left hand, fingers 4-3-2, going up')
    expect(exercise.steps[2]!.cue).toBe('Right hand, fingers 2-3-4, coming down')
  })

  it('takes all three keys to move on, and counts a two-black-key group as a mistake', () => {
    let session = sessionReducer(IDLE_SESSION, { type: 'start', at: 0 }, exercise)
    session = sessionReducer(session, { type: 'noteOn', note: 37, at: 1 }, exercise) // C♯
    expect(session.mistakes).toBe(1)
    for (const [at, note] of [42, 44].entries())
      session = sessionReducer(session, { type: 'noteOn', note, at: at + 2 }, exercise)
    expect(session.stepIndex).toBe(0)
    session = sessionReducer(session, { type: 'noteOn', note: 46, at: 4 }, exercise)
    expect(session.stepIndex).toBe(1)
  })
})

/**
 * Black-key pattern: the guide's next step (Verbalis stage 1,
 * step 2) — every group on the keyboard in order, two then three, up and back
 * down, each hand on its own side of middle C: the left with 4-3 and 4-3-2,
 * the right with 3-4 and 2-3-4.
 */
describe('recognizing keyboard patterns', () => {
  const exercise = buildLessonExercise('keyboard-patterns')
  const firsts = exercise.steps.map((step) => step.notes[0])

  it('goes through every group in order, up the keyboard and back down, the top played once', () => {
    const up = [37, 42, 49, 54, 61, 66, 73, 78, 85, 90]
    expect(firsts).toEqual([...up, ...up.slice(0, -1).reverse()])
    for (const step of exercise.steps) expect(step.notes.every(isBlackKey)).toBe(true)
  })

  it('alternates twos and threes, each hand on its own side with the guide’s long fingers', () => {
    const played = fingering(exercise)
    for (const [index, step] of exercise.steps.entries()) {
      const left = step.notes[0]! < 60
      const two = step.notes.length === 2
      expect(played[index]).toBe(left ? (two ? 'l4 l3' : 'l4 l3 l2') : two ? 'r3 r4' : 'r2 r3 r4')
    }
    // Never two groups of one kind side by side: that is the pattern.
    for (let index = 1; index < exercise.steps.length; index++)
      expect(exercise.steps[index]!.notes.length).not.toBe(exercise.steps[index - 1]!.notes.length)
  })

  it('says how to begin, and where to turn', () => {
    expect(exercise.steps[0]!.cue).toMatch(/^Going up: left hand below middle C/)
    expect(exercise.steps[10]!.cue).toBe('Now back down, the same way')
    expect(exercise.steps.filter((step) => step.cue)).toHaveLength(2)
  })

  it('counts a group of the wrong kind as a mistake', () => {
    let session = sessionReducer(IDLE_SESSION, { type: 'start', at: 0 }, exercise)
    session = sessionReducer(session, { type: 'noteOn', note: 42, at: 1 }, exercise) // a three, not the two
    expect(session.mistakes).toBe(1)
    session = sessionReducer(session, { type: 'noteOn', note: 37, at: 2 }, exercise)
    session = sessionReducer(session, { type: 'noteOn', note: 39, at: 3 }, exercise)
    expect(session.stepIndex).toBe(1)
  })
})

/**
 * Notes A to G: the seven letters on the white keys, up from an A, one key
 * at a time and named, and on to the next A, where they start again — the
 * left hand and then the right,
 * A found between the top two keys of a group of three (Alfred p. 11). No line names a finger
 * ("where is this note?" before "which finger?", Verbalis stages 2 and 4); the
 * keys carry A minor's fingering for a player who looks.
 */
describe('notes A through G', () => {
  const exercise = buildLessonExercise('notes-a-through-g')

  it('names the white keys A to G and then A again, from the A below middle C, the left hand an octave lower first', () => {
    expect(exercise.steps.map((step) => step.label).join('')).toBe('ABCDEFGA'.repeat(2))
    const octave = (a: number) => [0, 2, 3, 5, 7, 8, 10, 12].map((above) => a + above)
    expect(exercise.steps.map((step) => step.notes[0])).toEqual([...octave(45), ...octave(57)])
    for (const step of exercise.steps) expect(isBlackKey(step.notes[0]!)).toBe(false)
  })

  it('fingers the keys as A minor, thumb under and 3 over, and names no finger', () => {
    expect(fingering(exercise)).toEqual([
      ...['l5', 'l4', 'l3', 'l2', 'l1', 'l3', 'l2', 'l1'],
      ...['r1', 'r2', 'r3', 'r1', 'r2', 'r3', 'r4', 'r5'],
    ])
    const cues = exercise.steps.filter((step) => step.cue).map((step) => step.cue)
    expect(cues).toEqual([
      expect.stringMatching(/^Left hand: find A between the top two keys/),
      'After G, the letters start again: A',
      expect.stringMatching(/^Right hand: find A/),
      'After G, the letters start again: A',
    ])
    expect(`${exercise.subtitle} ${cues.join(' ')}`).not.toMatch(/finger/i)
  })

  it('says each key by its letter', () => {
    expect(exercise.pitchNames[9]).toBe('A')
    expect(exercise.pitchNames[0]).toBe('C')
    expect(exercise.rootPitchClass).toBeNull()
  })

  it('leaves out a key the keyboard does not have', () => {
    const short = buildLessonExercise('notes-a-through-g', { range: { low: 48, high: 72 } })
    expect(short.steps[0]!.notes).toEqual([48])
    expect(short.steps[0]!.cue).toBe('Left hand: up from C, saying each name')
    // The left hand's C is still A minor's third key: finger 3.
    expect(short.steps[0]!.fingers[0]!.finger).toBe(3)
    expect(short.steps.filter((step) => step.fingers[0]!.hand === 'right')).toHaveLength(8)
  })
})

/**
 * A to G Repeated: Notes A to G the next octave up, so the letters come round
 * again on the next As.
 */
describe('A to G repeated', () => {
  const exercise = buildLessonExercise('repeating-note-names')
  const first = buildLessonExercise('notes-a-through-g')

  it('is Notes A to G an octave higher, named and fingered the same', () => {
    expect(exercise.title).toBe('A to G Repeated')
    expect(exercise.steps.map((step) => step.label).join('')).toBe('ABCDEFGA'.repeat(2))
    expect(exercise.steps.map((step) => step.notes[0])).toEqual(
      first.steps.map((step) => step.notes[0]! + 12),
    )
    expect(fingering(exercise)).toEqual(fingering(first))
    expect(exercise.steps.map((step) => step.cue)).toEqual(first.steps.map((step) => step.cue))
  })
})

/**
 * Finding C and F: every C bottom to top, then every F — C just left of each
 * group of two, F just left of each group of three (Dummies p. 77; Cazaubon;
 * Turner p. 13) — finger 3, the left hand below middle C.
 */
describe('finding C and F', () => {
  const exercise = buildLessonExercise('finding-c-and-f')
  const keys = exercise.steps.map((step) => step.notes[0])

  it('finds every C on the keyboard, bottom to top, then every F', () => {
    expect(keys).toEqual([36, 48, 60, 72, 84, 96, 41, 53, 65, 77, 89])
    expect(exercise.steps.map((step) => step.label).join('')).toBe('CCCCCCFFFFF')
  })

  it('has each C just left of a group of two and each F just left of a group of three', () => {
    for (const step of exercise.steps) {
      const note = step.notes[0]!
      const black = [1, 2, 3].map((above) => isBlackKey(note + above))
      // C: C♯, D, D♯, then E and F, white. F: F♯, G, G♯, A, then a third black key, A♯.
      expect(black).toEqual([true, false, true])
      expect(isBlackKey(note + 5)).toBe(step.label === 'F')
      expect(isBlackKey(note - 1)).toBe(false)
    }
  })

  it('plays finger 3, the left hand below middle C, and says where each hunt begins', () => {
    expect(fingering(exercise)).toEqual(keys.map((note) => (note! < 60 ? 'l3' : 'r3')))
    const cues = exercise.steps.flatMap((step) => (step.cue ? [step.notes[0]] : []))
    expect(cues).toEqual([36, 60, 41, 65])
    expect(exercise.steps[0]!.cue).toMatch(/^Every C: the white key just left of each group of two/)
    expect(exercise.steps[6]!.cue).toMatch(/^Now every F: .*group of three/)
  })
})

/**
 * Finding Middle C: from middle C out to every other C and back, the nearest
 * first, the left hand for the Cs below and the right hand for those above,
 * finger 3 (Alfred p. 11, Turner, Learn & Master; Verbalis's single fingers).
 */
describe('finding middle C', () => {
  const exercise = buildLessonExercise('finding-middle-c')

  it('starts on middle C and comes back to it from every other C, the nearest first', () => {
    expect(exercise.steps.map((step) => step.notes[0])).toEqual([
      60, 48, 60, 72, 60, 36, 60, 84, 60, 96, 60,
    ])
    expect(exercise.steps.filter((step) => step.label === 'Middle C')).toHaveLength(6)
  })

  it('goes out and back with the same hand: left below middle C, right above', () => {
    expect(fingering(exercise)).toEqual([
      'r3',
      'l3',
      'l3',
      'r3',
      'r3',
      'l3',
      'l3',
      'r3',
      'r3',
      'r3',
      'r3',
    ])
    expect(exercise.steps.filter((step) => step.cue)).toHaveLength(2)
  })

  it('has nothing to find on a keyboard without middle C', () => {
    expect(buildLessonExercise('finding-middle-c', { range: { low: 72, high: 96 } }).steps).toEqual(
      [],
    )
  })
})

/**
 * Finding any white key: the landmark hunt goes on — every D and
 * G, then every E, A and B — each found from its black-key group (the notes'
 * keyboard table; Alfred p. 11; Dummies p. 77), finger 3.
 */
describe('locating notes across the keyboard', () => {
  const exercise = buildLessonExercise('locating-notes')
  const letters = exercise.steps.map((step) => step.label).join('')

  it('hunts every D, then G, then E, A and B, each bottom to top', () => {
    expect(letters).toBe('DDDDDGGGGGEEEEEAAAAABBBBB')
    const ds = exercise.steps.filter((step) => step.label === 'D').map((step) => step.notes[0])
    expect(ds).toEqual([38, 50, 62, 74, 86])
  })

  it('finds each where its group of black keys says', () => {
    // A white key and the black keys either side of it, or the white one after.
    const around = (note: number) => [isBlackKey(note - 1), isBlackKey(note + 1)]
    for (const step of exercise.steps) {
      const note = step.notes[0]!
      const [below, above] = around(note)
      if (step.label === 'D' || step.label === 'G' || step.label === 'A')
        expect([below, above]).toEqual([true, true])
      else expect([below, above]).toEqual([true, false]) // E and B: right of a group
    }
  })

  it('says where each letter is as its hunt begins, and has finger 3 on each key found', () => {
    const begins = exercise.steps.filter((step) => step.cue && step.cue !== 'Right hand from here')
    expect(begins.map((step) => step.cue)).toEqual([
      'Every D: between the two black keys. From the bottom up',
      'Every G: between the first and second of the three black keys',
      'Every E: just right of the two black keys',
      'Every A: between the second and third of the three black keys',
      'Every B: just right of the three black keys',
    ])
    expect(fingering(exercise)).toEqual(
      exercise.steps.map((step) => (step.notes[0]! < 60 ? 'l3' : 'r3')),
    )
  })
})

/**
 * Left and right: from middle C the right hand moves right to G and
 * back, each key higher; the left hand moves left to F and back, each key
 * lower (Alfred p. 10, Turner p. 14). The keys show the five-finger position
 * on middle C.
 */
describe('moving left and right', () => {
  const exercise = buildLessonExercise('moving-left-and-right')

  it('goes right from middle C and back, then left and back', () => {
    expect(exercise.steps.map((step) => step.notes[0])).toEqual([
      60, 62, 64, 65, 67, 65, 64, 62, 60, 59, 57, 55, 53, 55, 57, 59, 60,
    ])
    expect(exercise.steps.map((step) => step.label).join('')).toBe('CDEFGFEDCBAGFGABC')
  })

  it('fingers each walk as the five-finger position with the thumb on middle C', () => {
    expect(fingering(exercise)).toEqual([
      ...['r1', 'r2', 'r3', 'r4', 'r5', 'r4', 'r3', 'r2', 'r1'],
      ...['l2', 'l3', 'l4', 'l5', 'l4', 'l3', 'l2', 'l1'],
    ])
  })

  it('says which way, and where to turn back', () => {
    expect(exercise.steps.flatMap((step) => (step.cue ? [[step.notes[0], step.cue]] : []))).toEqual(
      [
        [60, 'Right hand, from middle C: move right, each key higher'],
        [65, 'Back left to middle C, each key lower'],
        [59, 'Left hand: move left from middle C, each key lower'],
        [55, 'Back right to middle C, each key higher'],
      ],
    )
  })
})

/**
 * Octaves: counted C to C and F to F, eight names each, then a
 * line at middle C, an octave higher and an octave lower (Dummies pp. 76, 79;
 * Cazaubon; Alfred p. 334). The keys show C and F major for the octaves and
 * the C position for the line.
 */
describe('recognizing octaves', () => {
  const exercise = buildLessonExercise('recognizing-octaves')
  const keys = exercise.steps.map((step) => step.notes[0])

  it('counts eight names from middle C to the next C, and from F to F', () => {
    expect(keys.slice(0, 8)).toEqual([60, 62, 64, 65, 67, 69, 71, 72])
    expect(keys.slice(8, 16)).toEqual([53, 55, 57, 59, 60, 62, 64, 65])
    expect(
      exercise.steps
        .slice(0, 16)
        .map((step) => step.label)
        .join(''),
    ).toBe('CDEFGABCFGABCDEF')
  })

  it('plays a line at middle C, then the same an octave higher and an octave lower', () => {
    expect(keys.slice(16)).toEqual([60, 62, 64, 72, 74, 76, 48, 50, 52])
    expect(fingering(exercise).slice(0, 16)).toEqual([
      ...['r1', 'r2', 'r3', 'r1', 'r2', 'r3', 'r4', 'r5'],
      ...['l5', 'l4', 'l3', 'l2', 'l1', 'l3', 'l2', 'l1'],
    ])
    expect(fingering(exercise).slice(16)).toEqual([
      ...['r1', 'r2', 'r3', 'r1', 'r2', 'r3'],
      ...['l5', 'l4', 'l3'],
    ])
  })

  it('says each part as it begins', () => {
    expect(exercise.steps.filter((step) => step.cue).map((step) => step.notes[0])).toEqual([
      60, 53, 60, 72, 48,
    ])
    expect(exercise.steps[0]!.cue).toMatch(/Eight names, C to C: an octave$/)
  })
})

describe('the black-key song', () => {
  it('plays Hot Cross Buns on the three black keys, the right hand 4-3-2, then the left', () => {
    const steps = buildLessonExercise('black-key-song').steps
    const tune = (hand: string, f: [number, number, number]) => [
      ...[`${hand}A♯${f[2]}`, `${hand}G♯${f[1]}`, `${hand}F♯${f[0]}`],
      ...[`${hand}A♯${f[2]}`, `${hand}G♯${f[1]}`, `${hand}F♯${f[0]}`],
      ...Array<string>(4).fill(`${hand}F♯${f[0]}`),
      ...Array<string>(4).fill(`${hand}G♯${f[1]}`),
      ...[`${hand}A♯${f[2]}`, `${hand}G♯${f[1]}`, `${hand}F♯${f[0]}`],
    ]
    expect(
      steps.map((step) => `${step.fingers[0]!.hand[0]}${step.label}${step.fingers[0]!.finger}`),
    ).toEqual([...tune('r', [2, 3, 4]), ...tune('l', [4, 3, 2])])
    // Four bars of 4/4 in each hand.
    expect(steps.reduce((sum, step) => sum + (step.beats ?? 1), 0)).toBe(32)
    expect(steps[0]!.notes).toEqual([70])
  })
})
