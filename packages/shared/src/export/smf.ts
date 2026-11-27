/**
 * A Standard MIDI File, written by hand.
 *
 * The bytes only: what goes on each track is the caller's. A recording is one
 * track; a song is a track for the tempo and metre and one for each hand.
 * Every sequencer, DAW and notation program reads both format 0 and format 1.
 */

/** Ticks per quarter note. 480 divides cleanly by 2, 3, 4, 5 and 8. */
export const PPQ = 480

/** One message at an absolute tick. */
export interface MidiEvent {
  readonly tick: number
  /** Where it sorts against the others at the same tick. See `ORDER`. */
  readonly order: number
  readonly bytes: readonly number[]
}

/**
 * Where a message sorts against the others at the same tick.
 *
 * Meta events first, so a tempo or metre is in force before anything it times.
 * Then releases, so a repeated pitch is let go before it is struck again. Then
 * the pedal: an up lands after the release it belongs with rather than
 * catching it, and a down lands before the note it is meant to hold. Strikes
 * last.
 */
export const ORDER = { meta: 0, off: 1, pedal: 2, on: 3 } as const

/** MIDI's variable-length quantity: seven bits per byte, high bit as "more". */
function writeVarLength(value: number): number[] {
  const bytes = [value & 0x7f]
  let rest = value >> 7
  while (rest > 0) {
    bytes.unshift((rest & 0x7f) | 0x80)
    rest >>= 7
  }
  return bytes
}

function chunk(id: string, body: readonly number[]): number[] {
  const length = body.length
  return [
    ...[...id].map((character) => character.charCodeAt(0)),
    (length >> 24) & 0xff,
    (length >> 16) & 0xff,
    (length >> 8) & 0xff,
    length & 0xff,
    ...body,
  ]
}

const text = (value: string) => [...new TextEncoder().encode(value)]

/** A meta event: a tempo, a metre, a name. */
export function metaEvent(tick: number, type: number, data: readonly number[]): MidiEvent {
  return { tick, order: ORDER.meta, bytes: [0xff, type, ...writeVarLength(data.length), ...data] }
}

/** The track's name, which a sequencer shows and an importer may read. */
export const trackName = (name: string): MidiEvent => metaEvent(0, 0x03, text(name))

/** A tempo, as microseconds per quarter note. */
export function tempoEvent(tick: number, bpm: number): MidiEvent {
  const micros = Math.round(60000000 / (bpm > 0 ? bpm : 100))
  return metaEvent(tick, 0x51, [(micros >> 16) & 0xff, (micros >> 8) & 0xff, micros & 0xff])
}

/** A time signature. The denominator is written as a power of two. */
export function metreEvent(tick: number, beats: number, beatType: number): MidiEvent {
  const power = Math.max(0, Math.round(Math.log2(beatType > 0 ? beatType : 4)))
  return metaEvent(tick, 0x58, [beats & 0xff, power, 24, 8])
}

/** A key signature: sharps positive, flats negative, and major or minor. */
export function keyEvent(tick: number, fifths: number, minor: boolean): MidiEvent {
  return metaEvent(tick, 0x59, [fifths & 0xff, minor ? 1 : 0])
}

/** A note, struck and released on one channel. */
export function noteEvents(
  channel: number,
  note: number,
  velocity: number,
  start: number,
  end: number,
): MidiEvent[] {
  const on = Math.max(0, Math.round(start))
  const off = Math.max(on + 1, Math.round(end))
  const strength = Math.min(127, Math.max(1, Math.round(velocity)))
  return [
    { tick: on, order: ORDER.on, bytes: [0x90 | channel, note & 0x7f, strength] },
    { tick: off, order: ORDER.off, bytes: [0x80 | channel, note & 0x7f, 0x00] },
  ]
}

/**
 * The sustain pedal, down and up.
 *
 * Controller 64 is the damper pedal, and 64 is also the threshold every synth
 * reads it against: 127 is down and 0 is up, which is what a switch pedal
 * sends and all this needs to say.
 */
export function pedalEvents(channel: number, down: number, up: number): MidiEvent[] {
  const from = Math.max(0, Math.round(down))
  const to = Math.max(from, Math.round(up))
  return [
    { tick: from, order: ORDER.pedal, bytes: [0xb0 | channel, 64, 127] },
    { tick: to, order: ORDER.pedal, bytes: [0xb0 | channel, 64, 0] },
  ]
}

/** One track: the events sorted, then differenced into deltas, then ended. */
function trackChunk(events: readonly MidiEvent[]): number[] {
  const sorted = [...events].sort((a, b) => a.tick - b.tick || a.order - b.order)
  const body: number[] = []
  let previous = 0
  for (const event of sorted) {
    body.push(...writeVarLength(event.tick - previous), ...event.bytes)
    previous = event.tick
  }
  body.push(...writeVarLength(0), 0xff, 0x2f, 0x00)
  return chunk('MTrk', body)
}

/** The file: format 0 for one track, format 1 for several. */
export function smfBytes(tracks: readonly (readonly MidiEvent[])[]): Uint8Array {
  const format = tracks.length > 1 ? 1 : 0
  const header = chunk('MThd', [
    0x00,
    format,
    (tracks.length >> 8) & 0xff,
    tracks.length & 0xff,
    (PPQ >> 8) & 0xff,
    PPQ & 0xff,
  ])
  return Uint8Array.from([...header, ...tracks.flatMap(trackChunk)])
}
