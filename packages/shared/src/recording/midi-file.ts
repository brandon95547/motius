import type { PedalSpan } from '../songs/song.js'
import { noteEvents, pedalEvents, PPQ, smfBytes, tempoEvent } from '../export/smf.js'
import type { RecordedNote } from './performance.js'

/**
 * A recording as a Standard MIDI File (the bytes are `export/smf.ts`'s).
 *
 * Format 0 — one track, everything on it — because a solo piano performance is
 * one part and nothing downstream benefits from splitting it. Every sequencer,
 * DAW and notation program reads format 0.
 *
 * MIDI is the honest export for a performance: it keeps the timing and the
 * velocities exactly as played, where notation has to round both onto a grid
 * before it can draw them.
 */

export interface MidiFileOptions {
  /** Beats per minute the file declares. Timing is absolute either way. */
  readonly bpm?: number
  /** When the sustain pedal was down, written as CC64. */
  readonly pedal?: readonly PedalSpan[]
}

export function writeMidiFile(
  notes: readonly RecordedNote[],
  options: MidiFileOptions = {},
): Uint8Array {
  const bpm = options.bpm && options.bpm > 0 ? options.bpm : 100
  const ticksPerMs = (PPQ * bpm) / 60000
  return smfBytes([
    [
      tempoEvent(0, bpm),
      ...notes.flatMap((note) =>
        noteEvents(
          0,
          note.note,
          note.velocity,
          note.startMs * ticksPerMs,
          (note.startMs + note.durationMs) * ticksPerMs,
        ),
      ),
      ...(options.pedal ?? []).flatMap((span) =>
        pedalEvents(0, span.startMs * ticksPerMs, span.endMs * ticksPerMs),
      ),
    ],
  ])
}
