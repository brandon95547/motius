import {
  applyDynamics,
  buildSong,
  modeForFifths,
  numberMeasures,
  playOrder,
  sectionsFor,
  tonicForFifths,
  type ChordSymbol,
  type DetectedKey,
  type PedalSpan,
  type Song,
  type SongMeasure,
  type SongNote,
} from '@motius/shared'
import { GRACE_Q, inner, num } from './musicxml-scan'
import { choosePiano, readPartList } from './musicxml-parts'
import { applyHandMarks, partReading, scoreReading } from './musicxml-reading'
import { readMeasure } from './musicxml-measure'

/**
 * Reads MusicXML into a song.
 *
 * Scanned rather than DOM-parsed, so it runs the same in a browser, in Node and
 * in a test. MusicXML is verbose but extremely regular, and the elements that
 * matter here — note, backup, forward, attributes — never nest inside one
 * another, which is what makes scanning them in document order safe.
 *
 * The things that make notation different from a note list, and that this has
 * to handle rather than ignore:
 *
 *  - Every `<part>` starts again from the beginning of the piece. Reading the
 *    measures in file order, as this once did, played a voice-and-piano score
 *    as the voice part followed by the piano part.
 *  - `<chord/>` means "at the same time as the note before", not "after it", so
 *    a chord must not advance the cursor.
 *  - `<backup>` rewinds the cursor so a second voice or staff can be written
 *    over the same bar. Ignore it and the left hand lands after the right
 *    instead of underneath it.
 *  - A tie is one note written as two. Emitting both gives a repeated note
 *    where the music holds.
 *  - Time is counted in the score's own divisions and turned into
 *    milliseconds at the end through the tempo marks, wherever in the piece
 *    they fall. A metronome mark in minims or dotted crotchets is converted to
 *    crotchets first; read as crotchets, a 6/8 piece marked ♩.=80 plays at
 *    two thirds of its speed.
 */

export function importMusicXml(text: string, fallbackTitle: string): Song | null {
  // Compressed .mxl is a zip; it needs unpacking before it gets here.
  if (!/<score-partwise/.test(text)) return null

  const title =
    inner(text, 'work-title')?.trim() || inner(text, 'movement-title')?.trim() || fallbackTitle

  const partList = readPartList(text)
  const parts = [...text.matchAll(/<part\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/part>/g)].map(
    ([, id = '', body = '']) => ({ id, body }),
  )
  if (parts.length === 0) return null

  const stavesOf = new Map<string, number>()
  /** The clef each part opens in. */
  const clefOf = new Map<string, string>()
  for (const part of parts) {
    stavesOf.set(part.id, num(part.body, 'staves') ?? 1)
    clefOf.set(part.id, inner(part.body, 'sign')?.trim() ?? '')
  }
  const piano = choosePiano(
    partList.length > 0 ? partList : parts.map((part) => ({ id: part.id, name: '' })),
    stavesOf,
    clefOf,
  )

  const score = scoreReading()

  for (const part of parts) {
    const reading = partReading(score, part, piano, stavesOf)
    const measures = [...part.body.matchAll(/<measure\b[^>]*>([\s\S]*?)<\/measure>/g)]
    for (const [index, [, body = '']] of measures.entries())
      readMeasure(score, reading, index, body)
    applyHandMarks(score.notes, reading)
  }
  const { notes, tempos, bars, signs, rests, dynamics, pedalsQ, chordsQ, clefsQ } = score
  const { fifths, mode, pianoStaves, leadNamesStaves } = score

  if (notes.length === 0) return null

  // How hard each note is struck, now that every marking is known and has a
  // place in time. A grace note is struck before the beat it leans on and is
  // governed with it, so it is placed there for this.
  for (const { events, notes: governed } of dynamics.values()) {
    if (events.length === 0) continue
    const struck = applyDynamics(
      governed.map(({ index, line }) => {
        const note = notes[index]!
        return {
          startQ: note.grace ? note.startQ + GRACE_Q : note.startQ,
          ...(line === undefined ? {} : { line }),
        }
      }),
      events,
    )
    governed.forEach(({ index }, at) => {
      const { velocity, dynamic } = struck[at]!
      notes[index] = { ...notes[index]!, velocity, ...(dynamic ? { dynamic } : {}) }
    })
  }

  // From crotchets to milliseconds, through every tempo mark in order.
  const toMs = clock(tempos)

  const measureList: Omit<SongMeasure, 'number'>[] = []
  /*
   * Which bars each ending bracket covers.
   *
   * From the bar it opens on to the bar it closes on. A last ending is often
   * left open in the file — the bracket on the page trails off rather than
   * closing — and has to be read as its own bar and no more: taken as running
   * on, it put the whole of the next passage under a second ending, and that
   * passage was skipped the first time it came round.
   */
  for (const [index, sign] of signs.entries()) {
    if (!sign?.opens) continue
    let close = index
    for (let at = index; at < signs.length; at++) {
      if (at > index && (signs[at]?.opens || signs[at]?.start)) break
      if (signs[at]?.closes) {
        close = at
        break
      }
    }
    for (let at = index; at <= close; at++) (signs[at] ??= {}).ending = sign.opens
  }

  let atQ = 0
  for (const [index, bar] of bars.entries()) {
    const durationQ = bar.durationQ > 0 ? bar.durationQ : (bar.beats * 4) / bar.beatType
    const sign = signs[index]
    measureList.push({
      startMs: toMs(atQ),
      durationMs: toMs(atQ + durationQ) - toMs(atQ),
      startQ: atQ,
      durationQ,
      beats: bar.beats,
      beatType: bar.beatType,
      quarterMs: 60000 / bpmAt(tempos, atQ),
      ...(sign?.start || sign?.times
        ? {
            repeat: {
              ...(sign.start ? { start: true } : {}),
              ...(sign.times ? { times: sign.times } : {}),
            },
          }
        : {}),
      ...(sign?.ending ? { ending: sign.ending } : {}),
    })
    atQ += durationQ
  }

  const timed: SongNote[] = notes.map((note) => ({
    ...note,
    startMs: toMs(note.startQ),
    durationMs: Math.max(30, toMs(note.startQ + note.durationQ) - toMs(note.startQ)),
    ...(note.tied
      ? { tied: note.tied.map((segment) => ({ ...segment, startMs: toMs(segment.startQ) })) }
      : {}),
  }))
  const pedal: PedalSpan[] = pedalsQ.map((span) => ({
    startMs: toMs(span.fromQ),
    endMs: toMs(span.toQ),
  }))
  const chords: ChordSymbol[] = chordsQ.map((chord) => ({
    startQ: chord.startQ,
    startMs: toMs(chord.startQ),
    text: chord.text,
    source: 'score',
  }))

  const key: DetectedKey | null =
    fifths !== null
      ? (() => {
          const chosen = mode ?? modeForFifths(timed, fifths)
          return {
            fifths,
            mode: chosen,
            pitchClass: tonicForFifths(fifths, chosen),
            declared: true,
          }
        })()
      : null

  const first = bars[0] ?? { beats: 4, beatType: 4 }
  const names = partList.map((part) => part.name).filter((name) => name.length > 0)
  const hasDrums = timed.some((note) => note.role === 'percussion')

  return buildSong({
    id: `musicxml:${title}:${Date.now()}`,
    title,
    bpm: tempos[0]?.bpm ?? 100,
    beatsPerMeasure: (first.beats * 4) / first.beatType,
    timeSignature: { beats: first.beats, beatType: first.beatType },
    notes: timed,
    source: 'musicxml',
    handsInferred: !leadNamesStaves,
    parts: names.length > 0 ? names : [...new Set([hasDrums ? 'Drums' : 'Piano', 'Piano'])],
    key,
    pedal,
    chords,
    measures: numberMeasures(measureList),
    // The order the bars are played in, where a repeat or an ending makes that
    // something other than once through. The notes above stay as written.
    rests: rests.map((rest) => ({ ...rest, startMs: toMs(rest.startQ) })),
    ...(clefsQ.length > 0
      ? {
          // In the order they come in the music: a piano written as a part a
          // hand states each part's clefs in turn.
          clefs: clefsQ
            .map((clef) => ({ ...clef, startMs: toMs(clef.startQ) }))
            .sort((a, b) => a.startQ - b.startQ),
        }
      : {}),
    ...(pianoStaves ? { staves: pianoStaves } : {}),
    sections: sectionsFor(
      measureList,
      playOrder(measureList),
      Math.max(0, ...timed.map((note) => note.startMs + note.durationMs)),
    ),
    rhythmFromScore: true,
  })
}

/** The tempo in force at a point, in crotchets per minute. */
function bpmAt(tempos: readonly { atQ: number; bpm: number }[], atQ: number): number {
  let bpm = tempos[0]?.bpm ?? 100
  for (const mark of tempos) if (mark.atQ <= atQ + 1e-9) bpm = mark.bpm
  return bpm > 0 ? bpm : 100
}

/**
 * Crotchets into milliseconds, tempo mark by tempo mark.
 *
 * A change of tempo halfway through a piece changes the length of every
 * crotchet after it and none before it, so the conversion walks the marks in
 * order and adds up each stretch at its own speed. One tempo for the whole
 * piece, which is what this replaced, put every note after a change in the
 * wrong place.
 */
function clock(tempos: readonly { atQ: number; bpm: number }[]): (quarters: number) => number {
  const marks = [...tempos].filter((mark) => mark.bpm > 0).sort((a, b) => a.atQ - b.atQ)
  const initial = marks[0]?.bpm ?? 100
  return (quarters: number) => {
    let ms = 0
    let atQ = 0
    let bpm = initial
    for (const mark of marks) {
      if (mark.atQ >= quarters) break
      if (mark.atQ > atQ) {
        ms += (mark.atQ - atQ) * (60000 / bpm)
        atQ = mark.atQ
      }
      bpm = mark.bpm
    }
    return ms + (quarters - atQ) * (60000 / bpm)
  }
}
