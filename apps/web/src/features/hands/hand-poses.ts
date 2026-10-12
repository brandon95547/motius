import { isBlackKey, keyReleases, type Hand, type Song, type SongNote } from '@motius/shared'

/**
 * Where a hand is, from the fingering of a song.
 *
 * Two questions, kept apart. Which key each finger is on, moment by moment, is
 * a reading of the song: its notes, the finger each is given, and when the
 * hand lets each key go (`keyReleases`). Where that puts the fingertips and
 * the knuckles over a keyboard is geometry, and knows nothing of time.
 *
 * Nothing here draws, and nothing here is in pixels. Across the keys a
 * position is a percentage of the keybed's width, as the keys' own are, and
 * up and down it is a share of the keybed's height: nought at the back of the
 * keys, one at the front edge nearest the player.
 */

/** Which key each finger is on, from a moment until the next one listed. */
export interface HandKeyframe {
  readonly atMs: number
  /** The thumb first: the key each of the five fingers is on, or null. */
  readonly keys: readonly (number | null)[]
}

const NO_KEYS: readonly (number | null)[] = [null, null, null, null, null]

/**
 * A hand's fingers through a song: a keyframe wherever one of them goes down
 * on a key or comes up off one.
 *
 * Only the notes that have a finger. A note nobody fingered says where a key
 * is and not which finger is on it, and a hand drawn guessing would be showing
 * a fingering the song does not have.
 */
export function handTimeline(
  song: Song,
  hand: Hand,
  releases: ReadonlyMap<SongNote, number> = keyReleases(song),
): HandKeyframe[] {
  const moves: { atMs: number; finger: number; key: number; down: boolean }[] = []
  for (const note of song.notes) {
    if (note.role !== 'keyboard' || note.hand !== hand) continue
    const finger = note.finger
    if (finger === undefined || finger < 1 || finger > 5) continue
    const upMs = releases.get(note) ?? note.startMs + note.durationMs
    moves.push({ atMs: note.startMs, finger, key: note.note, down: true })
    moves.push({ atMs: upMs, finger, key: note.note, down: false })
  }
  // At one moment the fingers that lift go first, so one that leaves a key
  // for another ends on the new key.
  moves.sort((a, b) => a.atMs - b.atMs || Number(a.down) - Number(b.down))

  const timeline: HandKeyframe[] = []
  const keys = [...NO_KEYS]
  for (let at = 0; at < moves.length;) {
    const { atMs } = moves[at]!
    let changed = false
    for (; at < moves.length && moves[at]!.atMs === atMs; at++) {
      const move = moves[at]!
      const index = move.finger - 1
      if (move.down) {
        changed ||= keys[index] !== move.key
        keys[index] = move.key
      } else if (keys[index] === move.key) {
        // Its own key only: the finger may already be on the next one.
        keys[index] = null
        changed = true
      }
    }
    if (changed) timeline.push({ atMs, keys: [...keys] })
  }
  return timeline
}

/** The last keyframe that has begun by `ms`, or -1 before the first. */
export function frameAt(timeline: readonly HandKeyframe[], ms: number): number {
  let low = 0
  let high = timeline.length
  while (low < high) {
    const middle = (low + high) >> 1
    if (timeline[middle]!.atMs <= ms) low = middle + 1
    else high = middle
  }
  return low - 1
}

const holdsKey = (frame: HandKeyframe | undefined) =>
  frame !== undefined && frame.keys.some((key) => key !== null)

/**
 * The keyframe a hand takes its shape from at `index`.
 *
 * Its own, where a finger is on a key. Between notes a hand does not vanish:
 * it stays where it last played, and before its first note it waits over the
 * keys that note will be on.
 */
export function shapeAt(timeline: readonly HandKeyframe[], index: number): HandKeyframe | null {
  for (let at = Math.min(index, timeline.length - 1); at >= 0; at--)
    if (holdsKey(timeline[at])) return timeline[at]!
  for (let at = Math.max(0, index + 1); at < timeline.length; at++)
    if (holdsKey(timeline[at])) return timeline[at]!
  return null
}

/** A finger over the keys: where its tip is, and where it joins the hand. */
export interface FingerPose {
  readonly tipX: number
  readonly tipY: number
  readonly baseX: number
  readonly baseY: number
  /** The key its tip is on, or null where it is over the keys and on none. */
  readonly key: number | null
}

export interface HandPose {
  /** The thumb first. */
  readonly fingers: readonly FingerPose[]
  /** The middle of the hand across the keys, and where its knuckles are. */
  readonly palmX: number
  readonly palmY: number
}

/**
 * How a hand sits over the keys. Shares of the keybed's height, but for the
 * spread, which is in white keys.
 *
 * A fingertip is on a key where the key's finger number is printed
 * (`.key-badge`), so the number reads on the finger. The thumb is the short
 * one: its tip is nearer
 * the player. A finger with no key waits a little nearer still. The knuckles
 * are at the front of the keys, where the top of the hand still shows above
 * the edge, and come in a little when a finger has to reach a black key. Only
 * a little: the keybed is no deeper than a hand is long, and a hand that went
 * in as far as a real one does would leave the fingers on its white keys with
 * no length at all. The finger on the black key reaches instead.
 */
const TIP_WHITE = 0.7
const TIP_BLACK = 0.5
const THUMB_SHORT = 0.1
const WAITING = 0.06
const KNUCKLES = 0.95
const REACH_IN = 0.05
/** One finger to the next along the knuckles, and the thumb's root out to the side and back. */
const KNUCKLE_SPREAD = 0.86
const THUMB_OUT = 0.75
const THUMB_BACK = 0.1

/**
 * The hand's shape for the keys its fingers are on.
 *
 * `keyX` is where a key's centre is across the keybed, and `whiteKey` how wide
 * a white key is, both as percentages of the keybed's width.
 *
 * A finger with no key goes where the hand would have it: between its
 * neighbours that have one, and a white key apart beyond them, which is the
 * five-finger position every pianist's hand falls into.
 */
export function handPose(
  keys: readonly (number | null)[],
  hand: Hand,
  keyX: (note: number) => number,
  whiteKey: number,
): HandPose {
  // Left to right across the keys: the right hand's thumb is its first
  // finger, the left hand's its last.
  const across = (finger: number) => (hand === 'right' ? finger - 1 : 5 - finger)
  const xs: (number | null)[] = [null, null, null, null, null]
  for (let finger = 1; finger <= 5; finger++) {
    const key = keys[finger - 1] ?? null
    if (key !== null) xs[across(finger)] = keyX(key)
  }
  const placed = xs.flatMap((x, at) => (x === null ? [] : [at]))
  const first = placed[0] ?? 2
  const last = placed.at(-1) ?? 2
  const origin = placed.length > 0 ? 0 : 50
  const tipX = xs.map((x, at) => {
    if (x !== null) return x
    if (placed.length === 0) return origin + (at - 2) * whiteKey
    if (at < first) return xs[first]! - (first - at) * whiteKey
    if (at > last) return xs[last]! + (at - last) * whiteKey
    const before = placed.findLast((each) => each < at)!
    const after = placed.find((each) => each > at)!
    return xs[before]! + ((xs[after]! - xs[before]!) * (at - before)) / (after - before)
  })

  const onBlack = keys.some((key) => key !== null && isBlackKey(key))
  const palmY = KNUCKLES - (onBlack ? REACH_IN : 0)
  // The four fingers, not the thumb: the hand is behind them, and the thumb
  // reaches out from its side.
  const four = [2, 3, 4, 5].map((finger) => tipX[across(finger)]!)
  const palmX = four.reduce((sum, x) => sum + x, 0) / four.length
  // Which way the fingers count across the keys: the right hand's from the
  // thumb rightward, the left hand's leftward.
  const counting = hand === 'right' ? 1 : -1

  const fingers = [1, 2, 3, 4, 5].map((finger): FingerPose => {
    const key = keys[finger - 1] ?? null
    const thumb = finger === 1
    const reach = key === null ? TIP_WHITE + WAITING : isBlackKey(key) ? TIP_BLACK : TIP_WHITE
    return {
      key,
      tipX: tipX[across(finger)]!,
      tipY: reach + (thumb ? THUMB_SHORT : 0),
      baseX: thumb
        ? palmX - counting * (1.5 * KNUCKLE_SPREAD + THUMB_OUT) * whiteKey
        : palmX + counting * (finger - 3.5) * KNUCKLE_SPREAD * whiteKey,
      baseY: palmY + (thumb ? THUMB_BACK : 0),
    }
  })
  return { fingers, palmX, palmY }
}
