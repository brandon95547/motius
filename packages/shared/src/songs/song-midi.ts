import {
  keyEvent,
  metreEvent,
  noteEvents,
  pedalEvents,
  PPQ,
  smfBytes,
  tempoEvent,
  trackName,
  type MidiEvent,
} from '../export/smf.js'
import { barIndexAtQ, quartersAt, quartersPerBar } from './meter.js'
import { playOrder } from './performance.js'
import { GRACE_Q, type Hand, type Song } from './song.js'

/**
 * A song as a Standard MIDI File: the performance, ready for a DAW, a
 * sequencer or another notation program.
 *
 * Format 1. The first track is the conductor's — the title, the key, and the
 * tempo and metre wherever they change — and then one track for each hand,
 * the right first, both on the piano. That is the layout Motius itself reads
 * a two-handed piano file in, so a song exported and imported again comes
 * back with its hands.
 *
 * MIDI has no repeat signs, so the repeats and endings are played out: a bar
 * played twice is in the file twice. The sustain pedal goes on both hands'
 * channels, since a controller holds only the notes of its own channel.
 *
 * What MIDI has nowhere to put is left out: fingering, spelling, voices and
 * how the notes are written. MusicXML keeps those. The other parts of an
 * arrangement are left out too, for the reason `song-musicxml.ts` gives.
 */

const HANDS: readonly { hand: Hand; name: string; channel: number }[] = [
  { hand: 'right', name: 'Right hand', channel: 0 },
  { hand: 'left', name: 'Left hand', channel: 1 },
]

export function writeSongMidi(song: Song): Uint8Array {
  const bars = song.measures
  const order = bars.length > 0 ? playOrder(bars) : []
  const keyboard = song.notes.filter((note) => note.role === 'keyboard')
  const ticks = (quarters: number) => quarters * PPQ

  // Each note, and each pedal, belongs to the bar it begins in, and is played
  // wherever that bar is.
  const notesByBar = new Map<number, typeof keyboard>()
  for (const note of keyboard) {
    const startQ = note.startQ ?? quartersAt(bars, note.startMs)
    const bar = barIndexAtQ(bars, startQ)
    notesByBar.set(bar, [...(notesByBar.get(bar) ?? []), note])
  }
  const pedalsByBar = new Map<number, { down: number; up: number }[]>()
  for (const span of song.pedal) {
    const down = quartersAt(bars, span.startMs)
    const bar = barIndexAtQ(bars, down)
    pedalsByBar.set(bar, [
      ...(pedalsByBar.get(bar) ?? []),
      { down, up: quartersAt(bars, span.endMs) },
    ])
  }

  const conductor: MidiEvent[] = [trackName(song.title)]
  if (song.key) conductor.push(keyEvent(0, song.key.fifths, song.key.mode === 'minor'))
  const hands = new Map<Hand, MidiEvent[]>(HANDS.map(({ hand }) => [hand, []]))

  let at = 0
  let tempo = 0
  let metre = ''
  for (const index of order) {
    const bar = bars[index]!
    const shift = at - bar.startQ

    const bpm = 60000 / bar.quarterMs
    if (Math.abs(bpm - tempo) > 0.01) {
      conductor.push(tempoEvent(ticks(at), bpm))
      tempo = bpm
    }
    // A pickup is written as the short bar it is, so a sequencer's bar lines
    // fall where the score's do.
    const full = quartersPerBar(bar.beats, bar.beatType)
    const beats =
      Math.abs(bar.durationQ - full) > 1e-6 && Number.isInteger((bar.durationQ * bar.beatType) / 4)
        ? (bar.durationQ * bar.beatType) / 4
        : bar.beats
    if (`${beats}/${bar.beatType}` !== metre) {
      conductor.push(metreEvent(ticks(at), beats, bar.beatType))
      metre = `${beats}/${bar.beatType}`
    }

    for (const note of notesByBar.get(index) ?? []) {
      const startQ = (note.startQ ?? quartersAt(bars, note.startMs)) + shift
      const lengthQ = note.grace ? GRACE_Q : (note.durationQ ?? note.durationMs / bar.quarterMs)
      const channel = HANDS.find(({ hand }) => hand === note.hand)!.channel
      hands
        .get(note.hand)!
        .push(
          ...noteEvents(channel, note.note, note.velocity, ticks(startQ), ticks(startQ + lengthQ)),
        )
    }
    for (const span of pedalsByBar.get(index) ?? []) {
      for (const { hand, channel } of HANDS) {
        hands
          .get(hand)!
          .push(...pedalEvents(channel, ticks(span.down + shift), ticks(span.up + shift)))
      }
    }
    at += bar.durationQ
  }

  const tracks: MidiEvent[][] = [conductor]
  for (const { hand, name, channel } of HANDS) {
    const events = hands.get(hand)!
    if (!keyboard.some((note) => note.hand === hand)) continue
    // Program 0, the acoustic grand, on the hand's own channel.
    tracks.push([trackName(name), { tick: 0, order: 0, bytes: [0xc0 | channel, 0] }, ...events])
  }
  return smfBytes(tracks)
}
