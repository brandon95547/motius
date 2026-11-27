import type { Spelling } from '../music/pitch.js'
import { staffPlacement } from '../music/staff.js'

/**
 * What every MusicXML file Motius writes has in common: the pitch of a note,
 * escaped text, and the document around one piano part. A recording and a
 * song are written differently and framed the same.
 */

export const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * A note's `<pitch>`, written with the letter it is spelled with.
 *
 * `staffPlacement` puts the octave on the *letter*, which is what MusicXML
 * wants: B♯3 is step B, alter 1, octave 3. Without a spelling it is sharps.
 */
export function pitchXml(note: number, spelling: Spelling | null): string {
  const { letter, accidental, octave } = staffPlacement(note, spelling)
  return (
    '<pitch>' +
    `<step>${letter}</step>` +
    (accidental !== 0 ? `<alter>${accidental}</alter>` : '') +
    `<octave>${octave}</octave>` +
    '</pitch>'
  )
}

/** The whole file: a title, one piano part, and its measures. */
export function musicXmlDocument(title: string, measures: readonly string[]): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
    '<score-partwise version="4.0">',
    `<work><work-title>${escapeXml(title)}</work-title></work>`,
    '<identification><encoding><software>Motius</software></encoding></identification>',
    '<part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>',
    '<part id="P1">',
    ...measures,
    '</part>',
    '</score-partwise>',
  ].join('\n')
}
