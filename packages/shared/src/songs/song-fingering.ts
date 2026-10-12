import { fingerSteps } from '../music/finger-steps.js'
import type { Hand } from '../music/fingering.js'
import {
  DEFAULT_FINGERING_SYSTEM,
  fingeringSystem,
  type FingeringSystem,
  type FingeringSystemId,
} from '../music/fingering-system.js'
import type { Finger } from '../music/hand-model.js'
import { songSteps, type Song, type SongNote, type SongStep } from './song.js'

/**
 * A finger for every note of a song.
 *
 * MIDI has nowhere to record which finger plays a note — the format has no
 * field for it — and a published score marks only the fingers that are in
 * doubt: where the hand is put down, where it moves, where the obvious choice
 * is the wrong one. Everything between those is left to the player, who is
 * expected to know how a hand lies and how a scale is fingered. A learner does
 * not, yet. So this works the rest out, the way the player would.
 *
 * ## What it goes on
 *
 * **What the score prints.** A finger an editor wrote is the one thing about
 * a passage that is known and not inferred. It is kept, exactly, and the notes
 * around it are fingered to arrive at it and to leave it — which is what the
 * mark was for. A score with a few fingers in it used to be left with only
 * those; now they are where the rest starts from.
 *
 * **How a hand lies.** Each hand's part is cut into stretches and each stretch
 * is fingered by `fingerSteps`, which searches every way the hand could take it
 * against a published model of what a hand finds difficult. Single notes,
 * intervals and chords are all steps; the search does not care which is which,
 * so a part that alternates between them is fingered end to end.
 *
 * **How scales and arpeggios are fingered.** A run up or down a scale is
 * fingered as that scale is, and a run through a chord as its arpeggio is, by
 * whichever fingering system is chosen — so the left hand running down G major
 * in a piece takes the fingers it was taught for G major, and takes different
 * ones under a different system. See `passageFingers`.
 *
 * ## What it says about itself
 *
 * A note the score fingered is marked as given, and the song says which of
 * three things it is: fingered by the score, worked out, or the score's
 * fingering with the rest worked out. A suggested finger drawn as though the
 * score asked for it is worse than no finger.
 *
 * A stretch ends at a rest long enough for the hand to reposition, after which
 * the fingering before it constrains nothing.
 */

/** Long enough that the hand can lift, move and land somewhere new. */
const REPOSITION_MS = 700

function runsFor(song: Song, hand: Hand): SongStep[][] {
  const runs: SongStep[][] = []
  let current: SongStep[] = []

  for (const step of songSteps(song, hand)) {
    const previous = current.at(-1)
    const gap = previous
      ? step.startMs - Math.max(...previous.notes.map((n) => n.startMs + n.durationMs))
      : 0
    if (previous && gap > REPOSITION_MS) {
      runs.push(current)
      current = []
    }
    current.push(step)
  }
  if (current.length > 0) runs.push(current)
  return runs
}

// --- Scales and arpeggios in a passage ---------------------------------------

/** The keys a fingering system prints, by tonic: how each is named on its page. */
const MAJOR_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']
const MINOR_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'B♭', 'B']

const SCALE_STEPS: Readonly<Record<string, readonly number[]>> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  'natural-minor': [0, 2, 3, 5, 7, 8, 10],
  'harmonic-minor': [0, 2, 3, 5, 7, 8, 11],
  'melodic-minor': [0, 2, 3, 5, 7, 9, 11],
}

/**
 * Fewer notes than this in a row lie under one hand position, and are fingered
 * as a hand position: five notes up a scale are 1 2 3 4 5 whatever the scale.
 * From six the thumb has to pass, and where it passes is what a scale
 * fingering is.
 */
const SCALE_RUN = 6
/** The same for a broken chord: four notes fit the hand, and the fifth does not. */
const ARPEGGIO_RUN = 5

const pitchClass = (note: number) => ((note % 12) + 12) % 12

interface ScaleChoice {
  readonly tonic: number
  readonly typeId: string
}

/**
 * The scales a run might be, the song's own key first.
 *
 * Seven notes in a row do not say which scale they are from: C D E F G A is as
 * much F major as C. The fingers differ — the thumb is somewhere else — so the
 * question has an answer that matters, and the best evidence is the key the
 * piece is in. After that, its relative, and then every other key by how far
 * round the circle of fifths it is.
 */
function scaleChoices(song: Song): ScaleChoice[] {
  const key = song.key
  const home = key ? key.pitchClass : 0
  const minor = key?.mode === 'minor'
  // The major key with the song's signature, and its distance to every other.
  const signature = minor ? pitchClass(home + 3) : home
  const byDistance = Array.from({ length: 12 }, (_, tonic) => tonic).sort((a, b) => {
    const away = (tonic: number) => {
      const fifths = pitchClass((tonic - signature) * 7)
      return Math.min(fifths, 12 - fifths)
    }
    return away(a) - away(b) || a - b
  })

  const choices: ScaleChoice[] = []
  for (const major of byDistance) {
    const relative = pitchClass(major + 9)
    const pair: ScaleChoice[] = [
      { tonic: major, typeId: 'major' },
      { tonic: relative, typeId: 'natural-minor' },
      { tonic: relative, typeId: 'harmonic-minor' },
      { tonic: relative, typeId: 'melodic-minor' },
    ]
    // In a minor key the minor reading of its own notes comes before the major.
    choices.push(...(minor ? [pair[1]!, pair[2]!, pair[3]!, pair[0]!] : pair))
  }
  return choices
}

/**
 * What a system prints for one hand, looked up once: the finger each degree of
 * each scale takes, and each note of each triad.
 *
 * Asked for per stretch it was most of the time a song took to open. A song is
 * hundreds of stretches and a system is forty-eight scales, and its answer for
 * a scale does not depend on which stretch is asking.
 */
interface HandBook {
  readonly scales: ReadonlyMap<string, readonly number[]>
  readonly triads: readonly {
    readonly tones: readonly number[]
    readonly cycle: readonly number[]
  }[]
}

const BOOKS = new Map<string, HandBook>()

function bookFor(system: FingeringSystem, hand: Hand): HandBook {
  const key = `${system.id}:${hand}`
  const known = BOOKS.get(key)
  if (known) return known

  const scales = new Map<string, readonly number[]>()
  for (const [typeId, offsets] of Object.entries(SCALE_STEPS)) {
    for (let tonic = 0; tonic < 12; tonic++) {
      const cycle = system.scale({
        tonic: (typeId === 'major' ? MAJOR_NAMES : MINOR_NAMES)[tonic]!,
        scaleTypeId: typeId,
        hand,
        octaves: 1,
        notes: [...offsets, 12].map((offset) => 60 + tonic + offset),
      })?.cycle
      if (cycle) scales.set(`${tonic}:${typeId}`, cycle)
    }
  }

  const triads: { tones: number[]; cycle: number[] }[] = []
  for (let root = 0; root < 12; root++) {
    for (const mode of ['major', 'minor'] as const) {
      const run = system.arpeggio({
        tonic: (mode === 'major' ? MAJOR_NAMES : MINOR_NAMES)[root]!,
        mode,
        kind: 'triad',
        position: 0,
        hand,
        octaves: 2,
      })
      // Root, third, fifth as the middle of the run takes them, clear of how
      // it opens and turns.
      if (!run || run.length < 6) continue
      triads.push({
        tones: [root, pitchClass(root + (mode === 'major' ? 4 : 3)), pitchClass(root + 7)],
        cycle: [run[3]!, run[4]!, run[5]!],
      })
    }
  }

  const book = { scales, triads }
  BOOKS.set(key, book)
  return book
}

/** The two groups of a scale, three notes and four, as each hand takes them going up. */
const SCALE_GROUPS: Readonly<Record<Hand, readonly number[]>> = {
  right: [1, 2, 3, 1, 2, 3, 4],
  left: [3, 2, 1, 4, 3, 2, 1],
}

const isBlack = (note: number) => [1, 3, 6, 8, 10].includes(pitchClass(note))

/** A stretch of steps that is one scale or one chord, and the finger each of its notes takes. */
interface Passage {
  readonly start: number
  readonly end: number
  /** One per step from `start`. */
  readonly fingers: readonly (number | undefined)[]
  /** Whether the first and last notes are left to the search. */
  readonly openEnds: boolean
  /** Lower is asked first, between passages of one length. */
  readonly rank: number
}

/**
 * The finger each note of a scale run, an arpeggio or a broken chord takes
 * under the chosen system, for the steps of one stretch: a finger where the
 * step is one note of such a passage, and nothing where it is not.
 *
 * - **A scale run** is notes one after another in one direction, each the next
 *   degree of a scale from the last, for long enough that the thumb has to
 *   pass. It is fingered as the system fingers that scale.
 * - **An arpeggio** is the same through the notes of a triad.
 * - **A broken chord** is the notes of one chord under one hand position, in
 *   any order — an Alberti bass — and is fingered as the chord is held.
 *
 * Where two readings cover the same notes the longer wins: A to G♯ up a
 * harmonic minor is one run of that scale, not six notes of the natural minor
 * and a stray.
 *
 * The first and last notes of a run are left to the search. A scale's
 * fingering says where the thumb passes; how the hand arrives at the run and
 * what it does at the top are decided by what the run joins, as a scale book's
 * own opening and closing fingers are.
 *
 * And a finger the score prints inside a run is the editor saying where the
 * thumb goes. The run is then fingered in the same two groups, placed so that
 * they agree with it; where no placing agrees, the editor has something else
 * in mind and nothing is offered against it.
 */
export function passageFingers(
  steps: readonly (readonly number[])[],
  hand: Hand,
  song: Song,
  system: FingeringSystem,
  /** The fingers the score prints on these steps, as `fingerSteps` is given them. */
  given: readonly (readonly (Finger | undefined)[] | undefined)[] = [],
  /** The scales to try, in order. Worked out from the song when left out. */
  choices: readonly ScaleChoice[] = scaleChoices(song),
): (Finger | undefined)[] {
  const book = bookFor(system, hand)
  const single = (index: number) => (steps[index]!.length === 1 ? steps[index]![0]! : null)
  const printedAt = (index: number) => (steps[index]!.length === 1 ? given[index]?.[0] : undefined)
  const found: Passage[] = []

  /** Every stretch of `enough` or more single notes in one direction that `joined` strings together. */
  const runs = (
    enough: number,
    member: (note: number) => boolean,
    joined: (from: number, to: number) => boolean,
  ): [start: number, end: number][] => {
    const out: [number, number][] = []
    let start = 0
    while (start < steps.length) {
      const first = single(start)
      if (first === null || !member(first)) {
        start += 1
        continue
      }
      let end = start
      let direction = 0
      while (end + 1 < steps.length) {
        const here = single(end)!
        const next = single(end + 1)
        if (next === null || !member(next)) break
        const turn = Math.sign(next - here)
        if (turn === 0 || (direction !== 0 && turn !== direction) || !joined(here, next)) break
        direction = turn
        end += 1
      }
      if (end - start + 1 >= enough) out.push([start, end])
      // A run that turns round shares its top note with the run back down.
      start = end > start ? end : start + 1
    }
    return out
  }

  /** Whether the fingers offered for a run agree with every finger printed inside it. */
  const agrees = (start: number, end: number, finger: (index: number) => number | undefined) => {
    for (let index = start + 1; index < end; index++) {
      const printed = printedAt(index)
      if (printed !== undefined && printed !== finger(index)) return false
    }
    return true
  }

  choices.forEach(({ tonic, typeId }, rank) => {
    const cycle = book.scales.get(`${tonic}:${typeId}`)
    if (!cycle) return
    const offsets = SCALE_STEPS[typeId]!
    const degreeOf = new Map(offsets.map((offset, degree) => [pitchClass(tonic + offset), degree]))
    const degree = (index: number) => degreeOf.get(pitchClass(single(index)!))!

    const stretches = runs(
      SCALE_RUN,
      (note) => degreeOf.has(pitchClass(note)),
      (from, to) => {
        const a = degreeOf.get(pitchClass(from))!
        const b = degreeOf.get(pitchClass(to))!
        // The next degree, and the next key: not the same degree an octave on.
        return (to > from ? (a + 1) % 7 === b : (b + 1) % 7 === a) && Math.abs(to - from) <= 3
      },
    )
    for (const [start, end] of stretches) {
      let groups: readonly number[] | null = cycle
      if (!agrees(start, end, (index) => cycle[degree(index)])) {
        // The same two groups, started wherever agrees with what is printed —
        // never with a thumb on a black key the editor did not put it on, and
        // otherwise as near the system's own fingering as it can be.
        groups = null
        let nearest = -1
        for (let turn = 0; turn < 7; turn++) {
          const placed = SCALE_GROUPS[hand].map((_, at) => SCALE_GROUPS[hand][(at + turn) % 7]!)
          if (!agrees(start, end, (index) => placed[degree(index)])) continue
          const thumbOnBlack = placed.some(
            (finger, at) => finger === 1 && isBlack(tonic + offsets[at]!),
          )
          if (thumbOnBlack) continue
          const alike = placed.filter((finger, at) => finger === cycle[at]).length
          if (alike > nearest) {
            nearest = alike
            groups = placed
          }
        }
      }
      if (!groups) continue
      const placed = groups
      found.push({
        start,
        end,
        fingers: Array.from({ length: end - start + 1 }, (_, at) => placed[degree(start + at)]),
        openEnds: true,
        rank,
      })
    }
  })

  for (const { tones, cycle } of book.triads) {
    const finger = (index: number) => cycle[tones.indexOf(pitchClass(single(index)!))]
    const stretches = runs(
      ARPEGGIO_RUN,
      (note) => tones.includes(pitchClass(note)),
      (from, to) => Math.abs(to - from) <= 5,
    )
    for (const [start, end] of stretches) {
      if (!agrees(start, end, finger)) continue
      found.push({
        start,
        end,
        fingers: Array.from({ length: end - start + 1 }, (_, at) => finger(start + at)),
        openEnds: true,
        rank: 100,
      })
    }
  }

  found.push(...brokenChords(steps, hand, system, printedAt))

  // The longest reading of any notes first, and a passage only where nothing
  // longer has already spoken for the notes inside it.
  const preferred: (Finger | undefined)[] = steps.map(() => undefined)
  const spoken = steps.map(() => false)
  found.sort((a, b) => b.end - b.start - (a.end - a.start) || a.rank - b.rank || a.start - b.start)
  for (const passage of found) {
    let { start, end } = passage
    while (start < end && spoken[start]) start += 1
    while (end > start && spoken[end]) end -= 1
    const least = passage.openEnds ? SCALE_RUN - 1 : BROKEN_CHORD
    if (end - start + 1 < Math.min(least, passage.end - passage.start + 1)) continue
    if (spoken.slice(start, end + 1).some(Boolean)) continue
    for (let index = start; index <= end; index++) {
      spoken[index] = true
      const outer = index === passage.start || index === passage.end
      if (passage.openEnds && outer) continue
      const finger = passage.fingers[index - passage.start]
      if (finger !== undefined) preferred[index] = finger as Finger
    }
  }
  return preferred
}

/** A chord has to come round at least this many notes to be a figure and not a coincidence. */
const BROKEN_CHORD = 4

/** A triad's position, by the two gaps between its notes from the bottom. */
const TRIAD_SHAPES: Readonly<Record<string, { mode: 'major' | 'minor'; position: number }>> = {
  '4,3': { mode: 'major', position: 0 },
  '3,4': { mode: 'minor', position: 0 },
  '3,5': { mode: 'major', position: 1 },
  '4,5': { mode: 'minor', position: 1 },
  '5,4': { mode: 'major', position: 2 },
  '5,3': { mode: 'minor', position: 2 },
}

/**
 * The broken chords of a stretch: an Alberti bass, a rocking accompaniment —
 * the three notes of one triad under one hand position, in whatever order,
 * until the harmony moves.
 *
 * Fingered as the chord is held, which is how they are played: the hand takes
 * the shape and the fingers go down in turn. The span table alone cannot
 * choose between 5 3 1 and 4 2 1 for C–E–G in the left hand; a scale book can,
 * and its chord pages are what is asked.
 */
function brokenChords(
  steps: readonly (readonly number[])[],
  hand: Hand,
  system: FingeringSystem,
  printedAt: (index: number) => Finger | undefined,
): Passage[] {
  const found: Passage[] = []
  const single = (index: number) => (steps[index]!.length === 1 ? steps[index]![0]! : null)

  const close = (start: number, end: number, keys: readonly number[]) => {
    if (end - start + 1 < BROKEN_CHORD || keys.length !== 3) return
    const shape = TRIAD_SHAPES[`${keys[1]! - keys[0]!},${keys[2]! - keys[1]!}`]
    if (!shape) return
    const grip = system.chord({ kind: 'triad', mode: shape.mode, position: shape.position, hand })
    if (!grip) return
    const finger = (index: number) => grip[keys.indexOf(single(index)!)]
    for (let index = start; index <= end; index++) {
      const printed = printedAt(index)
      if (printed !== undefined && printed !== finger(index)) return
    }
    found.push({
      start,
      end,
      fingers: Array.from({ length: end - start + 1 }, (_, at) => finger(start + at)),
      openEnds: false,
      rank: 200,
    })
  }

  let start = 0
  let keys: number[] = []
  for (let index = 0; index <= steps.length; index++) {
    const note = index < steps.length ? single(index) : null
    const grown =
      note === null ? null : keys.includes(note) ? keys : [...keys, note].sort((a, b) => a - b)
    // One chord for as long as its keys are three or fewer and under one hand.
    if (grown !== null && grown.length <= 3 && grown.at(-1)! - grown[0]! <= 12) {
      keys = grown
      continue
    }
    close(start, index - 1, keys)
    start = index
    keys = note === null ? [] : [note]
    if (note === null) start = index + 1
  }
  return found
}

// --- The song ----------------------------------------------------------------

export interface FingerSongOptions {
  /** The fingering system scales and arpeggios are fingered by. The default one when left out. */
  readonly system?: FingeringSystemId
}

/**
 * Whether a note's finger is the score's.
 *
 * A note says so itself once a song has been through here. Before that, a song
 * read from a file has only the fingers the file held, and one fingered by an
 * older Motius has only the ones Motius worked out — never both, because a
 * score with any fingering in it used to be left alone.
 */
function givenIn(song: Song): Set<SongNote> {
  const marked = song.notes.some((note) => note.fingerGiven)
  const fromFile = !marked && song.fingeringSource === 'score'
  return new Set(
    song.notes.filter(
      (note) =>
        note.finger !== undefined &&
        note.finger >= 1 &&
        note.finger <= 5 &&
        (note.fingerGiven === true || fromFile),
    ),
  )
}

/**
 * Fingers a song: every keyboard note of it.
 *
 * Safe to run again, and meant to be — on a song already fingered, with a
 * different system chosen. The score's own fingers are kept and everything
 * else is worked out afresh.
 */
export function fingerSong(song: Song, options: FingerSongOptions = {}): Song {
  const system = fingeringSystem(options.system ?? DEFAULT_FINGERING_SYSTEM)

  const printed = givenIn(song)
  const choices = scaleChoices(song)
  const chosen = new Map<SongNote, number>()
  // Chords the hand cannot close on at once. Kept per note rather than per
  // step, because a step can span both hands and only one of them may be
  // spread — and because the note is what everything downstream holds.
  const spread = new Set<SongNote>()

  for (const hand of ['right', 'left'] as const) {
    for (const run of runsFor(song, hand)) {
      // Each step's keys in pitch order, which is the order a grip is held in.
      // A key written twice in one step — two voices meeting on a unison — is
      // one key, under one finger.
      const pitches = run.map((step) =>
        [...new Set(step.notes.map((note) => note.note))].sort((a, b) => a - b),
      )
      const marks = run.map((step, index) => {
        const slots = pitches[index]!.map((pitch) => {
          const marked = step.notes.find((note) => note.note === pitch && printed.has(note))
          return marked?.finger as Finger | undefined
        })
        return slots.some((finger) => finger !== undefined) ? slots : undefined
      })
      const fingered = fingerSteps(pitches, hand, {
        given: marks,
        preferred: passageFingers(pitches, hand, song, system, marks, choices),
      })
      fingered.forEach((step, index) => {
        if (!step) return
        for (const note of run[index]!.notes) {
          chosen.set(note, step.fingers[pitches[index]!.indexOf(note.note)]!)
          if (step.rolled) spread.add(note)
        }
      })
    }
  }
  if (chosen.size === 0 && printed.size === 0) return song

  let workedOut = 0
  const notes = song.notes.map((note): SongNote => {
    // Whatever an earlier pass worked out is not carried over: it is worked
    // out again, or it is gone.
    const { finger: _finger, rolled: _rolled, fingerGiven: _given, ...bare } = note
    if (printed.has(note)) return { ...bare, finger: note.finger!, fingerGiven: true }
    const finger = chosen.get(note)
    if (finger === undefined) return bare
    workedOut += 1
    return spread.has(note) ? { ...bare, finger, rolled: true } : { ...bare, finger }
  })

  return {
    ...song,
    notes,
    hasFingering: true,
    // `provides` is about what the *file* held, and is not touched. What this
    // says is where the fingers on the notes came from, which is a different
    // claim and is shown as one.
    fingeringSource: printed.size === 0 ? 'derived' : workedOut === 0 ? 'score' : 'mixed',
    fingeredBy: system.id,
  }
}
