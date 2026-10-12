import type { KeyMode } from './chords.js'
import type { Hand } from './fingering.js'
import type { ArpeggioFingeringQuery, FingeringSystem } from './fingering-system.js'
import {
  PLAYED_FROM,
  TRADITIONAL,
  TRADITIONAL_PAGES,
  scaleFromPages,
  type HandRun,
  type KeyPage,
  type Pages,
  type ScalePages,
} from './fingering-traditional.js'
import { parsePitch } from './pitch.js'

/**
 * The Natural system.
 *
 * Transcribed from the fingering charts of Penelope Roskell's *The Art of Piano
 * Fingering: A New Approach to Scales and Arpeggios* (LCM Publications, 1996).
 *
 * ## What it is
 *
 * The traditional fingerings are C major's, carried to every other key: the
 * thumb on the tonic wherever the tonic is white. This school starts from the
 * keyboard instead. The black keys are shorter and stand higher, and the three
 * middle fingers are the long ones, so a hand lies easiest with those on the
 * black keys and the thumb and little finger on the white. And a thumb passes
 * under most freely when the finger it passes under is up on a black key.
 *
 * So the finger the thumb goes under — the 3rd or the 4th — is put on a black
 * key wherever the scale has one to give it, and the thumb takes the white key
 * after. Jon Verbalis's *Natural Fingering* (Oxford, 2012) argues the same from
 * the same ground and says it shorter: fourth on black, thumb on white.
 *
 * ## Where it differs, and where it does not
 *
 * In most keys it does not. A scale with a black-key tonic was never fingered
 * from C major in the first place, and the right hand of the sharp keys already
 * lands its 4th on the leading note. What moves is mostly the left hand in the
 * keys with a white tonic and few black keys — G, D, A and F major, where the
 * traditional hand walks 5 4 3 2 1 past the one black key it could have used —
 * and the minors, where the raised or lowered notes change which keys are
 * black.
 *
 * So this file is the traditional pages with some of them turned. It names the
 * ones it turns and asks the traditional system for everything else: the
 * chords, which Roskell fingers as the tradition does; the octaves; the
 * cadences; the double thirds and the seventh-chord arpeggios, which she
 * fingers her own way and which are not transcribed yet.
 *
 * ## The rule this file is held to
 *
 * The same one as its neighbour: it says what the page says. Roskell prints
 * her recommended fingering in upright type and the alternatives — usually the
 * traditional one — in italics or brackets. What is recorded here is the
 * upright one, including where she keeps the traditional fingering against her
 * own principle (D harmonic minor's left hand takes B♭ with the 3rd finger),
 * and including the ends of a run as she turns them.
 */

/** 3 2 1, 4 3 2 1 from the tonic: the flat-key left hand, which F major's becomes. */
const LEFT_FLAT: HandRun = { cycle: '3214321', top: '2' }
/** The left hand with its thumbs on the 2nd and 5th degrees, the upper group led by the 4th. */
const LEFT_4_ON_SIXTH: HandRun = { cycle: '2132143' }
/** The same thumbs with the lower group led by the 4th: the melodic minors going up. */
const LEFT_4_ON_THIRD: HandRun = { cycle: '2143213' }
/** The right hand opened 3 4 and brought home 3 2, as the sharp minors are printed. */
const RIGHT_3_4: HandRun = { cycle: '3412312', close: '23' }
/**
 * The right hand in four and three — 1 2 3 4, 1 2 3 — ending on the 4th.
 *
 * For the harmonic minors with an augmented second below the leading note: it
 * puts that gap between the 2nd finger and the 3rd, where the traditional
 * 1 2 3, 1 2 3 4 asks the 3rd and 4th to stretch it.
 */
const RIGHT_4_3: HandRun = { cycle: '1234123', top: '4' }

const turned = (pages: Pages, changes: Readonly<Record<string, Partial<KeyPage>>>): Pages => {
  const out: Record<string, KeyPage> = { ...pages }
  for (const [tonic, change] of Object.entries(changes)) {
    const page = pages[tonic]
    if (!page) throw new Error(`No traditional page for ${tonic} to turn`)
    out[tonic] = { ...page, ...change }
  }
  return out
}

const traditional = (scaleTypeId: string): Pages => TRADITIONAL_PAGES[scaleTypeId]!.pages

/**
 * The majors. Four left hands, each with its 4th finger on the key's one
 * convenient black key: F♯ in the sharp keys, B♭ in F.
 */
const MAJOR = turned(traditional('major'), {
  G: { left: { cycle: '3213214' } },
  D: { left: { cycle: '2143213' } },
  A: { left: LEFT_4_ON_SIXTH },
  F: { left: LEFT_FLAT },
})

const HARMONIC_MINOR = turned(traditional('harmonic-minor'), {
  A: { right: RIGHT_4_3, left: LEFT_4_ON_THIRD },
  B: { right: RIGHT_3_4 },
  // Both bridge fingers on black keys, E♭ and A♭, and no thumb to pass at the
  // top: the run goes out 3 4 5.
  C: { right: { cycle: '2341231', top: '45' }, left: LEFT_4_ON_SIXTH },
  // The traditional cycle. Only the way it opens is different: 3 4 from the
  // first note, and 3 2 coming home.
  'C♯': { right: RIGHT_3_4 },
  D: { right: RIGHT_4_3 },
  E: { right: RIGHT_3_4 },
  G: { left: LEFT_4_ON_SIXTH },
  // As C♯. The traditional page fingers contrary motion separately; this one
  // does not, so that line goes.
  'G♯': { right: RIGHT_3_4, contrary: undefined },
  // The traditional cycle without its 5 4 3 2 opening.
  'B♭': { left: LEFT_4_ON_SIXTH },
})

/** The melodic form going up. The right hands are the tradition's; four left hands are not. */
const MELODIC_MINOR_ASCENDING = turned(traditional('melodic-minor'), {
  C: { left: LEFT_4_ON_THIRD },
  D: { left: LEFT_4_ON_THIRD },
  F: { left: LEFT_4_ON_THIRD },
  G: { left: LEFT_4_ON_THIRD },
})

/**
 * The melodic form coming down, which is the natural minor — and has the notes
 * of its relative major, so it takes the relative major's fingering.
 *
 * Which is why a hand can come down on different fingers from the ones it went
 * up on: G minor's left hand goes up with its 4th on B♭ and comes down with it
 * on E♭. The tradition avoids that by fingering both directions alike.
 */
const LEFT_RELATIVE: HandRun = { ...LEFT_4_ON_SIXTH, bottom: '54' }
const MELODIC_MINOR_DESCENDING = turned(traditional('natural-minor'), {
  B: { right: RIGHT_3_4 },
  C: { left: LEFT_RELATIVE },
  D: { right: { cycle: '2312341' }, left: LEFT_RELATIVE },
  E: { right: { cycle: '3412312' } },
  F: { left: LEFT_RELATIVE },
  G: { right: { cycle: '2341231', top: '45' }, left: LEFT_4_ON_SIXTH },
  'G♯': { right: RIGHT_3_4 },
})

const PAGES: ScalePages = {
  major: { pages: MAJOR, mode: 'major' },
  'harmonic-minor': { pages: HARMONIC_MINOR, mode: 'minor' },
  'melodic-minor': { pages: MELODIC_MINOR_ASCENDING, mode: 'minor' },
  'natural-minor': { pages: MELODIC_MINOR_DESCENDING, mode: 'minor' },
}

/**
 * Arpeggios of the key's triad.
 *
 * One finger for each note of the chord — root, third, fifth — which the note
 * keeps wherever the arpeggio starts and however far it runs. That is the
 * whole of the system: find where the thumb goes, by the same reasoning as in
 * the scales and with the smallest gap that can be had between the thumb and
 * the finger it passes under, and every inversion follows.
 *
 * The traditional book starts the right hand on the thumb in every key whose
 * tonic is white. Here the thumb takes the third or the fifth instead, so that
 * the 4th finger or the 3rd is on the black key, or — where the chord is all
 * white — so that the stretch across the thumb is a third and not a fourth.
 *
 * `right hand | left hand`, each as root, third, fifth.
 */
const TRIADS: Readonly<Record<KeyMode, Readonly<Record<string, string>>>> = {
  major: {
    C: '412 | 142',
    'D♭': '412 | 214',
    D: '241 | 132',
    'E♭': '412 | 214',
    E: '241 | 132',
    F: '412 | 142',
    'F♯': '412 | 132',
    G: '412 | 142',
    'A♭': '412 | 214',
    A: '241 | 132',
    'B♭': '412 | 321',
    B: '123 | 132',
  },
  minor: {
    C: '231 | 142',
    'C♯': '412 | 214',
    D: '412 | 142',
    'D♯': '412 | 142',
    E: '412 | 142',
    F: '231 | 142',
    'F♯': '412 | 214',
    G: '231 | 142',
    'G♯': '412 | 214',
    A: '412 | 142',
    'B♭': '231 | 321',
    B: '123 | 142',
  },
}

/**
 * The ends of an arpeggio, where a finger has nothing to have come from or
 * nowhere to be going.
 *
 * At the outside of the hand's travel — the top of the right hand, the bottom
 * of the left — a thumb gives way to the little finger: there is no hand
 * position beyond it to pass into. At the inside, a 3rd or 4th finger that the
 * thumb is about to pass under gives way to the 2nd, which is the chart's
 * `(4) 2` over the first note of the right hand in C.
 */
function turnEnds(fingers: number[], hand: Hand): number[] {
  const last = fingers.length - 1
  if (last < 1) return fingers
  const [outer, inner, beside] = hand === 'right' ? [last, 0, 1] : [0, last, last - 1]
  if (fingers[outer] === 1) fingers[outer] = 5
  if (fingers[inner]! >= 3 && fingers[beside] === 1) fingers[inner] = 2
  return fingers
}

function arpeggio(query: ArpeggioFingeringQuery) {
  // The seventh chords are fingered in Roskell's book too, and not yet read.
  if (query.kind !== 'triad') return TRADITIONAL.arpeggio(query)

  const tonic = parsePitch(query.tonic)?.name
  if (tonic === undefined) return null
  const keys = TRIADS[query.mode]
  const printed = keys[tonic] ?? keys[PLAYED_FROM[query.mode][tonic] ?? '']
  const cycle = printed?.split(' | ')[query.hand === 'right' ? 0 : 1]
  if (!cycle) return null

  const position = ((query.position % 3) + 3) % 3
  const count = 3 * Math.max(1, query.octaves) + 1
  return turnEnds(
    Array.from({ length: count }, (_, index) => Number(cycle[(index + position) % 3])),
    query.hand,
  )
}

export const NATURAL: FingeringSystem = {
  id: 'natural',
  name: 'Natural / Topographical',
  shortName: 'Natural',
  description:
    'Long fingers on the black keys and the thumb on the white, after Penelope Roskell. The same as the traditional fingering wherever that already fits the hand.',
  reference:
    'Penelope Roskell, The Art of Piano Fingering: A New Approach to Scales and Arpeggios (LCM Publications, 1996)',
  scale: scaleFromPages(PAGES),
  chord: TRADITIONAL.chord,
  arpeggio,
  doubleThirds: TRADITIONAL.doubleThirds,
  octaves: TRADITIONAL.octaves,
  cadence: TRADITIONAL.cadence,
}
