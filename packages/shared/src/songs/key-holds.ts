import { reachable, type Finger } from '../music/hand-model.js'
import type { Hand, Song, SongNote } from './song.js'

/**
 * When a hand leaves a key whose note is still sounding.
 *
 * A note lasts as long as it is written, and for most notes the key is down
 * for as long. Not for all. Satie's first Gymnopédie writes a bass note to
 * last the bar and, a beat in, a chord for the same hand an octave and a half
 * above it: the note rings on in the pedal, and the hand has gone. A keyboard
 * that keeps that key lit for the whole bar shows a finger where there is
 * none, under a hand that is somewhere else.
 *
 * So a key is down until its note ends or until its hand strikes something it
 * cannot reach from there, whichever is first. Reach is the fingering's: the
 * finger on the held key and the finger taking the new note have to be two
 * fingers, and two that span the distance between the keys (`reachable`).
 * That is what keeps a voice held under a moving line in the same hand down,
 * as a fugue asks. Where a note has no finger, reach is the widest a hand
 * goes at all.
 *
 * Notes struck together do not let each other go, and neither do the notes of
 * a chord a file recorded a few milliseconds apart. A key struck again is not
 * left either: the new note takes it.
 */

/** Thumb to little finger at the hand's widest, in semitones: for a note nobody fingered. */
const HAND_SPAN = 15
/** Notes this close in time are one grip, which is the window `songSteps` hears as a chord. */
const TOGETHER_MS = 60

/** Whether a hand holding one key can strike another without letting go of it. */
function inReach(held: SongNote, struck: SongNote, hand: Hand): boolean {
  if (held.note === struck.note) return true
  if (held.finger === undefined || struck.finger === undefined)
    return Math.abs(struck.note - held.note) <= HAND_SPAN
  return reachable(held.finger as Finger, struck.finger as Finger, struck.note - held.note, hand)
}

/** A key its hand leaves early: the note it was sounding, and the note the hand goes to. */
interface Leaving {
  readonly left: SongNote
  readonly by: SongNote
}

function leavings(song: Song): Leaving[] {
  const found: Leaving[] = []
  for (const hand of ['left', 'right'] as const) {
    const notes = song.notes
      .filter((note) => note.role === 'keyboard' && note.hand === hand)
      .sort((a, b) => a.startMs - b.startMs)
    /** The keys this hand still has down. */
    let held: SongNote[] = []
    for (const note of notes) {
      held = held.filter((before) => before.startMs + before.durationMs > note.startMs)
      const kept: SongNote[] = []
      for (const before of held) {
        if (note.startMs - before.startMs <= TOGETHER_MS || inReach(before, note, hand))
          kept.push(before)
        else found.push({ left: before, by: note })
      }
      kept.push(note)
      held = kept
    }
  }
  return found
}

/**
 * The notes whose key comes up before they end, each with the moment it does,
 * in the score's time. A note that is not here is down for as long as it lasts.
 */
export function keyReleases(song: Song): Map<SongNote, number> {
  return new Map(leavings(song).map(({ left, by }) => [left, by.startMs]))
}

/**
 * The same, asked the other way: for a note, the keys its hand leaves to
 * strike it.
 *
 * For whoever is playing the song, which is the moment that matters there.
 * A key let go by a clock of its own comes up when the clock gets round to
 * it, and a page that is busy drawing the chord leaves the old key lit under
 * it for as long as that takes. Let go by the note that takes the hand away,
 * the one goes down and the other comes up in the same breath.
 */
export function keysLeftFor(song: Song): Map<SongNote, SongNote[]> {
  const left = new Map<SongNote, SongNote[]>()
  for (const { left: key, by } of leavings(song)) left.set(by, [...(left.get(by) ?? []), key])
  return left
}

/** A key struck again this soon after its note is over has not, to the eye, come up between. */
const SOON_MS = 250

/**
 * The notes whose key is struck again before they are over, or hard on their
 * heels: each with the note that strikes it.
 *
 * A repeated note is two notes and, lit for as long as each is written, one
 * unbroken light: the first ends at the moment the second begins, and nothing
 * shows that the key was struck twice. The left hand of Bach's Prelude in C
 * strikes its middle C at every half bar, and the key was lit from the first
 * bar to the fourth without a flicker. On a piano the key comes up to be
 * struck again, so whoever is lighting the keys needs to know which ones are
 * about to be.
 *
 * Any hand's: a key is one key whoever is on it, and a note one hand holds
 * while the other strikes it again is struck again all the same. Notes begun
 * together are one strike, as they are everywhere here.
 */
export function keyRestrikes(song: Song): Map<SongNote, SongNote> {
  const again = new Map<SongNote, SongNote>()
  /** The note last begun on each key. */
  const last = new Map<number, SongNote>()
  const notes = song.notes
    .filter((note) => note.role === 'keyboard')
    .sort((a, b) => a.startMs - b.startMs)
  for (const note of notes) {
    const before = last.get(note.note)
    if (before && note.startMs - before.startMs <= TOGETHER_MS) continue
    if (before && note.startMs - (before.startMs + before.durationMs) <= SOON_MS)
      again.set(before, note)
    last.set(note.note, note)
  }
  return again
}
