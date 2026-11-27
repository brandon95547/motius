import {
  splitRest,
  splitSpan,
  writtenFromQuarters,
  writtenValue,
  type NoteValue,
} from '../music/notation.js'
import { normalisePitchClass, spellInKey } from '../music/pitch.js'
import { escapeXml, musicXmlDocument, pitchXml } from '../export/musicxml-base.js'
import { quartersAt, quartersPerBar, type SongMeasure } from './meter.js'
import { GRACE_Q, type Song, type SongNote, type WrittenNote } from './song.js'

/**
 * A song as MusicXML: the piano part on its grand staff, the right hand on
 * the upper staff and the left on the lower, with everything the song knows
 * about how it is written — its bars, metres, tempos, key, clefs, repeats and
 * endings, ties, tuplets, grace notes, voices, fingering, dynamics, rolled
 * chords, pedaling and the chord symbols the score printed.
 *
 * The other parts of an arrangement (a bass, a kit) are left out: a song
 * keeps their notes to play behind the piano and not which instrument each
 * came from, so there is no part to name them by.
 *
 * ## Voices
 *
 * MusicXML writes a staff's music as voices that each run left to right with
 * no overlap. A song's notes do not promise that: a MIDI file holds a note
 * under the next one as often as not. So each bar's notes on each staff are
 * dealt into lanes — a chord goes into its own voice's lane when that lane is
 * free, and into the next free one when it is not — and every lane becomes a
 * voice. Nothing is cut short to fit and nothing is dropped.
 *
 * ## Time
 *
 * A song from a score states its rhythm exactly, triplets and all, and it is
 * written as stated. A song from a MIDI file states when keys went down, and
 * is rounded to a demisemiquaver first, which is what the staff on screen
 * does too.
 */

/**
 * Divisions per crotchet, at the least: a demisemiquaver, and triplets,
 * quintuplets and septuplets of it. A song with rarer tuplets (a run of nine
 * or eighteen in a cadenza) gets as many more as they need: see `divisionsOf`.
 */
const DIVISIONS = 840
/** The most divisions a song is given, however odd its tuplets: past it, a few round. */
const MOST_DIVISIONS = 840 * 9 * 11 * 13

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))

/** Divisions per crotchet that write every tuplet in the song exactly. */
function divisionsOf(song: Song): number {
  let divisions = DIVISIONS
  for (const note of song.notes) {
    const actual = note.written?.tuplet?.actual
    if (!actual) continue
    // A tuplet's notes fall on multiples of a demisemiquaver over `actual`.
    const wanted = (divisions * actual * 8) / gcd(divisions, actual * 8)
    if (wanted <= MOST_DIVISIONS) divisions = wanted
  }
  return divisions
}

const TYPE: Record<NoteValue, string> = {
  whole: 'whole',
  half: 'half',
  quarter: 'quarter',
  eighth: 'eighth',
  sixteenth: '16th',
  'thirty-second': '32nd',
}

interface Shape {
  readonly value: NoteValue
  readonly dots: number
  readonly tuplet?: { readonly actual: number; readonly normal: number }
}

/** A written value and how many divisions it takes. */
interface Piece {
  readonly divs: number
  readonly shape: Shape
}

const TUPLETS = [
  [3, 2],
  [5, 4],
  [6, 4],
  [7, 4],
] as const

/** The one written value, a tuplet's included, that lasts exactly this long; or null. */
function shapeOf(divs: number, unit: number): Shape | null {
  const quarters = divs / unit
  const plain = writtenFromQuarters(quarters)
  if (plain) return { value: plain.value, dots: plain.dots }
  for (const [actual, normal] of TUPLETS) {
    const inside = writtenFromQuarters((quarters * actual) / normal)
    if (inside && inside.dots === 0)
      return { value: inside.value, dots: 0, tuplet: { actual, normal } }
  }
  return null
}

/** The beat of a bar in crotchets: a dotted crotchet in compound time. */
function beatOf(bar: SongMeasure): number {
  const compound = bar.beatType === 8 && bar.beats % 3 === 0 && bar.beats > 3
  return compound ? 1.5 : 4 / (bar.beatType > 0 ? bar.beatType : 4)
}

/** On the demisemiquaver grid a played rhythm is rounded to. */
const onGrid = (divs: number, unit: number) => divs % (unit / 8) === 0

/** Pieces of the notation helpers' crotchets, made to add up to exactly `length`. */
function fitted(
  pieces: readonly { value: NoteValue; dots: number; quarters: number }[],
  length: number,
  unit: number,
): Piece[] {
  const out = pieces.map((piece) => ({
    divs: Math.round(piece.quarters * unit),
    shape: { value: piece.value, dots: piece.dots },
  }))
  const total = out.reduce((sum, piece) => sum + piece.divs, 0)
  if (out.length > 0 && total !== length) {
    const last = out.at(-1)!
    out[out.length - 1] = { ...last, divs: last.divs + length - total }
  }
  return out.filter((piece) => piece.divs > 0)
}

/**
 * How a stretch of a note is written: as the score wrote it where this is the
 * whole note, else as the notation helpers split a span, tied.
 */
function notePieces(
  at: number,
  length: number,
  bar: SongMeasure,
  unit: number,
  written?: WrittenNote,
): Piece[] {
  if (written) {
    const tuplet = written.tuplet
      ? { actual: written.tuplet.actual, normal: written.tuplet.normal }
      : undefined
    return [
      {
        divs: length,
        shape: { value: written.value, dots: written.dots, ...(tuplet ? { tuplet } : {}) },
      },
    ]
  }
  if (onGrid(at, unit) && onGrid(length, unit)) {
    const pieces = fitted(
      splitSpan(at / unit, length / unit, beatOf(bar), bar.durationQ),
      length,
      unit,
    )
    if (pieces.length > 0) return pieces
  }
  const shape = shapeOf(length, unit)
  if (shape) return [{ divs: length, shape }]
  // Nothing writes it exactly: the nearest value, lasting as long as it does.
  const nearest = writtenValue(length, unit)
  return [{ divs: length, shape: { value: nearest.value, dots: nearest.dots } }]
}

/** How a silence is written, or null where only an unseen `<forward>` will do. */
function restPieces(at: number, length: number, bar: SongMeasure, unit: number): Piece[] | null {
  if (onGrid(at, unit) && onGrid(length, unit)) {
    const pieces = fitted(
      splitRest(at / unit, length / unit, beatOf(bar), bar.durationQ),
      length,
      unit,
    )
    if (pieces.length > 0) return pieces
  }
  const shape = shapeOf(length, unit)
  return shape ? [{ divs: length, shape }] : null
}

function shapeXml(shape: Shape): string {
  return (
    `<type>${TYPE[shape.value]}</type>` +
    '<dot/>'.repeat(shape.dots) +
    (shape.tuplet
      ? `<time-modification><actual-notes>${shape.tuplet.actual}</actual-notes>` +
        `<normal-notes>${shape.tuplet.normal}</normal-notes></time-modification>`
      : '')
  )
}

const CLEFS = {
  treble: '<sign>G</sign><line>2</line>',
  bass: '<sign>F</sign><line>4</line>',
} as const

const clefXml = (staff: number, clef: 'treble' | 'bass') =>
  `<clef number="${staff}">${CLEFS[clef]}</clef>`

/** The dynamics MusicXML has an element for; anything else is written as text. */
const DYNAMICS = new Set([
  'pppppp',
  'ppppp',
  'pppp',
  'ppp',
  'pp',
  'p',
  'mp',
  'mf',
  'f',
  'ff',
  'fff',
  'ffff',
  'fffff',
  'ffffff',
  'sf',
  'sfz',
  'sffz',
  'sfp',
  'sfpp',
  'fp',
  'fz',
  'rf',
  'rfz',
  'pf',
  'n',
])

const dynamicXml = (marking: string) =>
  DYNAMICS.has(marking) ? `<${marking}/>` : `<other-dynamics>${escapeXml(marking)}</other-dynamics>`

/** Chord qualities MusicXML names, by the suffix a chord symbol writes them with. */
const KINDS: Record<string, string> = {
  '': 'major',
  m: 'minor',
  min: 'minor',
  '-': 'minor',
  '7': 'dominant',
  maj7: 'major-seventh',
  M7: 'major-seventh',
  m7: 'minor-seventh',
  min7: 'minor-seventh',
  dim: 'diminished',
  '°': 'diminished',
  dim7: 'diminished-seventh',
  '°7': 'diminished-seventh',
  m7b5: 'half-diminished',
  'm7♭5': 'half-diminished',
  ø: 'half-diminished',
  ø7: 'half-diminished',
  aug: 'augmented',
  '+': 'augmented',
  sus4: 'suspended-fourth',
  sus: 'suspended-fourth',
  sus2: 'suspended-second',
  '6': 'major-sixth',
  m6: 'minor-sixth',
  '9': 'dominant-ninth',
  maj9: 'major-ninth',
  m9: 'minor-ninth',
  '5': 'power',
}

const ALTERS: Record<string, number> = { '': 0, '#': 1, '♯': 1, b: -1, '♭': -1 }

/** A chord symbol as `<harmony>`, or null where its root cannot be read. */
function harmonyXml(text: string, offset: number): string | null {
  const match = /^([A-G])([#♯b♭]?)(.*?)(?:\/([A-G])([#♯b♭]?))?$/.exec(text.trim())
  if (!match) return null
  const [, root, rootAlter = '', suffix = '', bass, bassAlter = ''] = match
  const kind = KINDS[suffix]
  return (
    '<harmony>' +
    `<root><root-step>${root}</root-step>` +
    (ALTERS[rootAlter] ? `<root-alter>${ALTERS[rootAlter]}</root-alter>` : '') +
    '</root>' +
    `<kind text="${escapeXml(suffix)}">${kind ?? 'other'}</kind>` +
    (bass
      ? `<bass><bass-step>${bass}</bass-step>` +
        (ALTERS[bassAlter] ? `<bass-alter>${ALTERS[bassAlter]}</bass-alter>` : '') +
        '</bass>'
      : '') +
    (offset > 0 ? `<offset>${offset}</offset>` : '') +
    '</harmony>'
  )
}

/** A note's stretch inside one bar. */
interface Segment {
  readonly note: SongNote
  readonly start: number
  readonly end: number
  /** It begins in this bar, rather than being carried over from the last. */
  readonly first: boolean
  /** It ends in this bar, rather than being carried into the next. */
  readonly last: boolean
}

/** Notes struck and released together in one voice: one chord, one stem. */
interface Group {
  readonly start: number
  readonly end: number
  readonly voice: number
  readonly segments: Segment[]
}

/** A mark placed by offset from the start of its bar: a direction, a chord symbol. */
interface Mark {
  readonly at: number
  readonly xml: (offset: number) => string
}

export function writeSongMusicXml(song: Song): string {
  const staves = song.staves && song.staves > 2 ? song.staves : 2
  const staffOf = (on: { staff?: number; hand: 'left' | 'right' }) =>
    on.staff ?? (on.hand === 'left' ? staves : 1)
  /**
   * The staff a note's hand is written on when it is not visiting the other's:
   * its voice is numbered for that staff, the first four voices the upper
   * staff's and the next four the lower's, as MuseScore numbers them. That is
   * what keeps a right hand written on the lower staff the right hand.
   */
  const upperStaves = Math.floor(staves / 2)
  const homeOf = (note: SongNote) => {
    const staff = staffOf(note)
    const upper = staff <= upperStaves
    if ((note.hand === 'right') === upper) return staff
    return note.hand === 'right' ? upperStaves : upperStaves + 1
  }
  const fifths = song.key?.fifths ?? 0
  const mode = song.key?.mode ?? 'major'
  const exact = song.provides.rhythm
  const unit = divisionsOf(song)
  const grid = unit / 8
  const divs = (quarters: number) => Math.round(quarters * unit)
  const snapped = (quarters: number) => (exact ? divs(quarters) : Math.round(quarters * 8) * grid)

  const keyboard = song.notes.filter((note) => note.role === 'keyboard')
  const timed = keyboard.map((note) => {
    const startQ = note.startQ ?? quartersAt(song.measures, note.startMs)
    const durationQ = note.durationQ ?? note.durationMs / (song.measures[0]?.quarterMs ?? 600)
    // A grace note is placed by the note it leads into.
    const start = snapped(note.grace ? startQ + GRACE_Q : startQ)
    return {
      note,
      start,
      end: note.grace ? start : Math.max(start + (exact ? 1 : grid), snapped(startQ + durationQ)),
    }
  })
  const graces = timed.filter((entry) => entry.note.grace)
  const played = timed.filter((entry) => !entry.note.grace)

  const spelled = (note: SongNote) =>
    pitchXml(note.note, note.spelling ?? spellInKey(normalisePitchClass(note.note), fifths, mode))

  // Every mark placed by time, gathered once and handed out bar by bar.
  const marks: Mark[] = []
  for (let staff = 1; staff <= staves; staff++) {
    let last: string | undefined
    const seen = new Set<number>()
    for (const entry of played
      .filter((candidate) => staffOf(candidate.note) === staff)
      .sort((a, b) => a.start - b.start)) {
      const marking = entry.note.dynamic
      if (!marking || marking === last || seen.has(entry.start)) continue
      last = marking
      seen.add(entry.start)
      marks.push({
        at: entry.start,
        xml: (offset) =>
          `<direction placement="below"><direction-type><dynamics>${dynamicXml(marking)}</dynamics></direction-type>` +
          (offset > 0 ? `<offset>${offset}</offset>` : '') +
          `<staff>${staff}</staff></direction>`,
      })
    }
  }
  for (const chord of song.chords) {
    if (chord.source !== 'score') continue
    const at = snapped(chord.startQ)
    marks.push({ at, xml: (offset) => harmonyXml(chord.text, offset) ?? '' })
  }

  const pedalMark = (type: 'start' | 'stop') => (offset: number) =>
    `<direction placement="below"><direction-type><pedal type="${type}" line="yes"/></direction-type>` +
    (offset > 0 ? `<offset>${offset}</offset>` : '') +
    `<staff>${staves}</staff></direction>`
  const pedals = song.pedal
    .map((span) => ({
      down: snapped(quartersAt(song.measures, span.startMs)),
      up: snapped(quartersAt(song.measures, span.endMs)),
    }))
    .filter((span) => span.up > span.down)

  const clefChanges = (song.clefs ?? [])
    .map((clef) => ({ staff: staffOf(clef), at: snapped(clef.startQ), clef: clef.clef }))
    .sort((a, b) => a.at - b.at)
  const firstStart = divs(song.measures[0]?.startQ ?? 0)
  const clefNow = new Map<number, 'treble' | 'bass'>()
  for (let staff = 1; staff <= staves; staff++) {
    const opening = clefChanges
      .filter((change) => change.staff === staff && change.at <= firstStart)
      .at(-1)
    clefNow.set(staff, opening?.clef ?? (staff <= staves / 2 ? 'treble' : 'bass'))
  }

  const measures: string[] = []
  let tempo = 0
  let metre = ''
  song.measures.forEach((bar, index) => {
    const from = divs(bar.startQ)
    const to = divs(bar.startQ + bar.durationQ)
    const out: string[] = []
    const previous = song.measures[index - 1]
    const next = song.measures[index + 1]

    // The left barline: a repeat opens, an ending's bracket begins.
    const ending = bar.ending?.join(',')
    const endingStarts = ending && previous?.ending?.join(',') !== ending
    if (bar.repeat?.start || endingStarts) {
      out.push(
        '<barline location="left">' +
          (bar.repeat?.start ? '<bar-style>heavy-light</bar-style>' : '') +
          (endingStarts ? `<ending number="${ending}" type="start"/>` : '') +
          (bar.repeat?.start ? '<repeat direction="forward"/>' : '') +
          '</barline>',
      )
    }

    // The attributes: everything on the first bar, a change of metre after it,
    // and a clef that changes on the bar line.
    const attributes: string[] = []
    if (index === 0) {
      attributes.push(
        `<divisions>${unit}</divisions>`,
        `<key><fifths>${fifths}</fifths><mode>${mode}</mode></key>`,
      )
    }
    const thisMetre = `${bar.beats}/${bar.beatType}`
    if (thisMetre !== metre) {
      attributes.push(
        `<time><beats>${bar.beats}</beats><beat-type>${bar.beatType}</beat-type></time>`,
      )
      metre = thisMetre
    }
    if (index === 0) {
      attributes.push(`<staves>${staves}</staves>`)
      for (let staff = 1; staff <= staves; staff++)
        attributes.push(clefXml(staff, clefNow.get(staff)!))
    }
    const laterClefs: { staff: number; at: number; clef: 'treble' | 'bass' }[] = []
    for (const change of clefChanges) {
      if (change.at < from || change.at >= to || (index === 0 && change.at <= firstStart)) continue
      if (clefNow.get(change.staff) === change.clef) continue
      clefNow.set(change.staff, change.clef)
      if (change.at === from) attributes.push(clefXml(change.staff, change.clef))
      else laterClefs.push(change)
    }
    if (attributes.length > 0) out.push(`<attributes>${attributes.join('')}</attributes>`)

    // The tempo, wherever it changes.
    const bpm = Math.round((60000 / bar.quarterMs) * 100) / 100
    if (Math.abs(bpm - tempo) > 0.01) {
      tempo = bpm
      const shown = Math.round(bpm)
      out.push(
        '<direction placement="above"><direction-type><metronome>' +
          `<beat-unit>quarter</beat-unit><per-minute>${shown}</per-minute>` +
          `</metronome></direction-type><staff>1</staff><sound tempo="${bpm}"/></direction>`,
      )
    }

    // Marks placed by offset, before the notes move the cursor away from the bar's start.
    for (const mark of marks)
      if (mark.at >= from && mark.at < to) out.push(mark.xml(mark.at - from))
    const pedalMarks: { at: number; type: 'start' | 'stop' }[] = []
    for (const span of pedals) {
      if (span.down >= from && span.down < to) pedalMarks.push({ at: span.down, type: 'start' })
      // A release on the bar line closes this bar's pedal, not the next one's.
      if (span.up > from && span.up <= to) pedalMarks.push({ at: span.up, type: 'stop' })
    }
    pedalMarks
      .sort((a, b) => a.at - b.at || (a.type === 'stop' ? -1 : 1))
      .forEach((mark) => out.push(pedalMark(mark.type)(mark.at - from)))

    let cursor = from
    const moveTo = (at: number) => {
      if (at > cursor) out.push(`<forward><duration>${at - cursor}</duration></forward>`)
      if (at < cursor) out.push(`<backup><duration>${cursor - at}</duration></backup>`)
      cursor = at
    }

    for (let home = 1; home <= staves; home++) {
      const lanes = lanesOf(
        played
          .filter((entry) => homeOf(entry.note) === home && entry.start < to && entry.end > from)
          .map((entry) => ({
            note: entry.note,
            start: Math.max(entry.start, from),
            end: Math.min(entry.end, to),
            first: entry.start >= from,
            last: entry.end <= to,
          })),
      )
      const staffGraces = graces
        .filter((entry) => homeOf(entry.note) === home && entry.start >= from && entry.start < to)
        .sort((a, b) => a.start - b.start)
      if (lanes.length === 0) lanes.push([])

      lanes.forEach((lane, laneIndex) => {
        moveTo(from)
        const voice = (home - 1) * 4 + laneIndex + 1
        const main = laneIndex === 0
        const pending = main ? [...staffGraces] : []

        const graceXml = (upTo: number) => {
          let previousStart: number | null = null
          while (pending.length > 0 && pending[0]!.start <= upTo) {
            const { note, start } = pending.shift()!
            const shape = note.written
              ? { value: note.written.value, dots: note.written.dots }
              : { value: 'eighth' as const, dots: 0 }
            out.push(
              '<note><grace slash="yes"/>' +
                (previousStart === start ? '<chord/>' : '') +
                spelled(note) +
                `<voice>${voice}</voice>${shapeXml(shape)}<staff>${staffOf(note)}</staff>` +
                (note.finger
                  ? `<notations><technical><fingering>${note.finger}</fingering></technical></notations>`
                  : '') +
                '</note>',
            )
            previousStart = start
          }
        }

        const silence = (length: number) => {
          if (length <= 0) return
          const pieces = main ? restPieces(cursor - from, length, bar, unit) : null
          if (!pieces) {
            out.push(`<forward><duration>${length}</duration></forward>`)
            cursor += length
            return
          }
          for (const piece of pieces) {
            out.push(
              `<note><rest/><duration>${piece.divs}</duration><voice>${voice}</voice>` +
                `${shapeXml(piece.shape)}<staff>${home}</staff></note>`,
            )
            cursor += piece.divs
          }
        }

        // Up to a point in the bar, writing any grace note on the way at its
        // own place: the note it leads into may be in another voice.
        const advanceTo = (target: number) => {
          while (pending.length > 0 && pending[0]!.start <= target) {
            silence(pending[0]!.start - cursor)
            graceXml(pending[0]!.start)
          }
          silence(target - cursor)
        }

        if (main && lane.length === 0 && pending.length === 0) {
          out.push(
            `<note><rest measure="yes"/><duration>${to - from}</duration>` +
              `<voice>${voice}</voice><staff>${home}</staff></note>`,
          )
          cursor = to
          return
        }

        for (const group of lane) {
          advanceTo(group.start)
          const whole = group.segments.every((segment) => segment.first && segment.last)
          const written = whole ? group.segments[0]!.note.written : undefined
          const pieces = notePieces(group.start - from, group.end - group.start, bar, unit, written)
          pieces.forEach((piece, pieceIndex) => {
            group.segments.forEach((segment, chordIndex) => {
              const opening = pieceIndex === 0 && segment.first
              const tieStop = pieceIndex > 0 || !segment.first
              const tieStart = pieceIndex < pieces.length - 1 || !segment.last
              const notations = [
                tieStop ? '<tied type="stop"/>' : '',
                tieStart ? '<tied type="start"/>' : '',
                opening && segment.note.rolled ? '<arpeggiate/>' : '',
                opening && segment.note.finger
                  ? `<technical><fingering>${segment.note.finger}</fingering></technical>`
                  : '',
              ].join('')
              out.push(
                `<note${opening ? ` dynamics="${Math.round((segment.note.velocity / 90) * 10000) / 100}"` : ''}>` +
                  (chordIndex > 0 ? '<chord/>' : '') +
                  spelled(segment.note) +
                  `<duration>${piece.divs}</duration>` +
                  (tieStop ? '<tie type="stop"/>' : '') +
                  (tieStart ? '<tie type="start"/>' : '') +
                  `<voice>${voice}</voice>${shapeXml(piece.shape)}<staff>${staffOf(segment.note)}</staff>` +
                  (notations ? `<notations>${notations}</notations>` : '') +
                  '</note>',
              )
            })
            cursor += piece.divs
          })
        }
        if (main) advanceTo(to)
      })
    }

    // A clef that changes inside the bar, at its place.
    for (const change of laterClefs) {
      moveTo(change.at)
      out.push(`<attributes>${clefXml(change.staff, change.clef)}</attributes>`)
    }

    // The right barline: an ending's bracket closes, a repeat goes back.
    const endingStops = ending && next?.ending?.join(',') !== ending
    const repeatEnd = bar.repeat?.times !== undefined
    if (endingStops || repeatEnd) {
      out.push(
        '<barline location="right">' +
          (repeatEnd ? '<bar-style>light-heavy</bar-style>' : '') +
          (endingStops
            ? `<ending number="${ending}" type="${repeatEnd ? 'stop' : 'discontinue'}"/>`
            : '') +
          (repeatEnd
            ? `<repeat direction="backward"${bar.repeat!.times! !== 2 ? ` times="${bar.repeat!.times}"` : ''}/>`
            : '') +
          '</barline>',
      )
    }

    // A pickup is bar 0 and shorter than its metre: an implicit bar, not a short one.
    const pickup =
      bar.number === 0 || bar.durationQ < quartersPerBar(bar.beats, bar.beatType) - 1e-6
    measures.push(
      `<measure number="${bar.number}"${pickup && index === 0 ? ' implicit="yes"' : ''}>` +
        out.join('') +
        '</measure>',
    )
  })

  return musicXmlDocument(song.title, measures)
}

/**
 * Deals one hand's bar on its staff into voices that never overlap.
 *
 * Chords are the notes of one voice struck and released together. Each goes
 * into the lane its voice already holds if that lane is free by then, else
 * into the first free lane, else a new one.
 */
function lanesOf(segments: readonly Segment[]): Group[][] {
  const groups = new Map<string, Group>()
  for (const segment of segments) {
    const voice = segment.note.voice ?? 1
    // A chord is on one staff: a note of it written on the other is a chord of its own.
    const key = `${voice}|${segment.note.staff ?? ''}|${segment.note.hand}|${segment.start}|${segment.end}`
    const group = groups.get(key)
    if (group) group.segments.push(segment)
    else groups.set(key, { start: segment.start, end: segment.end, voice, segments: [segment] })
  }
  const ordered = [...groups.values()].sort(
    (a, b) => a.start - b.start || a.voice - b.voice || b.end - a.end,
  )
  const lanes: { voice: number; end: number; groups: Group[] }[] = []
  for (const group of ordered) {
    group.segments.sort((a, b) => a.note.note - b.note.note)
    const lane =
      lanes.find((candidate) => candidate.voice === group.voice && candidate.end <= group.start) ??
      lanes.find((candidate) => candidate.end <= group.start)
    if (lane) {
      lane.groups.push(group)
      lane.end = group.end
    } else {
      lanes.push({ voice: group.voice, end: group.end, groups: [group] })
    }
  }
  return lanes.map((lane) => lane.groups)
}
