import { describe, expect, it } from 'vitest'
import { buildLessonExercise } from './lesson-builders.js'
import { buildScaleExercise } from './scale-exercise.js'
import { buildSong, type SongNote } from '../songs/song.js'
import { crossingNotes, songTimeline, stepAtBeat, timelineOf, timingOf } from './timeline.js'
import { DEFAULT_SCALE_SPEC } from './practice-defaults.js'

/**
 * The timeline falling notes are drawn from: every note at its beat, as long as
 * it is written, with the hand and finger that play it.
 */
describe('an exercise laid out in time', () => {
  it('starts each step where the one before ends', () => {
    const scale = buildScaleExercise(DEFAULT_SCALE_SPEC)
    const { notes, stepStarts } = timelineOf(scale)
    expect(stepStarts).toHaveLength(scale.steps.length + 1)
    expect(stepStarts[0]).toBe(0)
    for (let i = 1; i < stepStarts.length; i++)
      expect(stepStarts[i]! - stepStarts[i - 1]!).toBe(scale.steps[i - 1]!.beats ?? 1)
    expect(notes.every((note) => note.start === stepStarts[note.step])).toBe(true)
  })

  it('keeps both notes of a two-key step together, with their hand and finger', () => {
    const groups = timelineOf(buildLessonExercise('two-black-key-groups'))
    const first = groups.notes.filter((note) => note.step === 0)
    expect(first).toEqual([
      { step: 0, note: 37, start: 0, beats: 1, hand: 'left', finger: 4 },
      { step: 0, note: 39, start: 0, beats: 1, hand: 'left', finger: 3 },
    ])
    expect(groups.stepStarts).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('finds the step at a beat, or the next, and never past the last', () => {
    const groups = timelineOf(buildLessonExercise('two-black-key-groups'))
    expect(stepAtBeat(groups, -3)).toBe(0)
    expect(stepAtBeat(groups, 2)).toBe(2)
    expect(stepAtBeat(groups, 2.4)).toBe(3)
    expect(stepAtBeat(groups, 99)).toBe(4)
  })

  it('calls a step on time within the margin, and early or late past it', () => {
    expect(timingOf(1000, 1000)).toBe('on-time')
    expect(timingOf(1140, 1000)).toBe('on-time')
    expect(timingOf(800, 1000)).toBe('early')
    expect(timingOf(1200, 1000)).toBe('late')
  })
})

describe('a song laid out in time', () => {
  // 120 BPM: a beat is half a second.
  const note = (
    pitch: number,
    startMs: number,
    hand: 'left' | 'right',
    finger?: number,
  ): SongNote => ({
    note: pitch,
    velocity: 80,
    startMs,
    durationMs: 500,
    hand,
    role: 'keyboard',
    ...(finger !== undefined && { finger }),
  })
  const notes = [note(60, 0, 'right', 1), note(48, 0, 'left', 5), note(62, 500, 'right', 2)]
  const song = (sections?: { startMs: number; fromMs: number; toMs: number }[]) =>
    buildSong({
      id: 's',
      title: 'S',
      bpm: 120,
      beatsPerMeasure: 4,
      notes,
      source: 'musicxml',
      handsInferred: false,
      ...(sections && { sections }),
    })

  it('puts each note at its beat with its hand and finger, a chord one step', () => {
    const { notes: timed, stepStarts } = songTimeline(song())
    expect(stepStarts.slice(0, 2)).toEqual([0, 1])
    expect(timed.map((n) => [n.step, n.note, n.start, n.beats, n.hand, n.finger])).toEqual([
      [0, 48, 0, 1, 'left', 5],
      [0, 60, 0, 1, 'right', 1],
      [1, 62, 1, 1, 'right', 2],
    ])
  })

  it('plays a repeat where it is heard: the same notes again, later', () => {
    const repeated = songTimeline(
      song([
        { startMs: 0, fromMs: 0, toMs: 1000 },
        { startMs: 1000, fromMs: 0, toMs: 1000 },
      ]),
    )
    expect(repeated.stepStarts.slice(0, 4)).toEqual([0, 1, 2, 3])
    expect(repeated.notes.filter((n) => n.note === 62).map((n) => n.start)).toEqual([1, 3])
  })

  it('takes only the hand that is played', () => {
    expect(songTimeline(song(), 'left').notes.map((n) => n.note)).toEqual([48])
  })
})

/** The notes a hand crosses to, in any music with fingers on it. */
describe('crossingNotes', () => {
  const crossed = (notes: ReturnType<typeof timelineOf>['notes']) =>
    [...crossingNotes(notes)].map((note) => `${note.hand} ${note.finger} ${note.note}`)

  it('finds the lesson’s own: 3 over to F in the left hand, the thumb under to D in the right', () => {
    const { notes } = timelineOf(buildLessonExercise('notes-a-through-g'))
    expect(crossed(notes).sort()).toEqual(['left 3 53', 'right 1 62'])
  })

  it('finds them in a scale, both ways: the thumb under going up, a finger over coming down', () => {
    const { notes } = timelineOf(
      buildScaleExercise({ ...DEFAULT_SCALE_SPEC, direction: 'up-down' }),
    )
    const found = crossingNotes(notes)
    expect(found.size).toBeGreaterThan(0)
    const up = [...found].filter((note) => note.hand === 'right' && note.finger === 1)
    const over = [...found].filter((note) => note.hand === 'right' && note.finger !== 1)
    expect(up.length).toBeGreaterThan(0)
    expect(over.length).toBeGreaterThan(0)
  })

  it('finds them in a song, on black keys too', () => {
    const note = (step: number, pitch: number, finger: number) => ({
      step,
      note: pitch,
      start: step,
      beats: 1,
      hand: 'right' as const,
      finger,
    })
    // E♭ with 3, then F with the thumb tucked under.
    expect(crossed([note(0, 63, 3), note(1, 65, 1)])).toEqual(['right 1 65'])
  })

  it('leaves out fingers in order, a key played again, chords, and the other hand', () => {
    const at = (
      start: number,
      pitch: number,
      finger: number,
      hand: 'left' | 'right' = 'right',
    ) => ({
      step: start,
      note: pitch,
      start,
      beats: 1,
      hand,
      finger,
    })
    expect(crossed([at(0, 60, 1), at(1, 62, 2), at(2, 64, 3)])).toEqual([])
    expect(crossed([at(0, 60, 3), at(1, 60, 1)])).toEqual([])
    expect(crossed([at(0, 64, 3), at(0, 67, 5), at(1, 65, 1)])).toEqual([])
    expect(crossed([at(0, 52, 1, 'left'), at(1, 53, 1)])).toEqual([])
  })
})
