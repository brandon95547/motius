import {
  DEFAULT_VELOCITY,
  applyDynamics,
  buildSong,
  dynamicEvents,
  inferHand,
  modeForFifths,
  numberMeasures,
  playOrder,
  sectionsFor,
  spellingName,
  swellOfWords,
  tonicForFifths,
  valueQuarters,
  type Accidental,
  type ChordSymbol,
  type DetectedKey,
  type DynamicEvent,
  type DynamicLine,
  type Hand,
  type NoteValue,
  type PartRole,
  type PedalSpan,
  type Song,
  type SongMeasure,
  type SongNote,
  type SongRest,
  type Spelling,
  type WrittenNote,
} from '@sonara/shared'

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

const STEP_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const LETTER_INDEX: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 }

/** MusicXML note types onto the values the engraver draws. */
const TYPE_VALUES: Record<string, NoteValue> = {
  maxima: 'whole',
  long: 'whole',
  breve: 'whole',
  whole: 'whole',
  half: 'half',
  quarter: 'quarter',
  eighth: 'eighth',
  '16th': 'sixteenth',
  '32nd': 'thirty-second',
  '64th': 'thirty-second',
  '128th': 'thirty-second',
  '256th': 'thirty-second',
}

/** Kinds a `<harmony>` names, as the suffix a lead sheet prints. */
const KIND_SUFFIX: Record<string, string> = {
  major: '',
  minor: 'm',
  augmented: '+',
  diminished: '°',
  dominant: '7',
  'major-seventh': 'maj7',
  'minor-seventh': 'm7',
  'diminished-seventh': '°7',
  'augmented-seventh': '+7',
  'half-diminished': 'ø7',
  'major-minor': 'm(maj7)',
  'major-sixth': '6',
  'minor-sixth': 'm6',
  'dominant-ninth': '9',
  'major-ninth': 'maj9',
  'minor-ninth': 'm9',
  'dominant-11th': '11',
  'dominant-13th': '13',
  'suspended-second': 'sus2',
  'suspended-fourth': 'sus4',
  power: '5',
  none: '',
}

/** How long before its beat a grace note is struck, in crotchets. */
const GRACE_Q = 0.25

const inner = (xml: string, tag: string): string | undefined =>
  new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`).exec(xml)?.[1]

const num = (xml: string, tag: string): number | undefined => {
  const text = inner(xml, tag)
  if (text === undefined) return undefined
  const value = Number(text.trim())
  return Number.isFinite(value) ? value : undefined
}

/**
 * The staff each voice of a part belongs to.
 *
 * A staff is not quite a hand. A right hand that runs down into the bass is
 * often written on the lower staff while it is there, to spare the ledger
 * lines, and it is still the right hand: the notes keep their voice and change
 * their staff. So a voice has a staff of its own, the one it is written on
 * when it is not visiting, and that says whose notes they are.
 *
 * Most programs number the voices of each staff apart — MuseScore the first
 * four for the upper staff and the next four for the lower — and then the
 * number says it outright. Otherwise a voice's own staff is the one most of
 * its notes are on.
 *
 * Null where the numbers do not name lines at all: a file that calls the upper
 * staff's line voice 1 and the lower staff's line voice 1 as well has said
 * nothing with them, and each note is then its staff's hand, as before.
 */
function voiceHomes(part: string, staves: number): Map<string, number> | null {
  const counts = new Map<string, Map<number, number>>()
  /** The bars each voice is in, and those where it is two lines on different staves. */
  const seen = new Map<string, number>()
  const split = new Map<string, number>()
  for (const [, measure = ''] of part.matchAll(/<measure\b[^>]*>([\s\S]*?)<\/measure>/g)) {
    let sequence = 0
    const lines = new Map<string, Map<number, Set<number>>>()
    for (const block of measure.matchAll(/<(note|backup)\b[^>]*?(?:\/>|>([\s\S]*?)<\/\1>)/g)) {
      if (block[1] === 'backup') {
        sequence++
        continue
      }
      const content = block[2] ?? ''
      const staff = num(content, 'staff')
      if (staff === undefined) continue
      const voice = inner(content, 'voice')?.trim() ?? '1'
      const line = lines.get(voice) ?? new Map<number, Set<number>>()
      lines.set(voice, line)
      line.set(sequence, (line.get(sequence) ?? new Set<number>()).add(staff))
      if (!inner(content, 'pitch')) continue
      const count = counts.get(voice) ?? new Map<number, number>()
      counts.set(voice, count)
      count.set(staff, (count.get(staff) ?? 0) + 1)
    }
    for (const [voice, line] of lines) {
      seen.set(voice, (seen.get(voice) ?? 0) + 1)
      const written = new Set([...line.values()].map((on) => [...on].sort().join()))
      if (written.size > 1) split.set(voice, (split.get(voice) ?? 0) + 1)
    }
  }
  if (counts.size === 0) return null
  // The odd bar is a quirk of the program that wrote it. Bar after bar is a
  // number that means nothing.
  for (const [voice, bars] of seen) if ((split.get(voice) ?? 0) > bars * 0.05) return null

  let total = 0
  let numbered = 0
  for (const [voice, count] of counts)
    for (const [staff, notes] of count) {
      total += notes
      if (Math.ceil(Number(voice) / 4) === staff) numbered += notes
    }
  const byNumber =
    [...counts.keys()].every((voice) => Number(voice) >= 1 && Number(voice) <= staves * 4) &&
    numbered >= total * 0.9
  const homes = new Map<string, number>()
  for (const [voice, count] of counts)
    homes.set(
      voice,
      byNumber
        ? Math.ceil(Number(voice) / 4)
        : [...count].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]![0],
    )
  return homes
}

/** The clef a staff of a part opens in: its sign, as the file writes it. */
function openingClef(part: string, staffNumber: number): string | undefined {
  for (const [, attrs = '', clef = ''] of part.matchAll(/<clef\b([^>]*)>([\s\S]*?)<\/clef>/g))
    if (Number(/number="(\d+)"/.exec(attrs)?.[1] ?? '1') === staffNumber)
      return inner(clef, 'sign')?.trim()
  return undefined
}

const flag = (xml: string, tag: string): boolean =>
  new RegExp(`<${tag}(?:\\s[^>]*)?/>|<${tag}(?:\\s[^>]*)?>`).test(xml)

interface PartInfo {
  readonly id: string
  readonly name: string
  /** General MIDI program, zero-based, where the part list gives one. */
  readonly program?: number
}

/** `<part-list>`: the names and instruments the score declares. */
function readPartList(text: string): PartInfo[] {
  const list = inner(text, 'part-list') ?? ''
  return [...list.matchAll(/<score-part\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/score-part>/g)].map(
    ([, id = '', body = '']) => {
      const program = num(body, 'midi-program')
      return {
        id,
        name: (inner(body, 'part-name') ?? '').replace(/<[^>]*>/g, '').trim(),
        ...(program !== undefined ? { program: program - 1 } : {}),
      }
    },
  )
}

const KEYBOARD_NAME = /piano|keyboard|klavier|clavier|harpsichord|organ|celest|rhodes|synth/i

/** The parts under the player's fingers. */
interface Piano {
  readonly parts: ReadonlySet<string>
  /** The hand a part is, where the score gives each hand a part of its own. */
  readonly hands: ReadonlyMap<string, Hand>
}

/**
 * Which part is the piano.
 *
 * The one the part list calls a piano or a keyboard, else the one it gives a
 * keyboard program, else the one written on two staves, else the first. The
 * others are the rest of the room: heard, and not put under the fingers.
 *
 * Where several are called a piano, the one on two staves is it. A one-staff
 * part beside it is a line of ornaments or an ossia, and taking that for the
 * piano because it came first left the real one as accompaniment: eight notes
 * to play in a piece of eighteen hundred.
 *
 * And a piano is sometimes written as two parts of one staff each, treble then
 * bass, by a program that was given a staff per hand. Those two are one piano,
 * the first its right hand and the second its left. Read as a piano and its
 * accompaniment, the left hand was heard and never asked for. Only two
 * keyboards in those two clefs are joined this way; any other pair of
 * one-staff parts is still two instruments.
 */
function choosePiano(
  parts: readonly PartInfo[],
  staves: ReadonlyMap<string, number>,
  clefs: ReadonlyMap<string, string>,
): Piano | null {
  if (parts.length === 0) return null
  const only = (id: string): Piano => ({ parts: new Set([id]), hands: new Map() })
  const grand = (part: PartInfo) => (staves.get(part.id) ?? 1) >= 2

  const named = parts.filter((part) => KEYBOARD_NAME.test(part.name))
  const keyboards =
    named.length > 0
      ? named
      : parts.filter((part) => part.program !== undefined && part.program <= 23)
  if (keyboards.length === 0) return only((parts.find(grand) ?? parts[0]!).id)

  const onTwoStaves = keyboards.find(grand)
  if (onTwoStaves) return only(onTwoStaves.id)

  const [upper, lower] = keyboards
  if (
    keyboards.length === 2 &&
    upper &&
    lower &&
    clefs.get(upper.id) === 'G' &&
    clefs.get(lower.id) === 'F'
  ) {
    return {
      parts: new Set([upper.id, lower.id]),
      hands: new Map<string, Hand>([
        [upper.id, 'right'],
        [lower.id, 'left'],
      ]),
    }
  }
  return only(keyboards[0]!.id)
}

/**
 * The repeat signs and ending brackets on one bar.
 *
 * They live on its bar lines: a repeat that begins or ends there, and a
 * bracket that opens or closes. A bracket can run over several bars, so a bar
 * only says where one starts and stops, and the reader keeps count between.
 */
function readBarlines(measure: string) {
  let start = false
  let times: number | undefined
  let endingStart: number[] | undefined
  let endingStop = false
  for (const [, barline = ''] of measure.matchAll(/<barline\b[^>]*>([\s\S]*?)<\/barline>/g)) {
    const repeat = /<repeat\b([^>]*)/.exec(barline)?.[1]
    if (repeat !== undefined) {
      if (/direction="forward"/.test(repeat)) start = true
      // A plain end sign means twice through; a number on it means that many.
      if (/direction="backward"/.test(repeat))
        times = Math.max(2, Number(/times="(\d+)"/.exec(repeat)?.[1] ?? 2) || 2)
    }
    const ending = /<ending\b([^>]*)/.exec(barline)?.[1]
    if (ending !== undefined) {
      const numbers = (/number="([^"]*)"/.exec(ending)?.[1] ?? '')
        .split(/[^0-9]+/)
        .filter(Boolean)
        .map(Number)
      if (/type="start"/.test(ending) && numbers.length > 0) endingStart = numbers
      if (/type="(stop|discontinue)"/.test(ending)) endingStop = true
    }
  }
  return { start, times, endingStart, endingStop }
}

interface Parsed extends SongNote {
  readonly startQ: number
  readonly durationQ: number
}

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

  let fifths: number | null = null
  let mode: 'major' | 'minor' | null = null
  /** Tempo marks, in crotchets from the start, from whichever part carried them. */
  const tempos: { atQ: number; bpm: number }[] = []
  /** Each bar's length and metre, longest of any part that has it. */
  const bars: { durationQ: number; beats: number; beatType: number }[] = []
  /** The rests the piano's staves write, for the page. */
  const rests: SongRest[] = []
  /** The repeat signs and ending brackets on each bar, from whichever part wrote them. */
  const signs: {
    start?: boolean
    times?: number
    /** An ending bracket opens on this bar, for these passes… */
    opens?: number[]
    /** …and one closes on it. */
    closes?: boolean
    ending?: readonly number[]
  }[] = []
  const notes: Parsed[] = []
  /*
   * What each instrument's score says about loudness, and the notes it says
   * it to. Gathered as the parts are read and applied once they all have been:
   * a marking governs by when it falls in the music, not where it falls in the
   * file, and a piano written as a part a hand is one instrument with one set
   * of markings.
   */
  const dynamics = new Map<
    string,
    { events: DynamicEvent[]; notes: { index: number; line?: DynamicLine }[] }
  >()
  const pedalsQ: { fromQ: number; toQ: number }[] = []
  const chordsQ: { startQ: number; text: string }[] = []
  /** The clefs the piano's staves are put in, in the order the file says so. */
  const clefsQ: { hand: Hand; staff?: number; startQ: number; clef: 'treble' | 'bass' }[] = []
  /** How many staves the piano is written on, where that is more than two. */
  let pianoStaves: number | undefined
  let leadNamesStaves = false
  let tupletCounter = 0

  for (const part of parts) {
    let divisions = 1
    let beats = 4
    let beatType = 4
    let measureStartQ = 0
    let pedalFromQ: number | null = null
    /** Hairpins that have opened and not yet closed, by the number the file gives them. */
    const wedges = new Map<string, { fromQ: number; direction: 'louder' | 'softer' }>()
    /** Open tied notes, so the continuation extends rather than restrikes. */
    const tied = new Map<string, Parsed>()
    /** The tuplet each voice is inside, if any. */
    const tuplets = new Map<string, { id: number; actual: number; normal: number }>()
    const role: PartRole = piano?.parts.has(part.id) ? 'keyboard' : 'accompaniment'
    /** The hand this whole part is, when the piano is written as a part a hand. */
    const partHand = piano?.hands.get(part.id)
    /*
     * A piano on three staves or four.
     *
     * Music too thick for two staves is given more: a staff for what a hand
     * holds and another for what it moves. Each note is then kept on the staff
     * the score put it on, and the hand is read from which staff that is — the
     * upper half the right hand's, the lower the left's. With an odd number
     * the middle staff could be either, and goes by the clef it opens in.
     */
    const staffCount = role === 'keyboard' && !partHand ? (stavesOf.get(part.id) ?? 1) : 1
    const manyStaves = staffCount > 2 ? staffCount : 0
    if (manyStaves) pianoStaves = manyStaves
    const rightStaves =
      manyStaves % 2 === 0
        ? manyStaves / 2
        : openingClef(part.body, (manyStaves + 1) / 2) === 'F'
          ? (manyStaves - 1) / 2
          : (manyStaves + 1) / 2
    /** The hand a staff of this part belongs to. */
    const handOn = (staffNumber: number | undefined): Hand | undefined =>
      partHand ??
      (manyStaves && staffNumber !== undefined
        ? staffNumber <= rightStaves
          ? 'right'
          : 'left'
        : staffNumber === 2
          ? 'left'
          : staffNumber === 1
            ? 'right'
            : undefined)
    /** The staff each voice is at home on, where the part's voices say. */
    const homes = staffCount >= 2 ? voiceHomes(part.body, staffCount) : null
    /*
     * The number a voice is kept under. The file's own, where its voices are
     * lines of music: a line that goes from one staff to the other is then the
     * same voice on both, and the page can beam it as one. Where the numbers
     * name nothing — the same one for a line on each staff — each staff's are
     * set apart, so that two lines are never taken for one that crosses.
     */
    const voiceOn = (voice: string, staff: number | undefined): number =>
      (Number(voice) || 1) + (staffCount >= 2 && !homes && staff ? (staff - 1) * 100 : 0)
    /** Where this part's notes begin, and those written on the other hand's staff. */
    const firstNote = notes.length
    const visiting: number[] = []
    const loudnessOf = partHand ? 'piano' : part.id
    const loudness = dynamics.get(loudnessOf) ?? { events: [], notes: [] }
    dynamics.set(loudnessOf, loudness)

    const measures = [...part.body.matchAll(/<measure\b[^>]*>([\s\S]*?)<\/measure>/g)]
    for (const [index, [, body = '']] of measures.entries()) {
      const barlines = readBarlines(body)
      const sign = (signs[index] ??= {})
      if (barlines.start) sign.start = true
      if (barlines.times) sign.times = barlines.times
      if (barlines.endingStart) sign.opens = barlines.endingStart
      if (barlines.endingStop) sign.closes = true

      let cursor = 0
      let previousStart = 0
      let longest = 0

      const blocks = body.matchAll(
        /<(note|backup|forward|attributes|direction|sound|harmony)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/g,
      )

      for (const block of blocks) {
        const tag = block[1]!
        const attributes = block[2] ?? ''
        const content = block[3] ?? ''

        if (tag === 'attributes') {
          // Notation always states its key. Nothing has to be guessed here —
          // except the mode, which the format leaves optional.
          const declared = num(content, 'fifths')
          if (declared !== undefined && fifths === null) {
            fifths = declared
            const written = inner(content, 'mode')?.trim().toLowerCase()
            mode = written === 'minor' ? 'minor' : written === 'major' ? 'major' : null
          }
          divisions = num(content, 'divisions') ?? divisions
          // The clef a staff is read in from here on. A G or an F clef, which
          // is what a piano is written in; any other is left as it was.
          if (role === 'keyboard')
            for (const [, attrs = '', clef = ''] of content.matchAll(
              /<clef\b([^>]*)>([\s\S]*?)<\/clef>/g,
            )) {
              const sign = inner(clef, 'sign')?.trim()
              const kind = sign === 'G' ? 'treble' : sign === 'F' ? 'bass' : null
              if (!kind) continue
              const staffNumber = Number(/number="(\d+)"/.exec(attrs)?.[1] ?? '1')
              const hand: Hand = handOn(staffNumber) ?? 'right'
              const startQ = measureStartQ + cursor / divisions
              if (manyStaves) {
                // Each staff says its own clef, the one it opens in included:
                // nothing about a third staff's clef can be assumed.
                const last = clefsQ.findLast((entry) => entry.staff === staffNumber)
                if (last?.clef !== kind)
                  clefsQ.push({ hand, staff: staffNumber, startQ, clef: kind })
                continue
              }
              const last = clefsQ.findLast((entry) => entry.hand === hand)
              if ((last?.clef ?? (hand === 'right' ? 'treble' : 'bass')) !== kind)
                clefsQ.push({ hand, startQ, clef: kind })
            }
          const newBeats = num(content, 'beats')
          const newBeatType = num(content, 'beat-type')
          if (newBeats && newBeatType) {
            beats = newBeats
            beatType = newBeatType
          }
          continue
        }

        if (tag === 'harmony') {
          const step = inner(content, 'root-step')?.trim()
          if (step && LETTER_INDEX[step] !== undefined) {
            const alter = Math.max(-2, Math.min(2, Math.round(num(content, 'root-alter') ?? 0)))
            const kind = inner(content, 'kind')?.trim() ?? 'major'
            const kindText = /text="([^"]*)"/.exec(content)?.[1]
            const bassStep = inner(content, 'bass-step')?.trim()
            const bassAlter = Math.max(-2, Math.min(2, Math.round(num(content, 'bass-alter') ?? 0)))
            const root = spellingName({
              letter: LETTER_INDEX[step]!,
              accidental: alter as Accidental,
            })
            const suffix = kindText ?? KIND_SUFFIX[kind] ?? ''
            const bass =
              bassStep && LETTER_INDEX[bassStep] !== undefined
                ? `/${spellingName({ letter: LETTER_INDEX[bassStep]!, accidental: bassAlter as Accidental })}`
                : ''
            chordsQ.push({
              startQ: measureStartQ + cursor / divisions,
              text: `${root}${suffix}${bass}`,
            })
          }
          continue
        }

        if (tag === 'direction' || tag === 'sound') {
          // Where it stands in the music, and on which staff — or, for a
          // piano written as a part a hand, in which hand.
          const atQ = measureStartQ + (cursor + (num(content, 'offset') ?? 0)) / divisions
          const line: DynamicLine | undefined = partHand ? part.id : num(content, 'staff')
          const on = line === undefined ? {} : { line }

          // <dynamics><mf/> — the marking is the element name, not its text,
          // except for one an edition made up, which is spelled out.
          const marked = /<dynamics(?:\s[^>]*)?>([\s\S]*?)<\/dynamics>/.exec(content)?.[1] ?? ''
          for (const [, name = '', text = ''] of marked.matchAll(
            /<([a-z-]+)(?:\s[^>]*)?(?:\/>|>([^<]*)<\/\1>)/g,
          )) {
            const marking = name === 'other-dynamics' ? text.trim() : name
            const swell = swellOfWords(marking)
            if (swell) loudness.events.push({ kind: 'swell', fromQ: atQ, direction: swell, ...on })
            else loudness.events.push(...dynamicEvents(marking, atQ, line))
          }

          // A hairpin is a spanner, like the pedal: it opens here and closes
          // in a later direction.
          for (const [, wedge = ''] of content.matchAll(/<wedge\b([^>]*)>/g)) {
            const type = /type="([a-z]+)"/.exec(wedge)?.[1]
            const number = /number="(\d+)"/.exec(wedge)?.[1] ?? '1'
            if (type === 'crescendo' || type === 'diminuendo') {
              wedges.set(number, {
                fromQ: atQ,
                direction: type === 'crescendo' ? 'louder' : 'softer',
              })
            } else if (type === 'stop') {
              const open = wedges.get(number)
              wedges.delete(number)
              if (open && atQ > open.fromQ)
                loudness.events.push({ kind: 'swell', ...open, toQ: atQ, ...on })
            }
          }

          // The same thing written as a word: cresc., dim.
          for (const [, words = ''] of content.matchAll(/<words\b[^>]*>([^<]*)<\/words>/g)) {
            const swell = swellOfWords(words)
            if (swell) loudness.events.push({ kind: 'swell', fromQ: atQ, direction: swell, ...on })
          }

          // Pedal is a spanner: one direction starts it, another stops it.
          const pedalType = /<pedal\b[^>]*type="([a-z]+)"/.exec(content)?.[1]
          if (pedalType && role === 'keyboard') {
            const at = measureStartQ + cursor / divisions
            if (pedalType === 'start' && pedalFromQ === null) pedalFromQ = at
            else if ((pedalType === 'stop' || pedalType === 'discontinue') && pedalFromQ !== null) {
              pedalsQ.push({ fromQ: pedalFromQ, toQ: at })
              pedalFromQ = null
            }
          }

          // `<sound tempo>` is always in crotchets. A `<metronome>` mark is in
          // whatever note it names, and has to be converted.
          const sound = Number(/tempo="([\d.]+)"/.exec(attributes + content)?.[1] ?? '')
          let bpm = sound > 0 ? sound : 0
          if (!bpm) {
            const perMinute = num(content, 'per-minute')
            const unit = inner(content, 'beat-unit')?.trim()
            if (perMinute && perMinute > 0) {
              const unitValue = unit ? TYPE_VALUES[unit] : undefined
              const dots = (content.match(/<beat-unit-dot\s*\/>/g) ?? []).length
              bpm = perMinute * (unitValue ? valueQuarters(unitValue, dots) : 1)
            }
          }
          if (bpm > 0) tempos.push({ atQ: measureStartQ + cursor / divisions, bpm })
          continue
        }

        if (tag === 'backup') {
          cursor = Math.max(0, cursor - (num(content, 'duration') ?? 0))
          continue
        }
        if (tag === 'forward') {
          cursor += num(content, 'duration') ?? 0
          continue
        }

        // A note.
        const duration = num(content, 'duration') ?? 0
        const isChord = flag(content, 'chord')
        const isGrace = flag(content, 'grace')
        const start = isChord ? previousStart : cursor
        const voice = inner(content, 'voice')?.trim() ?? '1'

        if (flag(content, 'rest')) {
          // Written down for the page: a rest is not played, but it is what
          // shows a hand waiting. Only the piano's, and only the ones printed.
          if (role === 'keyboard' && !isGrace && !/<note\b[^>]*print-object="no"/.test(content)) {
            const restType = inner(content, 'type')?.trim()
            const onStaff = num(content, 'staff')
            const barQ = (beats * 4) / beatType
            rests.push({
              startQ: measureStartQ + start / divisions,
              startMs: 0,
              durationQ: duration / divisions,
              hand: handOn(onStaff) ?? 'right',
              ...(manyStaves ? { staff: onStaff ?? 1 } : {}),
              voice: voiceOn(voice, onStaff),
              ...(restType
                ? {
                    written: {
                      value: TYPE_VALUES[restType] ?? 'quarter',
                      dots: (content.match(/<dot\s*\/>/g) ?? []).length,
                    },
                  }
                : {}),
              // Marked as the bar's, or given no length of its own and the
              // bar's whole duration, which is how most programs write one.
              ...(/<rest\b[^>]*measure="yes"/.test(content) ||
              (!restType && duration / divisions >= barQ - 1e-6)
                ? { wholeBar: true }
                : {}),
            })
          }
          cursor = start + duration
          longest = Math.max(longest, cursor)
          continue
        }

        // Notation writes drums as <unpitched>: a line on the staff, not a pitch.
        const unpitched = inner(content, 'unpitched')
        const pitch = inner(content, 'pitch') ?? unpitched
        if (!pitch) {
          if (!isChord) cursor = start + duration
          continue
        }

        const step = (inner(pitch, 'step') ?? inner(pitch, 'display-step'))?.trim() ?? 'C'
        const alter = Math.max(-2, Math.min(2, Math.round(num(pitch, 'alter') ?? 0))) as Accidental
        const octave = num(pitch, 'octave') ?? num(pitch, 'display-octave') ?? 4
        const midi = (octave + 1) * 12 + (STEP_SEMITONES[step] ?? 0) + alter
        const spelling: Spelling = { letter: LETTER_INDEX[step] ?? 0, accidental: alter }

        const staff = num(content, 'staff')
        if (role === 'keyboard' && (staff !== undefined || partHand)) leadNamesStaves = true
        // Whose note it is: its voice's hand, which is its staff's unless the
        // voice is written on the other staff here.
        const home = staff === undefined ? undefined : (homes?.get(voice) ?? staff)
        const hand: Hand = handOn(home) ?? inferHand(midi)
        const away = home !== staff && handOn(staff) !== hand

        const startQ = isGrace
          ? Math.max(0, measureStartQ + start / divisions - GRACE_Q)
          : measureStartQ + start / divisions
        const durationQ = isGrace ? GRACE_Q : Math.max(0.0625, duration / divisions)

        // The written value, tuplet included. A tuplet's notes carry their
        // ratio individually; the bracket over them is one thing, so every
        // note between a `start` and a `stop` shares an id.
        const typeName = inner(content, 'type')?.trim()
        const actual = num(content, 'actual-notes')
        const normal = num(content, 'normal-notes')
        const tupletKey = `${voice}`
        if (
          /<tuplet\b[^>]*type="start"/.test(content) ||
          (actual && normal && !tuplets.has(tupletKey))
        ) {
          if (actual && normal) tuplets.set(tupletKey, { id: ++tupletCounter, actual, normal })
        }
        const tuplet = actual && normal ? tuplets.get(tupletKey) : undefined
        const written: WrittenNote | undefined = typeName
          ? {
              value: TYPE_VALUES[typeName] ?? 'quarter',
              dots: (content.match(/<dot\s*\/>/g) ?? []).length,
              ...(tuplet ? { tuplet } : {}),
            }
          : undefined
        if (/<tuplet\b[^>]*type="stop"/.test(content) || !(actual && normal))
          tuplets.delete(tupletKey)

        const tieKey = `${staff ?? 0}:${voice}:${midi}`
        if (/<tie[^>]*type="stop"/.test(content)) {
          // The note this one is tied from. In its own voice, as a rule — but
          // a suspension is often held in one voice and written again in
          // another, and a tie joins a pitch to itself whatever line of the
          // counterpoint each end is in. So failing its own voice, the held
          // note of this pitch that ends where this one begins.
          const heldKey = tied.has(tieKey)
            ? tieKey
            : [...tied].find(
                ([, open]) =>
                  open.note === midi && Math.abs(open.startQ + open.durationQ - startQ) < 1e-3,
              )?.[0]
          const held = heldKey === undefined ? undefined : tied.get(heldKey)
          if (held && heldKey !== undefined) {
            // Replace the held note with a longer one rather than adding a second.
            const index = notes.lastIndexOf(held)
            if (index >= 0) {
              const extended: Parsed = {
                ...held,
                durationQ: startQ + durationQ - held.startQ,
                // One sound, written twice: the second notehead is kept for
                // the page, with the tie that joins it to the first.
                tied: [
                  ...(held.tied ?? []),
                  { startQ, startMs: 0, ...(written ? { written } : {}) },
                ],
              }
              notes[index] = extended
              tied.delete(heldKey)
              if (/<tie[^>]*type="start"/.test(content)) tied.set(tieKey, extended)
            }
            if (!isChord && !isGrace) {
              previousStart = start
              cursor = start + duration
              longest = Math.max(longest, cursor)
            }
            continue
          }
        }

        // <notations><technical><fingering> — the one place a file can tell us
        // which finger to use. Worth reading precisely because it cannot be
        // recovered from anywhere else.
        const fingerText = inner(content, 'fingering')?.trim()
        const finger = fingerText && /^[1-5]$/.test(fingerText) ? Number(fingerText) : undefined

        const note: Parsed = {
          note: midi,
          // Until the whole score has been read: see where `dynamics` is applied.
          velocity: DEFAULT_VELOCITY,
          startMs: 0,
          durationMs: 0,
          startQ,
          durationQ,
          hand,
          // The staff it is written on, where that is not simply its hand's.
          ...(manyStaves ? { staff: staff ?? 1 } : away && staff !== undefined ? { staff } : {}),
          role: unpitched ? 'percussion' : role,
          spelling,
          voice: voiceOn(voice, staff),
          ...(written ? { written } : {}),
          ...(isGrace ? { grace: true } : {}),
          ...(finger ? { finger } : {}),
        }
        notes.push(note)
        if (away) visiting.push(notes.length - 1)
        const line: DynamicLine | undefined = partHand ? part.id : staff
        loudness.notes.push({ index: notes.length - 1, ...(line === undefined ? {} : { line }) })
        if (/<tie[^>]*type="start"/.test(content)) tied.set(tieKey, note)

        if (!isChord && !isGrace) {
          previousStart = start
          cursor = start + duration
        }
        if (!isGrace) longest = Math.max(longest, start + duration)
      }

      // A bar is as long as its longest voice says, and a pickup bar is as
      // short as its content. Other parts may disagree by a rest they left
      // out; the longest reading wins so nothing is cut off.
      const durationQ = longest / divisions
      const known = bars[index]
      bars[index] = {
        durationQ: Math.max(known?.durationQ ?? 0, durationQ),
        beats,
        beatType,
      }
      measureStartQ += durationQ
    }

    /*
     * A line written across both staves is one of two things. A hand that has
     * gone onto the other staff and kept playing: the other hand is busy with
     * music of its own, and these notes are still the first hand's. Or a run
     * shared out between the hands, each taking what is on its own staff: then
     * the other hand has nothing else to do just there, and the notes on its
     * staff are for it. The file writes both the same way, so the other hand
     * is asked: a note on its staff while it is playing something of its own
     * stays with its voice, and one that finds it free goes to it.
     */
    if (visiting.length > 0) {
      const playing: Record<Hand, [number, number][]> = { left: [], right: [] }
      for (let at = firstNote; at < notes.length; at++) {
        const each = notes[at]!
        if (each.role === 'keyboard')
          playing[each.hand].push([each.startQ, each.startQ + each.durationQ])
      }
      for (const at of visiting) {
        const visitor = notes[at]!
        const host: Hand = visitor.hand === 'left' ? 'right' : 'left'
        const busy = playing[host].some(
          ([from, to]) => from <= visitor.startQ + 1e-6 && to > visitor.startQ + 1e-6,
        )
        if (busy) continue
        // On its own staff after all: in a score on two staves there is
        // nothing left to say about where it is written.
        const { staff: _written, ...plain } = visitor
        notes[at] = manyStaves ? { ...visitor, hand: host } : { ...plain, hand: host }
      }
    }
  }

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
      ? { clefs: clefsQ.map((clef) => ({ ...clef, startMs: toMs(clef.startQ) })) }
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
