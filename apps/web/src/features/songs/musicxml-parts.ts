import type { Hand } from '@motius/shared'
import { inner, num } from './musicxml-scan'

/**
 * The parts of a MusicXML score: what the part list declares, which of them
 * is the piano, and how a piano part's voices and staves are laid out.
 */

export interface PartInfo {
  readonly id: string
  readonly name: string
  /** General MIDI program, zero-based, where the part list gives one. */
  readonly program?: number
}

/** `<part-list>`: the names and instruments the score declares. */
export function readPartList(text: string): PartInfo[] {
  const list = inner(text, 'part-list') ?? ''
  return [...list.matchAll(/<score-part\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/score-part>/g)].map(
    ([, id = '', body = '']) => {
      const program = num(body, 'midi-program')
      return {
        id,
        name: (inner(body, 'part-name') ?? '').replace(/<[^>]*>/g, '').trim(),
        ...(program !== undefined ? { program: program - 1 } : {}),
      }
    },
  )
}

const KEYBOARD_NAME = /piano|keyboard|klavier|clavier|harpsichord|organ|celest|rhodes|synth/i

/** A part named for the hand that plays it, in the languages scores are published in. */
const RIGHT_HAND =
  /\bright\s*hand\b|\br\.?h\b|\bmain\s+droite\b|\bmano\s+(?:derecha|destra)\b|\brechte\s+hand\b/i
const LEFT_HAND =
  /\bleft\s*hand\b|\bl\.?h\b|\bmain\s+gauche\b|\bmano\s+(?:izquierda|sinistra)\b|\blinke\s+hand\b/i

/** The parts under the player's fingers. */
export interface Piano {
  readonly parts: ReadonlySet<string>
  /** The hand a part is, where the score gives each hand a part of its own. */
  readonly hands: ReadonlyMap<string, Hand>
  /**
   * Where each hand's part begins among the piano's staves, counted from
   * none, and how many staves the piano has in all: a hand's part can be on
   * two staves itself, and the two hands' together are then a piano on four.
   */
  readonly staffBase?: ReadonlyMap<string, number>
  readonly staves?: number
}

/**
 * Which part is the piano.
 *
 * The one the part list calls a piano or a keyboard, else the one it gives a
 * keyboard program, else the one written on two staves, else the first. The
 * others are the rest of the room: heard, and not put under the fingers.
 *
 * Where several are called a piano, the one on two staves is it. A one-staff
 * part beside it is a line of ornaments or an ossia, and taking that for the
 * piano because it came first left the real one as accompaniment: eight notes
 * to play in a piece of eighteen hundred.
 *
 * And a piano is sometimes written as two parts of one staff each, treble then
 * bass, by a program that was given a staff per hand. Those two are one piano,
 * the first its right hand and the second its left. Read as a piano and its
 * accompaniment, the left hand was heard and never asked for. Only two
 * keyboards in those two clefs are joined this way; any other pair of
 * one-staff parts is still two instruments.
 *
 * Unless the score says so itself: two parts named for the right hand and the
 * left are the two hands of one piano, however many staves each is on. That is
 * the one thing a part list can say about hands, and it is taken at its word.
 * Two parts that are each simply a piano are two pianos — a duet, in nearly
 * every file there is — and the second is still someone else's.
 */
export function choosePiano(
  parts: readonly PartInfo[],
  staves: ReadonlyMap<string, number>,
  clefs: ReadonlyMap<string, string>,
): Piano | null {
  if (parts.length === 0) return null
  const only = (id: string): Piano => ({ parts: new Set([id]), hands: new Map() })
  const grand = (part: PartInfo) => (staves.get(part.id) ?? 1) >= 2
  /** Two parts as the two hands of one piano, the right hand's staves above the left's. */
  const hands = (right: PartInfo, left: PartInfo): Piano => {
    const above = staves.get(right.id) ?? 1
    return {
      parts: new Set([right.id, left.id]),
      hands: new Map<string, Hand>([
        [right.id, 'right'],
        [left.id, 'left'],
      ]),
      staffBase: new Map([
        [right.id, 0],
        [left.id, above],
      ]),
      staves: above + (staves.get(left.id) ?? 1),
    }
  }

  const rights = parts.filter((part) => RIGHT_HAND.test(part.name))
  const lefts = parts.filter((part) => LEFT_HAND.test(part.name))
  if (rights.length === 1 && lefts.length === 1 && rights[0] !== lefts[0])
    return hands(rights[0]!, lefts[0]!)

  const named = parts.filter((part) => KEYBOARD_NAME.test(part.name))
  const keyboards =
    named.length > 0
      ? named
      : parts.filter((part) => part.program !== undefined && part.program <= 23)
  if (keyboards.length === 0) return only((parts.find(grand) ?? parts[0]!).id)

  const onTwoStaves = keyboards.find(grand)
  if (onTwoStaves) return only(onTwoStaves.id)

  const [upper, lower] = keyboards
  if (
    keyboards.length === 2 &&
    upper &&
    lower &&
    clefs.get(upper.id) === 'G' &&
    clefs.get(lower.id) === 'F'
  )
    return hands(upper, lower)
  return only(keyboards[0]!.id)
}

/**
 * The staff each voice of a part belongs to.
 *
 * A staff is not quite a hand. A right hand that runs down into the bass is
 * often written on the lower staff while it is there, to spare the ledger
 * lines, and it is still the right hand: the notes keep their voice and change
 * their staff. So a voice has a staff of its own, the one it is written on
 * when it is not visiting, and that says whose notes they are.
 *
 * Most programs number the voices of each staff apart — MuseScore the first
 * four for the upper staff and the next four for the lower — and then the
 * number says it outright. Otherwise a voice's own staff is the one most of
 * its notes are on.
 *
 * Null where the numbers do not name lines at all: a file that calls the upper
 * staff's line voice 1 and the lower staff's line voice 1 as well has said
 * nothing with them, and each note is then its staff's hand, as before.
 */
export function voiceHomes(part: string, staves: number): Map<string, number> | null {
  const counts = new Map<string, Map<number, number>>()
  /** The bars each voice is in, and those where it is two lines on different staves. */
  const seen = new Map<string, number>()
  const split = new Map<string, number>()
  for (const [, measure = ''] of part.matchAll(/<measure\b[^>]*>([\s\S]*?)<\/measure>/g)) {
    let sequence = 0
    const lines = new Map<string, Map<number, Set<number>>>()
    for (const block of measure.matchAll(/<(note|backup)\b[^>]*?(?:\/>|>([\s\S]*?)<\/\1>)/g)) {
      if (block[1] === 'backup') {
        sequence++
        continue
      }
      const content = block[2] ?? ''
      const staff = num(content, 'staff')
      if (staff === undefined) continue
      const voice = inner(content, 'voice')?.trim() ?? '1'
      const line = lines.get(voice) ?? new Map<number, Set<number>>()
      lines.set(voice, line)
      line.set(sequence, (line.get(sequence) ?? new Set<number>()).add(staff))
      if (!inner(content, 'pitch')) continue
      const count = counts.get(voice) ?? new Map<number, number>()
      counts.set(voice, count)
      count.set(staff, (count.get(staff) ?? 0) + 1)
    }
    for (const [voice, line] of lines) {
      seen.set(voice, (seen.get(voice) ?? 0) + 1)
      const written = new Set([...line.values()].map((on) => [...on].sort().join()))
      if (written.size > 1) split.set(voice, (split.get(voice) ?? 0) + 1)
    }
  }
  if (counts.size === 0) return null
  // The odd bar is a quirk of the program that wrote it. Bar after bar is a
  // number that means nothing.
  for (const [voice, bars] of seen) if ((split.get(voice) ?? 0) > bars * 0.05) return null

  let total = 0
  let numbered = 0
  for (const [voice, count] of counts)
    for (const [staff, notes] of count) {
      total += notes
      if (Math.ceil(Number(voice) / 4) === staff) numbered += notes
    }
  const byNumber =
    [...counts.keys()].every((voice) => Number(voice) >= 1 && Number(voice) <= staves * 4) &&
    numbered >= total * 0.9
  const homes = new Map<string, number>()
  for (const [voice, count] of counts)
    homes.set(
      voice,
      byNumber
        ? Math.ceil(Number(voice) / 4)
        : [...count].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]![0],
    )
  return homes
}

/** The clef a staff of a part opens in: its sign, as the file writes it. */
export function openingClef(part: string, staffNumber: number): string | undefined {
  for (const [, attrs = '', clef = ''] of part.matchAll(/<clef\b([^>]*)>([\s\S]*?)<\/clef>/g))
    if (Number(/number="(\d+)"/.exec(attrs)?.[1] ?? '1') === staffNumber)
      return inner(clef, 'sign')?.trim()
  return undefined
}
