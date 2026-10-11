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

/**
 * The notes whose key comes up before they end, each with the moment it does,
 * in the score's time. A note that is not here is down for as long as it lasts.
 */
export function keyReleases(song: Song): Map<SongNote, number> {
  const releases = new Map<SongNote, number>()
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
        else releases.set(before, note.startMs)
      }
      kept.push(note)
      held = kept
    }
  }
  return releases
}
