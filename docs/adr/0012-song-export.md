# 12. Songs export as MusicXML and MIDI

## Context

A song opened in Songs could be imported but not saved back out. Recordings
already exported as MusicXML and MIDI, each with its own hand-written writer.

## Decision

- **Two formats.** MusicXML for notation (MuseScore, Sibelius, Finale,
  Dorico), and MIDI for the performance (DAWs and sequencers). Between them they
  cover what other programs read. Compressed `.mxl` would save nothing a user
  needs, and PDF would mean engraving pages, which is a feature of its own.
- **One writer layer.** The bytes of a MIDI file (`packages/shared/src/export/smf.ts`)
  and the frame of a MusicXML file (`export/musicxml-base.ts`) are shared by the
  recording and the song writers (`songs/song-musicxml.ts`, `songs/song-midi.ts`).
- **Hands.** In MusicXML a voice is numbered for its hand's own staff (1–4 upper,
  5–8 lower, as MuseScore numbers them), and each note carries the staff it is
  written on. This keeps a right hand written on the lower staff the right hand.
  In MIDI each hand is its own track, the right first, both on the piano. That
  is the layout the MIDI importer reads as two hands.
- **Voices.** A bar's notes on a staff are dealt into lanes that never overlap,
  so a held note under a moving line becomes a second voice. It is never cut
  short.
- **Time.** A score's rhythm is written exactly. The divisions per crotchet are
  840, raised for any rarer tuplet the song has. A MIDI song's rhythm is rounded
  to a 32nd note, as the staff on screen rounds it.
- **MIDI plays repeats out**, because MIDI has no repeat signs.
- **Only the piano part.** A song keeps the other parts' notes but not which
  instrument played each, so there is nothing to name them by.
- **On demand.** The writers load with the export dialog, so no page carries them.

## Checked

Every built-in score (82) was exported and read back with Motius's own
importers. In MIDI every song came back note for note. In MusicXML, 77 came
back note for note. The other 5 differ only where the source files had rounded
odd tuplets (by about 0.001 of a beat), and where a grace note is tied into the
next note (it comes back as a plain grace note).
