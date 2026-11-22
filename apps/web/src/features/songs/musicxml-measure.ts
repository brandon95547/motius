import {
  dynamicEvents,
  spellingName,
  swellOfWords,
  valueQuarters,
  type Accidental,
  type DynamicLine,
  type Hand,
} from '@motius/shared'
import { inner, KIND_SUFFIX, LETTER_INDEX, num, TYPE_VALUES } from './musicxml-scan'
import type { MeasureCursor, PartReading, ScoreReading } from './musicxml-reading'
import { readNote } from './musicxml-notes'

/**
 * One bar of a part, read in document order: its bar lines, then each of its
 * notes, rewinds, key and clef changes, chord symbols and directions.
 */

/**
 * Read a part's bar: what it adds to the score, and how long it is.
 *
 * `index` is the bar's place in the part, which every part counts the same.
 */
export function readMeasure(score: ScoreReading, part: PartReading, index: number, body: string) {
  const barlines = readBarlines(body)
  const sign = (score.signs[index] ??= {})
  if (barlines.start) sign.start = true
  if (barlines.times) sign.times = barlines.times
  if (barlines.endingStart) sign.opens = barlines.endingStart
  if (barlines.endingStop) sign.closes = true

  const at: MeasureCursor = { cursor: 0, previousStart: 0, longest: 0 }

  const blocks = body.matchAll(
    /<(note|backup|forward|attributes|direction|sound|harmony)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/g,
  )

  for (const block of blocks) {
    const tag = block[1]!
    const attributes = block[2] ?? ''
    const content = block[3] ?? ''

    if (tag === 'attributes') readAttributes(score, part, at, content)
    else if (tag === 'harmony') readHarmony(score, part, at, content)
    else if (tag === 'direction' || tag === 'sound')
      readDirection(score, part, at, attributes, content)
    else if (tag === 'backup') at.cursor = Math.max(0, at.cursor - (num(content, 'duration') ?? 0))
    else if (tag === 'forward') at.cursor += num(content, 'duration') ?? 0
    else readNote(score, part, at, content)
  }

  // A bar is as long as its longest voice says, and a pickup bar is as
  // short as its content. Other parts may disagree by a rest they left
  // out; the longest reading wins so nothing is cut off.
  const durationQ = at.longest / part.divisions
  const known = score.bars[index]
  score.bars[index] = {
    durationQ: Math.max(known?.durationQ ?? 0, durationQ),
    beats: part.beats,
    beatType: part.beatType,
  }
  part.measureStartQ += durationQ
}

/** Where the cursor stands in the music, in crotchets from the start. */
const nowQ = (part: PartReading, at: MeasureCursor) =>
  part.measureStartQ + at.cursor / part.divisions

/** `<attributes>`: the key, the divisions a crotchet is counted in, the clefs and the metre. */
function readAttributes(
  score: ScoreReading,
  part: PartReading,
  at: MeasureCursor,
  content: string,
) {
  // Notation always states its key. Nothing has to be guessed here —
  // except the mode, which the format leaves optional.
  const declared = num(content, 'fifths')
  if (declared !== undefined && score.fifths === null) {
    score.fifths = declared
    const written = inner(content, 'mode')?.trim().toLowerCase()
    score.mode = written === 'minor' ? 'minor' : written === 'major' ? 'major' : null
  }
  part.divisions = num(content, 'divisions') ?? part.divisions
  // The clef a staff is read in from here on. A G or an F clef, which
  // is what a piano is written in; any other is left as it was.
  if (part.role === 'keyboard')
    for (const [, attrs = '', clef = ''] of content.matchAll(
      /<clef\b([^>]*)>([\s\S]*?)<\/clef>/g,
    )) {
      const sign = inner(clef, 'sign')?.trim()
      const kind = sign === 'G' ? 'treble' : sign === 'F' ? 'bass' : null
      if (!kind) continue
      const staffNumber = Number(/number="(\d+)"/.exec(attrs)?.[1] ?? '1')
      const hand: Hand = part.handOn(staffNumber) ?? 'right'
      const startQ = nowQ(part, at)
      if (part.manyStaves) {
        // Each staff says its own clef, the one it opens in included:
        // nothing about a third staff's clef can be assumed.
        const on = part.base + staffNumber
        const last = score.clefsQ.findLast((entry) => entry.staff === on)
        if (last?.clef !== kind) score.clefsQ.push({ hand, staff: on, startQ, clef: kind })
        continue
      }
      const last = score.clefsQ.findLast((entry) => entry.hand === hand)
      if ((last?.clef ?? (hand === 'right' ? 'treble' : 'bass')) !== kind)
        score.clefsQ.push({ hand, startQ, clef: kind })
    }
  const newBeats = num(content, 'beats')
  const newBeatType = num(content, 'beat-type')
  if (newBeats && newBeatType) {
    part.beats = newBeats
    part.beatType = newBeatType
  }
}

/** `<harmony>`: a chord symbol, as a lead sheet prints it. */
function readHarmony(score: ScoreReading, part: PartReading, at: MeasureCursor, content: string) {
  const step = inner(content, 'root-step')?.trim()
  if (!step || LETTER_INDEX[step] === undefined) return
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
  score.chordsQ.push({
    startQ: nowQ(part, at),
    text: `${root}${suffix}${bass}`,
  })
}

/**
 * A hand named over the music: "m.d." and "m.g." (or "m.s."), "R.H." and
 * "L.H.", or the words spelled out. Only where it is all the text says, so a
 * tempo that happens to hold the letters is not one.
 */
const RIGHT_MARK =
  /^\(?\s*(?:m\.?\s?d\.?|r\.?\s?h\.?|right hand|main droite|mano destra|rechte hand)\s*\)?$/i
const LEFT_MARK =
  /^\(?\s*(?:m\.?\s?[gs]\.?|l\.?\s?h\.?|left hand|main gauche|mano sinistra|linke hand)\s*\)?$/i

/** `<direction>` and `<sound>`: a hand named, dynamics, hairpins, pedal and tempo. */
function readDirection(
  score: ScoreReading,
  part: PartReading,
  at: MeasureCursor,
  attributes: string,
  content: string,
) {
  const { role, partHand, loudness, wedges } = part
  // Where it stands in the music, and on which staff — or, for a
  // piano written as a part a hand, in which hand.
  const atQ = part.measureStartQ + (at.cursor + (num(content, 'offset') ?? 0)) / part.divisions
  const line: DynamicLine | undefined = partHand ? part.id : num(content, 'staff')
  const on = line === undefined ? {} : { line }

  // A hand named over the music. Not in a part that is a hand already.
  if (role === 'keyboard' && !partHand)
    for (const [, text = ''] of content.matchAll(/<words\b[^>]*>([^<]*)<\/words>/g)) {
      const said = text.trim()
      const hand = RIGHT_MARK.test(said) ? 'right' : LEFT_MARK.test(said) ? 'left' : null
      if (hand) part.handMarks.push({ atQ, hand })
    }

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
    const now = nowQ(part, at)
    if (pedalType === 'start' && part.pedalFromQ === null) part.pedalFromQ = now
    else if ((pedalType === 'stop' || pedalType === 'discontinue') && part.pedalFromQ !== null) {
      score.pedalsQ.push({ fromQ: part.pedalFromQ, toQ: now })
      part.pedalFromQ = null
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
  if (bpm > 0) score.tempos.push({ atQ: nowQ(part, at), bpm })
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
