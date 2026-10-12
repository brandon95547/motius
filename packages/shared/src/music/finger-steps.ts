import type { Hand } from './fingering.js'
import {
  FINGERS,
  chordCost,
  overreach,
  reach,
  moveCost,
  pairCost,
  reachable,
  tripleCost,
  type Finger,
} from './hand-model.js'

/**
 * Fingering a part that has chords in it as well as single notes.
 *
 * `fingerPassage` handles a melodic line, which is what the published model
 * covers. Real piano music is not that: a hand plays a note, then two, then
 * three, then one again. This searches the same way over *steps* — a step being
 * whatever sounds at once — so a part is fingered end to end instead of in the
 * fragments between its chords.
 *
 * Where every step is a single note this is the melodic model exactly, rule for
 * rule, which is what keeps the one part of this that was independently
 * validated from drifting.
 */

/** More than this and the search is not worth its own precision. */
const CANDIDATE_LIMIT = 6

/**
 * The chord fingerings the method books print, keyed by shape.
 *
 * A chord's shape is the intervals between its notes, low to high — nothing
 * else is needed. `(4, 3)` is a major triad in root position, `(3, 5)` a minor
 * triad in first inversion, `(6, 2)` the three-note dominant seventh a cadence
 * uses. The key does not appear, the root does not appear, and neither is
 * missed: page 88 runs major, minor, diminished and augmented triads on one
 * root and fingers all four alike.
 *
 * These exist because the hand model cannot reach them. `1 3 5` and `1 2 4`
 * cost a C major triad exactly the same — relaxed at every pair, one weak
 * finger each — so the spans leave the choice open and only a book settles it.
 *
 * Sources: pages 8, 9, 88 and 89 for the block triads, and the three cadence
 * positions of pages 21, 45 and 51 for the seventh voicings. Every entry here
 * is a shape the source fingers the *same way* every time it prints it. Shapes
 * it fingers differently in different places are deliberately absent — those
 * are decided by what surrounds them, which is the search's job and not a
 * table's.
 */
interface Shape {
  readonly right?: readonly Finger[]
  readonly left?: readonly Finger[]
  /**
   * Whether the source prints this shape the same way everywhere it appears.
   *
   * A firm shape settles the matter: the book's answer is taken even where the
   * hand model would rather have something else, which happens — the three-note
   * dominant seventh is fingered 1 2 4, and by span alone 1 2 5 is easier. The
   * book is fingering it for the chord it resolves to. That is the knowledge
   * being borrowed, and overruling it with a span table defeats the point.
   *
   * A soft shape is a default that context may move, and every left-hand shape
   * read from the cadences is one: not a single one is fingered the same way in
   * all three positions.
   */
  readonly firm?: boolean
}

const SHAPES: Record<string, Shape> = {
  // Triads, root position: a third then a third.
  '3,4': { right: [1, 3, 5], left: [5, 3, 1] },
  '4,3': { right: [1, 3, 5], left: [5, 3, 1] },
  '3,3': { right: [1, 3, 5], left: [5, 3, 1] },
  '4,4': { right: [1, 3, 5], left: [5, 3, 1] },
  // First inversion: a third then a fourth.
  '3,5': { right: [1, 2, 5], left: [5, 3, 1], firm: true },
  '4,5': { right: [1, 2, 5], left: [5, 3, 1], firm: true },
  // Second inversion: a fourth then a third.
  '5,3': { right: [1, 3, 5], left: [5, 2, 1] },
  '5,4': { right: [1, 3, 5], left: [5, 2, 1] },
  // Three-note dominant sevenths, from the cadences. The right hand is the
  // same in all three keys read; the left is not, so it is left to the search.
  //
  // Two of these are the shapes the source prints — D-F-B and B-F-G, in C. The
  // third is the remaining rotation of the same shell, F-G-B, which the source
  // never reaches because its cadence pages take that inversion with four notes.
  // It was keyed `2,3` for a long time, which is F-G-B♭ — a minor seventh, not
  // a dominant one, and a chord this comment does not describe.
  '3,6': { right: [1, 2, 4], firm: true },
  '6,2': { right: [1, 4, 5], firm: true },
  '2,4': { right: [1, 2, 4], firm: true },
}

/** How far a published shape outweighs what the spans alone would choose. */
const FIRM_SHAPE = 10
/** A chord too wide to put down at once, played from the outside in. */
const ROLL = 3
const DEFAULT_SHAPE = 2
/**
 * The finger a scale or an arpeggio puts on a note, where the note is part of
 * one.
 *
 * Enough to carry a fingering the spans would not choose: the traditional left
 * hand takes D major's arpeggio 5 4 2 1, a third between the two weakest
 * fingers, and the model would rather have 5 3 2 1 by seven points. A scale
 * book's fingering is being borrowed for what it knows about the whole run,
 * as a published chord shape is. And little enough that the note where a run
 * begins or leaves off is still decided by what it joins.
 */
const PREFERRED = 8
/**
 * The hand lifted and set down again, where it need not have been: two notes
 * that some pair of fingers reaches, taken with a pair that does not.
 *
 * It used to be forbidden outright, which is the right answer for a pair of
 * notes and the wrong one for a passage. Three notes an octave apart, going
 * up, are thumb, little finger, and then nothing: the little finger cannot be
 * the lower note of anything. With no way through, the whole stretch came back
 * unfingered — one bar of broken octaves blanked the nine hundred notes it sat
 * among.
 *
 * And a hand does this for comfort, not only in a corner. A waltz bass is a
 * low note and then a chord an octave up: the octave is in reach of 5 and 1,
 * and nobody plays it that way and then crosses over the thumb for the rest —
 * the hand lets go of the bass and takes the chord as a chord. So the move is
 * priced, not prohibited, and priced by how far apart the two notes are. Next
 * door to each other, a move is a break in a line that a thumb passing under
 * would have joined, and costs more than any fingering in position does. An
 * octave apart it is what a hand does without thinking, and costs little. On
 * top of how far the hand travels (`leapCost`).
 */
const SHIFT_NEAR = 22
/** What each semitone between the two notes takes off that. */
const SHIFT_EASES = 1.5
/** What a move still costs however far apart they are. */
const SHIFT_FAR = 4
const shift = (interval: number) =>
  Math.max(SHIFT_FAR, SHIFT_NEAR - SHIFT_EASES * Math.abs(interval))
/**
 * The same finger on two different notes running: a hop, or a slide. The last
 * resort among moves, which is how it stays one — it is what put the thumb on
 * two notes in a row when a move cost nothing.
 */
const SAME_FINGER = 6
/**
 * A different finger on a note struck again. What a repeated note is given
 * when the hand needs to be somewhere else afterwards, and not otherwise.
 */
const CHANGE_ON_REPEAT = 10

function publishedShape(
  pitches: readonly number[],
  hand: Hand,
): { fingers: readonly Finger[]; firm: boolean } | null {
  if (pitches.length < 2) return null
  const intervals: number[] = []
  for (let i = 1; i < pitches.length; i++) intervals.push(pitches[i]! - pitches[i - 1]!)
  const shape = SHAPES[intervals.join(',')]
  const fingers = shape?.[hand]
  return fingers ? { fingers, firm: shape!.firm ?? false } : null
}

interface Candidate {
  readonly fingers: readonly Finger[]
  readonly cost: number
  readonly rolled: boolean
  /** A single note on the finger its scale or arpeggio gives it. */
  readonly wanted?: boolean
}

/**
 * How one step is played.
 *
 * `rolled` is not a detail of the search. A chord wider than the hand is
 * fingered exactly as a held one — the fingers still go where they go — and
 * the only thing that separates the two is whether they can arrive together.
 * That answer was being computed and thrown away, which left everything
 * downstream asking for a grip no hand can close.
 */
export interface StepFingering {
  readonly fingers: readonly Finger[]
  readonly rolled: boolean
}

/** What is known about a step before the search: a slot per pitch, low to high. */
type Given = readonly (Finger | undefined)[]

/**
 * What the search is told besides the notes.
 */
export interface StepHints {
  /**
   * The fingers the score prints, step by step: one slot for each pitch of the
   * step, low to high, empty where it prints none.
   *
   * These are not preferences. An editor's finger is the one thing about a
   * passage that is known rather than worked out, so a step is only ever
   * fingered in a way that agrees with it, and everything around it is
   * fingered to reach it and to leave it.
   */
  readonly given?: readonly (Given | undefined)[]
  /**
   * For a step of one note that is part of a scale or an arpeggio, the finger
   * that scale's fingering puts on it. A preference, weighed with the rest.
   */
  readonly preferred?: readonly (Finger | undefined)[]
}

/**
 * A grip for notes no hand closes on, or more of them than a hand has fingers.
 *
 * Not a refusal. A bass note with a melody two octaves over it on the same
 * staff is played — leapt, or spread — and a player still wants to know what
 * with. So it is fingered in the order the hand lies, with the fingers that
 * leave the least beyond reach, and marked as one that arrives in pieces.
 */
function spread(pitches: readonly number[], hand: Hand): Candidate {
  const count = pitches.length
  if (count > 5) {
    // More keys than fingers: the hand laid across them, neighbours sharing.
    const across = pitches.map((_, index) => (1 + Math.round((index * 4) / (count - 1))) as Finger)
    return { fingers: hand === 'right' ? across : across.reverse(), cost: 0, rolled: true }
  }
  let best: Candidate | null = null
  let least = Number.POSITIVE_INFINITY
  const build = (sofar: Finger[], from: number) => {
    if (sofar.length === count) {
      const fingers = hand === 'right' ? sofar : [...sofar].reverse()
      const beyond = overreach(pitches, fingers, hand) * 100 + chordCost(pitches, fingers, hand)
      if (beyond < least) {
        least = beyond
        best = { fingers, cost: 0, rolled: true }
      }
      return
    }
    for (let f = from; f <= 5; f++) build([...sofar, f as Finger], f + 1)
  }
  build([], 1)
  return best!
}

/**
 * A step fingered as the score prints it, where that is not a grip the search
 * would have offered: two notes under one finger, fingers crossed in a chord,
 * a stretch the model calls out of reach. The editor's fingers stand, and the
 * notes the editor left are given whichever of the others asks least.
 */
function asGiven(pitches: readonly number[], hand: Hand, given: Given): Candidate {
  const taken = new Set(given.filter((finger): finger is Finger => finger !== undefined))
  const free = FINGERS.filter((finger) => !taken.has(finger))
  const open = pitches.map((_, index) => index).filter((index) => given[index] === undefined)

  let best: Finger[] | null = null
  let least = Number.POSITIVE_INFINITY
  const fill = (fingers: (Finger | undefined)[], slot: number, used: ReadonlySet<Finger>) => {
    if (slot === open.length) {
      const whole = fingers as Finger[]
      // Out of order counts against it, and less than out of reach does.
      let crossed = 0
      for (let i = 1; i < whole.length; i++) {
        const rising = hand === 'right' ? whole[i]! > whole[i - 1]! : whole[i]! < whole[i - 1]!
        if (!rising) crossed += 1
      }
      const beyond = overreach(pitches, whole, hand) * 100 + crossed * 10
      if (beyond < least) {
        least = beyond
        best = [...whole]
      }
      return
    }
    // More open notes than fingers left over: they share, as a thumb does.
    const choices = free.some((finger) => !used.has(finger))
      ? free.filter((finger) => !used.has(finger))
      : FINGERS
    for (const finger of choices) {
      fingers[open[slot]!] = finger
      fill(fingers, slot + 1, new Set([...used, finger]))
    }
    fingers[open[slot]!] = undefined
  }
  fill([...given], 0, new Set())

  const fingers = best!
  return { fingers, cost: 0, rolled: reach(pitches, fingers, hand) !== 'held' }
}

/**
 * Every way the hand could hold one step, cheapest first.
 *
 * Fingers run in the same direction as pitch — ascending in the right hand,
 * descending in the left. A held chord cannot cross its own fingers, so the
 * assignment is a choice of *which* fingers, never of their order.
 *
 * Never none, for a step that has notes. Where the score prints a finger only
 * the grips that agree with it are offered; and where nothing can be held, or
 * the score asks for something this would not have offered, the step is
 * fingered all the same — see `spread` and `asGiven`.
 */
function candidatesFor(
  pitches: readonly number[],
  hand: Hand,
  given?: Given,
  preferred?: Finger,
): Candidate[] {
  if (pitches.length === 0) return []
  const printed = given?.some((finger) => finger !== undefined) ? given : undefined
  if (pitches.length > 5) return [printed ? asGiven(pitches, hand, printed) : spread(pitches, hand)]

  const chosen: Candidate[] = []
  const build = (sofar: Finger[], from: number) => {
    if (sofar.length === pitches.length) {
      const fingers = hand === 'right' ? sofar : [...sofar].reverse()
      const held = reach(pitches, fingers, hand)
      if (held !== 'no') {
        const published = publishedShape(pitches, hand)
        // Enough to settle what the spans leave open, and to carry a grip the
        // hand finds slightly tight — a diminished triad spans six semitones,
        // which costs 1 3 5 a small-span point the book pays without comment.
        // Not enough to override the passage: transition costs are added after
        // this, so a progression that wants a different grip still gets one,
        // which is what the source's own cadences do.
        const matches = published?.fingers?.every((finger, i) => finger === fingers[i]) ?? false
        const bonus = matches ? (published!.firm ? FIRM_SHAPE : DEFAULT_SHAPE) : 0
        // Rolling costs something — it is a chord you cannot simply put down —
        // but far less than not fingering it at all.
        const roll = held === 'rolled' ? ROLL : 0
        const wanted = pitches.length === 1 && fingers[0] === preferred
        chosen.push({
          fingers,
          cost: chordCost(pitches, fingers, hand) - bonus + roll - (wanted ? PREFERRED : 0),
          rolled: held === 'rolled',
          ...(wanted ? { wanted } : {}),
        })
      }
      return
    }
    for (let f = from; f <= 5; f++) build([...sofar, f as Finger], f + 1)
  }
  // Built ascending either way; reversed for the left hand, whose little finger
  // takes the lowest note.
  build([], 1)

  if (printed) {
    const agreeing = chosen.filter((candidate) =>
      printed.every((finger, index) => finger === undefined || candidate.fingers[index] === finger),
    )
    return agreeing.length > 0
      ? agreeing.sort((a, b) => a.cost - b.cost).slice(0, CANDIDATE_LIMIT)
      : [asGiven(pitches, hand, printed)]
  }
  if (chosen.length === 0) return [spread(pitches, hand)]
  return chosen.sort((a, b) => a.cost - b.cost).slice(0, CANDIDATE_LIMIT)
}

const single = (step: readonly number[]) => step.length === 1

/** Where each finger lies in a closed hand, in semitones above the thumb. */
const LIE = [0, 2, 4, 5, 7] as const

/**
 * What a leap costs: how far the hand travels to make it.
 *
 * Not how far the notes are apart. Down an octave to a bass note, the left
 * hand goes least far if it lands on its little finger and furthest if it
 * lands on its thumb, and that difference is the whole of why a bass note is
 * taken with the 5th. Charged a flat amount whichever finger landed, the
 * search had no reason to prefer it — and the weak-finger rule a small reason
 * not to — so a low D♭ under a left-hand figure came out on the 2nd finger,
 * and the top note of a leap in the right hand on the thumb.
 */
function leapCost(from: number, f: Finger, to: number, g: Finger, hand: Hand): number {
  const lie = (finger: Finger) => LIE[hand === 'right' ? finger - 1 : 5 - finger]!
  return Math.abs(to - lie(g) - (from - lie(f))) / 2
}

/**
 * What it costs to go from one step to the next.
 *
 * Two single notes are a melodic interval and are charged by the published
 * model. Anything involving a chord is charged as hand movement instead,
 * because the model does not cover it and guessing at an extension of it would
 * be worse than measuring the thing that plainly matters.
 */
function stepCost(
  from: readonly number[],
  fromFingers: readonly Finger[],
  to: readonly number[],
  toFingers: readonly Finger[],
  hand: Hand,
  /**
   * Both notes are on the fingers a scale or arpeggio fingering gives them.
   * Then the way from one to the other is that fingering's own, and is not
   * charged as a hand out of position: an arpeggio passes the thumb under the
   * 3rd finger across a fourth, which the span table calls out of reach and
   * every scale book prints.
   */
  published = false,
): number {
  if (single(from) && single(to)) {
    // A repeated note keeps its finger, which is the one place the same finger
    // twice is what everybody does — unless the hand is wanted elsewhere next.
    if (from[0] === to[0]) return fromFingers[0] === toFingers[0] ? 0 : CHANGE_ON_REPEAT

    const interval = to[0]! - from[0]!
    if (reachable(fromFingers[0]!, toFingers[0]!, interval, hand)) {
      return pairCost(from[0]!, to[0]!, fromFingers[0]!, toFingers[0]!, hand)
    }
    // Not reachable by this pair. If no pair reaches it the hand has to jump,
    // which is legitimate and common — a leap is not an unfingerable passage,
    // it is a passage with a move in it. Where some other pair would have
    // reached, this one is the hand moved for no reason the two notes give:
    // dear enough that it is never chosen for itself, which is how the thumb
    // once ended up on two notes, and possible, because the notes either side
    // can leave nothing else — see `SHIFT_NEAR`.
    const anyPairReaches = FINGERS.some((f) => FINGERS.some((g) => reachable(f, g, interval, hand)))
    return (
      leapCost(from[0]!, fromFingers[0]!, to[0]!, toFingers[0]!, hand) +
      (anyPairReaches && !published ? shift(interval) : 0) +
      (anyPairReaches && fromFingers[0] === toFingers[0] ? SAME_FINGER : 0)
    )
  }
  return moveCost(from, fromFingers, to, toFingers)
}

/**
 * Whether two single notes are played from one hand position: the same note
 * again, or two that the fingers on them can span. Anything else has the hand
 * moving between them, and the rules about three notes in a row — which are
 * rules about a position and how far it is stretched — say nothing about a
 * hand that has let go.
 */
function joined(
  from: readonly number[],
  fromFingers: readonly Finger[],
  to: readonly number[],
  toFingers: readonly Finger[],
  hand: Hand,
): boolean {
  return from[0] === to[0] || reachable(fromFingers[0]!, toFingers[0]!, to[0]! - from[0]!, hand)
}

/**
 * Fingers a run of steps: every one that has a note in it.
 *
 * Null is for a step with nothing in it and for nothing else. A step no hand
 * can close on is fingered as one that arrives in pieces, and the search goes
 * on through it — the hand that leapt for it is the same hand, and where it
 * lands decides what follows.
 */
export function fingerSteps(
  steps: readonly (readonly number[])[],
  hand: Hand,
  hints: StepHints = {},
): (StepFingering | null)[] {
  const out: (StepFingering | null)[] = steps.map(() => null)
  const options = steps.map((step, index) =>
    candidatesFor(step, hand, hints.given?.[index], hints.preferred?.[index]),
  )

  let start = 0
  while (start < steps.length) {
    if (options[start]!.length === 0) {
      start += 1
      continue
    }
    let end = start
    while (end + 1 < steps.length && options[end + 1]!.length > 0) end += 1
    solve(steps, options, start, end, hand, out)
    start = end + 1
  }
  return out
}

/** What survives the search: the grip, and whether the hand can close on it at once. */
const pick = (candidate: Candidate): StepFingering => ({
  fingers: candidate.fingers,
  rolled: candidate.rolled,
})

/** Second order, because three consecutive single notes have rules of their own. */
function solve(
  steps: readonly (readonly number[])[],
  options: Candidate[][],
  start: number,
  end: number,
  hand: Hand,
  out: (StepFingering | null)[],
): void {
  if (start === end) {
    out[start] = pick(options[start]![0]!)
    return
  }

  // best[a][b] — cheapest path with candidate a on the step before this one and
  // candidate b on this one.
  let best: number[][] = options[start]!.map((first) =>
    options[start + 1]!.map(
      (second) =>
        first.cost +
        second.cost +
        stepCost(
          steps[start]!,
          first.fingers,
          steps[start + 1]!,
          second.fingers,
          hand,
          first.wanted && second.wanted,
        ),
    ),
  )
  const back: number[][][] = []

  for (let i = start + 2; i <= end; i++) {
    const next = options[i - 1]!.map(() => options[i]!.map(() => Number.POSITIVE_INFINITY))
    const from = options[i - 1]!.map(() => options[i]!.map(() => -1))

    for (const [a, first] of options[i - 2]!.entries()) {
      for (const [b, second] of options[i - 1]!.entries()) {
        const reached = best[a]![b]!
        if (!Number.isFinite(reached)) continue
        for (const [c, third] of options[i]!.entries()) {
          let step =
            third.cost +
            stepCost(
              steps[i - 1]!,
              second.fingers,
              steps[i]!,
              third.fingers,
              hand,
              second.wanted && third.wanted,
            )
          // The three-note rules apply only where all three really are notes,
          // and are played from one position — and not to three notes of a
          // scale or arpeggio on the fingers it is printed with. Those rules
          // count a change of hand position and how wide it is, and an
          // arpeggio is nothing else: charged for it, the 3rd finger over the
          // thumb lost to a move the book does not make.
          if (
            !(first.wanted && second.wanted && third.wanted) &&
            single(steps[i - 2]!) &&
            single(steps[i - 1]!) &&
            single(steps[i]!) &&
            joined(steps[i - 2]!, first.fingers, steps[i - 1]!, second.fingers, hand) &&
            joined(steps[i - 1]!, second.fingers, steps[i]!, third.fingers, hand)
          ) {
            step += tripleCost(
              steps[i - 2]![0]!,
              steps[i - 1]![0]!,
              steps[i]![0]!,
              first.fingers[0]!,
              second.fingers[0]!,
              third.fingers[0]!,
              hand,
            )
          }
          const total = reached + step
          if (total < next[b]![c]!) {
            next[b]![c] = total
            from[b]![c] = a
          }
        }
      }
    }
    back.push(from)
    best = next
  }

  let cheapest = Number.POSITIVE_INFINITY
  let last: [number, number] = [0, 0]
  for (const [a, row] of best.entries()) {
    for (const [b, cost] of row.entries()) {
      if (cost < cheapest) {
        cheapest = cost
        last = [a, b]
      }
    }
  }
  if (!Number.isFinite(cheapest)) return

  const path: number[] = [last[0], last[1]]
  let [a, b] = last
  for (let i = back.length - 1; i >= 0; i--) {
    const previous = back[i]![a]![b]!
    if (previous < 0) break
    path.unshift(previous)
    b = a
    a = previous
  }
  path.forEach((choice, offset) => {
    out[start + offset] = pick(options[start + offset]![choice]!)
  })
}
