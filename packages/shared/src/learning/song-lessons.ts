import type { NoteRange } from '../domain/device-schemas.js'
import type { Hand } from '../music/fingering.js'
import type { Exercise, ExerciseFingering, ExerciseMeter, ExerciseStep } from './exercise.js'
import { LETTER_OF, MIDDLE_C, positionFinger } from './lesson-keys.js'

/*
 * A song as a lesson: written phrase by phrase in note names and beats, in a
 * five-finger position, and made into an exercise with each key's finger
 * counted from its hand's thumb. Shared by every section whose lessons are
 * songs (`hand-position-lessons.ts`).
 */

/** A key by name and octave, middle C being C4. Naturals only: the positions are white keys. */
function key(name: string): number {
  const pc = Number(Object.entries(LETTER_OF).find(([, letter]) => letter === name[0])![0])
  return (Number(name.slice(1)) + 1) * 12 + pc
}

/**
 * A phrase of a song in one hand: its notes as `E4:1.5` (a key and its beats,
 * one beat when left out), and a rest after a note as `-1` (its beats).
 */
export interface Phrase {
  /**
   * The hand that plays it, or `by-pitch` where both thumbs share middle C and
   * the tune crosses between them: below middle C the left, from it the right.
   */
  readonly hand: Hand | 'by-pitch'
  readonly notes: string
  /** Said as the phrase starts. */
  readonly cue?: string
}

/** A song in a five-finger position, phrase by phrase. */
export interface Song {
  readonly id: string
  readonly title: string
  readonly subtitle: string
  readonly meter: ExerciseMeter
  /** Beats before the first full bar. */
  readonly pickup?: number
  readonly bpm: number
  /** Where each hand's thumb is: every other finger counts from it. */
  readonly thumbs: Readonly<Partial<Record<Hand, number>>>
  /** What a key is called on screen: its letter, or the finger that plays it. */
  readonly naming: 'letter' | 'finger'
  readonly phrases: readonly Phrase[]
}

/** The steps of the song, a key to a step, each with its finger, length and name. */
function stepsOf(song: Song, range: NoteRange): ExerciseStep[] {
  const steps: ExerciseStep[] = []
  song.phrases.forEach(({ hand: playing, notes, cue }, part) => {
    let first = true
    for (const token of notes.split(/\s+/)) {
      if (token.startsWith('-')) {
        // A rest: the last note is let go, and the next one is due that much later.
        const last = steps.pop()!
        const beats = last.beats ?? 1
        steps.push({ ...last, beats: beats + Number(token.slice(1)), holds: [beats] })
        continue
      }
      const [, name, length] = /^([A-G]\d)(?::([\d.]+))?$/.exec(token)!
      const note = key(name!)
      if (note < range.low || note > range.high) continue
      const hand: Hand = playing === 'by-pitch' ? (note < MIDDLE_C ? 'left' : 'right') : playing
      const finger = positionFinger(note, song.thumbs[hand]!)
      const label = song.naming === 'finger' ? String(finger) : LETTER_OF[note % 12]!
      steps.push({
        id: `${part}-${steps.length}-${note}`,
        notes: [note],
        fingers: [{ finger, hand }],
        label,
        noteLabels: [label],
        ...(length && { beats: Number(length) }),
        ...(first && cue && { cue }),
      })
      first = false
    }
  })
  return steps
}

/** A lesson's exercise from its song. */
export function songLesson(song: Song, range: NoteRange): Exercise {
  const steps = stepsOf(song, range)
  const pitchClasses = [
    ...new Set(steps.flatMap((step) => step.notes.map((note) => note % 12))),
  ].sort((a, b) => a - b)
  // One row per hand that plays: its five fingers, thumb first.
  const fingerings: ExerciseFingering[] = (['left', 'right'] as const)
    .filter((hand) => steps.some((step) => step.fingers[0]?.hand === hand))
    .map((hand) => ({ hand, fingers: [1, 2, 3, 4, 5], source: 'alfred' }))
  return {
    id: `lesson:${song.id}`,
    kind: 'exercise',
    title: song.title,
    subtitle: song.subtitle,
    steps,
    pitchClasses,
    rootPitchClass: 0,
    pitchNames: Object.fromEntries(pitchClasses.map((pc) => [pc, LETTER_OF[pc]!])),
    notes: steps.flatMap((step) => step.notes),
    // In C: no sharps or flats to write.
    keyFifths: 0,
    facts: [{ label: 'Notes', value: String(steps.length) }],
    fingerings,
    defaultBpm: song.bpm,
    meter: song.meter,
    ...(song.pickup && { pickup: song.pickup }),
  }
}
