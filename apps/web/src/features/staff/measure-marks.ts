import {
  barIndexAt,
  writtenValue,
  type Song,
  type SongNote,
  type SongStep,
  type Staff,
} from '@motius/shared'
import {
  rowIn,
  staffNumberOf,
  type RestMark,
  type ScoreLayer,
  type ScoreSource,
} from './score-model'

/**
 * What measuring gathers from the whole score before it spaces a single
 * chord: the places something is written, the voices of each bar, where each
 * tied note is written again, and the rests.
 */

/** What measuring knows about a score, asked of every chord in it. */
export interface Measuring {
  readonly song: ScoreSource | null
  /** The places measured, with only this pair's notes where the score has several. */
  readonly steps: readonly SongStep[]
  readonly layer?: ScoreLayer
  /** How many staves the piano is written on. */
  readonly staves: number
  /** The bars the file laid out. Absent only for a song stored before they were read. */
  readonly measures?: Song['measures']
  /** One bar length for the whole piece, which is what spacing needs and bar lines do not. */
  readonly measureMs: number
  readonly beat: number
  readonly fifths: number
  /** The staff of this pair a note is written on. */
  readonly rowOf: (note: SongNote) => Staff
  /** The staff a note keeps busy, for the rests. */
  readonly busies: (note: SongNote) => Staff
  /** Which bar a chord falls in. */
  readonly barOf: (step: SongStep) => number
}

/** A place on the page where something is written: a chord, and which of the song's it is. */
interface Column {
  readonly step: SongStep
  readonly index: number
}

/** How near two moments are and still the same place on the page, in milliseconds. */
const SAME_MOMENT = 30

/** The chord struck at a moment, by its place in the list, or -1 where none is. */
function nearestStep(steps: readonly SongStep[], ms: number): number {
  let low = 0
  let high = steps.length - 1
  while (low < high) {
    const middle = (low + high + 1) >> 1
    if (steps[middle]!.startMs <= ms + SAME_MOMENT) low = middle
    else high = middle - 1
  }
  return steps[low] && Math.abs(steps[low]!.startMs - ms) <= SAME_MOMENT ? low : -1
}

/**
 * The places of a score: its chords, and the moments between them where a
 * tied note is written again and nothing is struck.
 *
 * A note tied over a bar line has a notehead in the new bar. Where a chord is
 * struck at that moment the head is drawn with it. Where none is — the other
 * hand is resting, or the piece is ending on a chord held through its last
 * bar — there was nowhere to draw it: the head was left out, and a final bar
 * of nothing but tied notes was left off the page altogether. Such a moment
 * is a place of its own, with held noteheads and no chord.
 *
 * Null where every place is a chord, which is most music.
 */
export function columnsOf(steps: readonly SongStep[]): readonly Column[] | null {
  const struck = (ms: number): boolean => nearestStep(steps, ms) >= 0
  const moments: number[] = []
  for (const step of steps)
    for (const note of step.notes)
      for (const segment of note.tied ?? [])
        if (segment.startMs > note.startMs && !struck(segment.startMs))
          moments.push(segment.startMs)
  if (moments.length === 0) return null
  moments.sort((a, b) => a - b)
  const distinct = moments.filter((ms, at) => at === 0 || ms - moments[at - 1]! > SAME_MOMENT)

  const columns: Column[] = []
  let next = 0
  for (const [index, step] of steps.entries()) {
    columns.push({ step, index })
    const until = steps[index + 1]?.startMs ?? Infinity
    const between: number[] = []
    while (next < distinct.length && distinct[next]! < until) between.push(distinct[next++]!)
    for (const [at, startMs] of between.entries())
      columns.push({
        step: { notes: [], startMs },
        index: index + (at + 1) / (between.length + 1),
      })
  }
  return columns
}

/** The voices each staff carries, by `bar:staff`, in order. */
export type BarVoices = Map<string, number[]>

/** Count a note's voice among those its staff carries in a bar. */
function addVoice(voices: BarVoices, m: Measuring, bar: number, note: SongNote) {
  if (note.voice === undefined) return
  const key = `${bar}:${m.rowOf(note)}`
  const seen = voices.get(key) ?? []
  if (!seen.includes(note.voice))
    voices.set(
      key,
      [...seen, note.voice].sort((a, b) => a - b),
    )
}

/*
 * The voices each staff carries, bar by bar.
 *
 * A bar is the unit: where a staff has two voices anywhere in a bar, the
 * upper has its stems up and the lower down for the whole of it, including
 * the moments only one of them is sounding. Decided chord by chord instead,
 * a line's stems would flip every time the other line rested.
 */
export function voicesOf(m: Measuring, helds: TiedNotes['heldAt']): BarVoices {
  const voices: BarVoices = new Map()
  for (const step of m.steps) {
    const bar = m.barOf(step)
    for (const note of step.notes) addVoice(voices, m, bar, note)
  }
  // A held note is in its voice as much as a struck one is.
  for (const [at, held] of helds) {
    const bar = m.barOf(m.steps[at]!)
    for (const { note } of held) addVoice(voices, m, bar, note)
  }
  return voices
}

/** Where each tied note is written again, and where each tie leaves from. */
export interface TiedNotes {
  /** The notes written at a place and held from before, by the place. */
  readonly heldAt: Map<number, { note: SongNote; fromIndex: number }[]>
  /** The ties leaving a place: which note, and the place each goes to. */
  readonly tiedOut: Map<number, { note: number; toIndex: number }[]>
}

/*
 * Tied notes: where each is written again.
 *
 * A tied note is struck once and written twice or more, and the later
 * noteheads stand at later moments — where, almost always, something else is
 * being struck, in the other hand or the other voice. So each is given to
 * the chord at its own moment, to be drawn with it, with a note of which
 * chord its tie comes from.
 *
 * One that falls where nothing at all is struck has a place of its own to be
 * drawn at (`columnsOf`), which is a chord of held noteheads and nothing else.
 */
export function tiesOf(steps: readonly SongStep[]): TiedNotes {
  const heldAt: TiedNotes['heldAt'] = new Map()
  const tiedOut: TiedNotes['tiedOut'] = new Map()
  for (const [index, step] of steps.entries())
    for (const note of step.notes) {
      let from = index
      for (const segment of note.tied ?? []) {
        const at = nearestStep(steps, segment.startMs)
        if (at <= from) continue
        const held: SongNote = {
          ...note,
          written: segment.written,
          finger: undefined,
          rolled: undefined,
          tied: undefined,
        }
        heldAt.set(at, [...(heldAt.get(at) ?? []), { note: held, fromIndex: from }])
        tiedOut.set(from, [...(tiedOut.get(from) ?? []), { note: note.note, toIndex: at }])
        from = at
      }
    }
  return { heldAt, tiedOut }
}

/** The rests a score's chords are written with. */
export interface ScoreRests {
  /** The rests at a chord's own moment, by the chord. */
  readonly restsBy: Map<number, RestMark[]>
  /** The rests waiting in the room before a chord, by the moment each begins. */
  readonly leadsBy: Map<number, { at: number; mark: Omit<RestMark, 'back'> }[]>
  /** The staves resting for the whole of a bar, by the bar's number. */
  readonly barRests: Map<number, Staff[]>
}

/*
 * Rests: where a hand is waiting.
 *
 * Not every rest the score writes. A staff with two voices rests one of them
 * while the other plays, and those are bookkeeping: the hand is busy. What a
 * player needs to see is the hand with nothing to do, so a rest is kept only
 * where no note of its hand is sounding — and, where both voices of a staff
 * rest at once, once.
 *
 * A rest for a whole bar goes in the middle of its bar. Any other stands at
 * its own moment: with the chord struck then, which will be the other
 * hand's, or in the room before the next chord where nothing is struck.
 */
export function restsOf(m: Measuring): ScoreRests {
  const { song, steps, measures, layer } = m
  const restsBy: ScoreRests['restsBy'] = new Map()
  const leadsBy: ScoreRests['leadsBy'] = new Map()
  const barRests: ScoreRests['barRests'] = new Map()
  if (!song?.rests?.length || !measures) return { restsBy, leadsBy, barRests }

  const sounding = { treble: [] as [number, number][], bass: [] as [number, number][] }
  const filled = new Set<string>()
  for (const step of steps)
    for (const note of step.notes) {
      const staff = m.busies(note)
      sounding[staff].push([note.startMs, note.startMs + note.durationMs])
      // Every bar the note sounds in, not only the one it starts in.
      const last = barIndexAt(measures, note.startMs + note.durationMs - 1)
      for (let at = barIndexAt(measures, note.startMs); at <= last; at++)
        filled.add(`${measures[at]!.number}:${staff}`)
    }
  const seen = new Set<string>()
  for (const rest of [...song.rests].sort((a, b) => b.durationQ - a.durationQ)) {
    const staff: Staff | null = layer
      ? rowIn(layer, staffNumberOf(rest, m.staves))
      : rest.hand === 'left'
        ? 'bass'
        : 'treble'
    // Another pair's rest.
    if (!staff) continue
    const measure = measures[barIndexAt(measures, rest.startMs)]!
    const endMs = rest.startMs + rest.durationQ * measure.quarterMs
    const whole =
      rest.wholeBar ||
      (Math.abs(rest.startQ - measure.startQ) < 1e-6 && rest.durationQ >= measure.durationQ - 1e-6)
    if (whole) {
      if (
        !filled.has(`${measure.number}:${staff}`) &&
        !barRests.get(measure.number)?.includes(staff)
      )
        barRests.set(measure.number, [...(barRests.get(measure.number) ?? []), staff])
      continue
    }
    if (sounding[staff].some(([from, to]) => from < endMs - 1 && to > rest.startMs + 1)) continue
    const key = `${staff}:${Math.round(rest.startMs)}`
    if (seen.has(key)) continue
    seen.add(key)

    const shape = rest.written ?? writtenValue(endMs - rest.startMs, measure.quarterMs)
    const mark = { staff, value: shape.value, dots: shape.dots, bar: measure.number }
    const at = nearestStep(steps, rest.startMs)
    if (at >= 0) restsBy.set(at, [...(restsBy.get(at) ?? []), { ...mark, back: 0 }])
    else {
      // The next chord after it: the rest stands in the room before that.
      const next = steps.findIndex((step) => step.startMs > rest.startMs)
      if (next >= 0) leadsBy.set(next, [...(leadsBy.get(next) ?? []), { at: rest.startMs, mark }])
    }
  }
  return { restsBy, leadsBy, barRests }
}
