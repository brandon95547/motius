import { describe, expect, it } from 'vitest'
import { asksByEar } from './exercise.js'
import { buildLessonExercise } from './lesson-builders.js'
import { MIDDLE_C } from './lesson-keys.js'
import { IDLE_SESSION, sessionReducer, wrongHint, type SessionState } from './session.js'
import { INTERVAL_ABOUT } from './interval-lessons.js'

const range = { low: 36, high: 96 }
const lesson = buildLessonExercise('high-or-low', { range })

describe('High or low?', () => {
  it('asks eight questions by ear: middle C, then a note above or below it', () => {
    expect(lesson.steps).toHaveLength(8)
    for (const step of lesson.steps) {
      expect(step.notes).toEqual([])
      expect(step.prompt![0]).toBe(MIDDLE_C)
      expect(step.prompt).toHaveLength(2)
      expect(step.landmark).toBe(MIDDLE_C)
    }
  })

  it('takes any key on the side the second note went, and only that side', () => {
    for (const step of lesson.steps) {
      const higher = step.prompt![1]! > MIDDLE_C
      expect(step.answer).toEqual(
        higher ? { from: MIDDLE_C + 1, to: range.high } : { from: range.low, to: MIDDLE_C - 1 },
      )
    }
  })

  it('starts far apart and comes closer, up and down mixed', () => {
    const gaps = lesson.steps.map((step) => Math.abs(step.prompt![1]! - MIDDLE_C))
    expect(gaps).toEqual([...gaps].sort((a, b) => b - a))
    const ups = lesson.steps.filter((step) => step.prompt![1]! > MIDDLE_C).length
    expect(ups).toBe(4)
  })

  it('names each question by number, never by its answer', () => {
    expect(lesson.steps.map((step) => step.label)).toEqual(
      lesson.steps.map((_, index) => `Question ${index + 1}`),
    )
  })

  it('waits for each answer, and says what it asks', () => {
    expect(lesson.waits).toBe(true)
    expect(lesson.stepsAre).toBe('questions')
    expect(INTERVAL_ABOUT['high-or-low'].objective).toContain('middle C')
    expect(INTERVAL_ABOUT['high-or-low'].narration).toBe('high-or-low.mp3')
    expect(INTERVAL_ABOUT['pitch-recognition'].narration).toBe('pitch-recognition.mp3')
  })

  it('is answered with any key of the side, and a key of the other side is a mistake', () => {
    const at = (state: SessionState, note: number) =>
      sessionReducer(state, { type: 'noteOn', note, at: 1 }, lesson)
    const started = sessionReducer(IDLE_SESSION, { type: 'start', at: 0 }, lesson)
    // The first question goes up an octave: middle C itself, and any key left of it, are wrong.
    const wrong = at(at(started, MIDDLE_C), MIDDLE_C - 5)
    expect(wrong.stepIndex).toBe(0)
    expect(wrong.mistakes).toBe(2)
    // Any key to the right answers it, not only the note that was played.
    const right = at(wrong, MIDDLE_C + 30)
    expect(right.stepIndex).toBe(1)
    expect(right.completedSteps).toBe(1)
  })
})

describe('Pitch recognition', () => {
  const lesson = buildLessonExercise('pitch-recognition', { range })
  const C_POSITION = [60, 62, 64, 65, 67]

  it('asks for five notes after middle C, then four tunes to play back, all in C position', () => {
    const finds = lesson.steps.slice(0, 5)
    for (const step of finds) {
      expect(step.prompt).toEqual([MIDDLE_C, step.answer!.from])
      expect(step.answer!.to).toBe(step.answer!.from)
    }
    expect(finds.map((step) => step.answer!.from)).toEqual([67, 64, 62, 65, 60])
    for (const step of lesson.steps) {
      expect(C_POSITION).toContain(step.answer!.from)
      expect(step.notes).toEqual([])
      expect(step.landmark).toBe(MIDDLE_C)
    }
    expect(lesson.steps).toHaveLength(5 + 3 + 3 + 3 + 5)
  })

  it('asks each tune once, for its notes in turn', () => {
    const tunes = lesson.steps.slice(5)
    // Steps of one tune share one prompt, so it is played once.
    const asked = [...new Set(tunes.map((step) => step.prompt))]
    expect(asked).toHaveLength(4)
    for (const tune of asked) {
      const steps = tunes.filter((step) => step.prompt === tune)
      expect(steps.map((step) => step.answer!.from)).toEqual(tune)
      expect(tune![0]).toBe(MIDDLE_C)
    }
  })

  it('says Higher or Lower after a wrong key, toward the note to find', () => {
    const started = sessionReducer(IDLE_SESSION, { type: 'start', at: 0 }, lesson)
    const press = (state: SessionState, note: number, at: number) =>
      sessionReducer(state, { type: 'noteOn', note, at }, lesson)
    // The first note to find is G: E is below it, A above.
    const low = press(started, 64, 1)
    expect(wrongHint(lesson, low)).toBe('Higher')
    const high = press(low, 69, 2)
    expect(wrongHint(lesson, high)).toBe('Lower')
    expect(wrongHint(lesson, press(high, 67, 3))).toBe('Lower')
    expect(press(high, 67, 3).stepIndex).toBe(1)
  })

  it('says nothing of the kind where any key of a side answers', () => {
    const highOrLow = buildLessonExercise('high-or-low', { range })
    const started = sessionReducer(IDLE_SESSION, { type: 'start', at: 0 }, highOrLow)
    const wrong = sessionReducer(started, { type: 'noteOn', note: 50, at: 1 }, highOrLow)
    expect(wrongHint(highOrLow, wrong)).toBeNull()
  })
})

describe('a lesson asked by ear', () => {
  it('has no music to show, and says what each step asks in a few words', () => {
    for (const id of ['high-or-low', 'pitch-recognition'] as const) {
      const lesson = buildLessonExercise(id, { range })
      expect(asksByEar(lesson)).toBe(true)
      for (const step of lesson.steps) expect(step.ask!.length).toBeLessThan(60)
    }
    expect(asksByEar(buildLessonExercise('hands-on-c', { range }))).toBe(false)
  })

  it('asks the notes to find, then each tune and its next notes', () => {
    const asks = buildLessonExercise('pitch-recognition', { range }).steps.map((step) => step.ask)
    expect(asks.slice(0, 5)).toEqual(Array(5).fill('Play the second note'))
    expect(asks.slice(5, 8)).toEqual(['Play it back', 'Next note', 'Next note'])
  })
})

describe('Half steps', () => {
  const lesson = buildLessonExercise('half-steps', { range })
  const keys = lesson.steps.map((step) => step.notes[0]!)
  const cueOn = (name: string, from: number) =>
    lesson.steps.find((step, at) => at >= from && step.label === name)!.fingers[0]!.cue

  it('is played like any lesson: one key a step, lit and falling, finger 3 of the right hand', () => {
    for (const step of lesson.steps) {
      expect(step.notes).toHaveLength(1)
      expect(step.fingers).toEqual([expect.objectContaining({ finger: 3, hand: 'right' })])
      expect(step.answer).toBeUndefined()
      expect(step.prompt).toBeUndefined()
    }
  })

  it('walks the letters A to G a key at a time, then back down: every move a half step', () => {
    expect(lesson.steps.map((step) => step.label)).toEqual([
      'A',
      'A♯',
      'B',
      'C',
      'C♯',
      'D',
      'D♯',
      'E',
      'F',
      'F♯',
      'G',
      'F♯',
      'F',
      'E',
      'D♯',
      'D',
      'C♯',
      'C',
      'B',
      'A♯',
      'A',
    ])
    expect(keys[0]).toBe(MIDDLE_C - 3)
    for (let at = 1; at < keys.length; at++) expect(Math.abs(keys[at]! - keys[at - 1]!)).toBe(1)
  })

  it('says what a half step is, where the next key is white each way, and where to turn', () => {
    expect(cueOn('A', 0)).toContain('very next one')
    expect(cueOn('B', 0)).toContain('No black key')
    expect(cueOn('E', 0)).toContain('no black key')
    expect(cueOn('G', 0)).toContain('back down')
    expect(cueOn('F', 11)).toContain('F and E')
    expect(cueOn('C', 11)).toContain('C and B')
  })
})

describe('Half steps, an octave lower and an octave higher', () => {
  const walk = (id: 'half-steps' | 'half-steps-lower' | 'half-steps-higher') =>
    buildLessonExercise(id, { range })

  it('is the same walk, A to G and back, twelve keys lower in the left hand and higher in the right', () => {
    const middle = walk('half-steps')
    for (const [id, by, hand] of [
      ['half-steps-lower', -12, 'left'],
      ['half-steps-higher', 12, 'right'],
    ] as const) {
      const lesson = walk(id)
      expect(lesson.id).toBe(`lesson:${id}`)
      expect(lesson.steps.map((step) => step.label)).toEqual(middle.steps.map((step) => step.label))
      expect(lesson.steps.map((step) => step.notes[0])).toEqual(
        middle.steps.map((step) => step.notes[0]! + by),
      )
      expect(lesson.steps.map((step) => step.fingers[0]!.cue)).toEqual(
        middle.steps.map((step) => step.fingers[0]!.cue),
      )
      expect(lesson.steps.every((step) => step.fingers[0]!.hand === hand)).toBe(true)
      expect(lesson.steps.every((step) => step.fingers[0]!.finger === 3)).toBe(true)
    }
    expect(walk('half-steps-lower').title).toBe('Half steps: one octave lower')
    expect(walk('half-steps-higher').title).toBe('Half steps: one octave higher')
  })

  it('leaves out a key the keyboard does not have', () => {
    const small = buildLessonExercise('half-steps-higher', { range: { low: 48, high: 72 } })
    expect(small.steps.every((step) => step.notes[0]! <= 72)).toBe(true)
  })
})

describe('Whole steps', () => {
  const lesson = buildLessonExercise('whole-steps', { range })
  const keys = lesson.steps.map((step) => step.notes[0]!)
  const cueOn = (name: string, from: number) =>
    lesson.steps.find((step, at) => at >= from && step.label === name)!.fingers[0]!.cue

  it('walks A to G a whole step at a time, then back down: every move skips one key', () => {
    expect(lesson.steps.map((step) => step.label)).toEqual([
      'A',
      'B',
      'C♯',
      'D♯',
      'F',
      'G',
      'F',
      'D♯',
      'C♯',
      'B',
      'A',
    ])
    expect(keys[0]).toBe(MIDDLE_C - 3)
    for (let at = 1; at < keys.length; at++) expect(Math.abs(keys[at]! - keys[at - 1]!)).toBe(2)
    for (const step of lesson.steps)
      expect(step.fingers).toEqual([expect.objectContaining({ finger: 3, hand: 'right' })])
  })

  it('says what a whole step is, where the key skipped is white each way, and where to turn', () => {
    expect(cueOn('A', 0)).toContain('whole step')
    expect(cueOn('B', 0)).toContain('Skip C')
    expect(cueOn('D♯', 0)).toContain('Skip E')
    expect(cueOn('G', 0)).toContain('back down')
    expect(cueOn('F', 6)).toContain('D♯')
    expect(cueOn('C♯', 6)).toContain('B')
  })

  it('has its octave lower in the left hand and its octave higher in the right', () => {
    for (const [id, by, hand, title] of [
      ['whole-steps-lower', -12, 'left', 'Whole steps: one octave lower'],
      ['whole-steps-higher', 12, 'right', 'Whole steps: one octave higher'],
    ] as const) {
      const other = buildLessonExercise(id, { range })
      expect(other.id).toBe(`lesson:${id}`)
      expect(other.title).toBe(title)
      expect(other.steps.map((step) => step.notes[0])).toEqual(keys.map((key) => key + by))
      expect(other.steps.map((step) => step.fingers[0]!.cue)).toEqual(
        lesson.steps.map((step) => step.fingers[0]!.cue),
      )
      expect(other.steps.every((step) => step.fingers[0]!.hand === hand)).toBe(true)
    }
  })

  it('introduces each of the three', () => {
    for (const id of ['whole-steps', 'whole-steps-lower', 'whole-steps-higher'] as const)
      expect(INTERVAL_ABOUT[id].objective).toContain('up to G in whole steps')
  })
})

describe('Counting intervals', () => {
  const lesson = buildLessonExercise('counting-intervals', { range })
  const pairs = Array.from({ length: lesson.steps.length / 2 }, (_, at) =>
    lesson.steps.slice(at * 2, at * 2 + 2),
  )

  it('plays middle C and each key up to G, then G and each key down to C', () => {
    expect(pairs.map((pair) => pair.map((step) => step.label).join('-'))).toEqual([
      'C-D',
      'C-E',
      'C-F',
      'C-G',
      'G-F',
      'G-E',
      'G-D',
      'G-C',
    ])
    expect(lesson.steps[0]!.notes).toEqual([MIDDLE_C])
  })

  it('fingers C position as it is, thumb on C to finger 5 on G', () => {
    for (const step of lesson.steps) {
      const finger = step.fingers[0]!
      expect(finger.hand).toBe('right')
      expect(step.notes[0]! - MIDDLE_C).toBe([0, 2, 4, 5, 7][finger.finger - 1])
    }
  })

  it('counts out the letters of each pair as its second note is played, both notes included', () => {
    const cues = pairs.map((pair) => pair[1]!.fingers[0]!.cue)
    expect(cues).toEqual([
      'C, D: two letters, a 2nd',
      'C, D, E: three letters, a 3rd',
      'C, D, E, F: four letters, a 4th',
      'C, D, E, F, G: five letters, a 5th',
      'G, F: two letters, a 2nd',
      'G, F, E: three letters, a 3rd',
      'G, F, E, D: four letters, a 4th',
      'G, F, E, D, C: five letters, a 5th',
    ])
    expect(pairs[0]![0]!.fingers[0]!.cue).toContain('first and the last')
    expect(pairs[4]![0]!.fingers[0]!.cue).toContain('down from G')
  })
})
