import { barIndexAt, valueQuarters, type Song } from '@motius/shared'
import { BEAM_LINES, staffOfLine, type BeamLine } from './notation'
import { voiceOn, type Measured } from './score-model'

/**
 * Says which chords share a beam.
 *
 * A beam joins the short notes of one beat: notes with a flag, one straight
 * after another, on the same staff, in the same bar. A rest breaks it, and so
 * does a note long enough to stand without a flag. Quavers in common time are
 * the one case that runs further — four to a beam, half a bar — because that is
 * how every scale book prints a scale in quavers, and two-note beams the length
 * of a page read as hiccups.
 *
 * Each staff is grouped by itself. The hands keep their own rhythm, and a beam
 * never joins them.
 */
export function beamed(
  measured: readonly Measured[],
  beat: number,
  measureMs: number,
  /** The bars as the score wrote them, where it did: each has its own start, tempo and metre. */
  measures?: Song['measures'],
): Measured[] {
  const lines = (): Record<BeamLine, Map<number, number>> => ({
    treble: new Map(),
    bass: new Map(),
    treble2: new Map(),
    bass2: new Map(),
  })
  const beamOf = lines()
  /** The beams that cross from one staff to the other, by the line each chord under one is on. */
  const crossOf = lines()
  let nextId = 0

  /**
   * The bar a moment falls in: where it starts, how long a crotchet lasts in
   * it, how long its beat is, and how many crotchets it holds.
   *
   * A beat is a crotchet, except in compound time — six, nine or twelve
   * quavers to the bar, and three to a bar of 3/8 — where it is three quavers
   * and the beam runs across all three.
   */
  const barAt = (startMs: number, bar: number) => {
    const written = measures?.[barIndexAt(measures, startMs)]
    if (!written)
      return {
        startMs: (bar - 1) * measureMs,
        quarterMs: beat,
        beatMs: beat,
        quarters: Math.round(measureMs / beat),
      }
    const compound = written.beatType === 8 && written.beats % 3 === 0
    return {
      startMs: written.startMs,
      quarterMs: written.quarterMs,
      beatMs: written.quarterMs * (compound ? 1.5 : 1),
      quarters: compound ? 0 : Math.round((written.beats * 4) / written.beatType),
    }
  }

  /** One chord of a line of music: what it is written as, and the line it is on. */
  type Link = { entry: Measured; voice: NonNullable<ReturnType<typeof voiceOn>>; on: BeamLine }
  /** A place in a line: its chord, or null where the line is broken there. */
  type Place = { entry: Measured; link: Link | null }

  /**
   * The runs of a line that share a beam: each a list of the chords it joins.
   *
   * A line is the chords of one voice in order, with a null wherever something
   * else stands in it and a beam cannot pass.
   */
  function runs(line: readonly Place[]): Link[][] {
    /** The beam being gathered, if one is open. */
    interface Group {
      members: Link[]
      bar: number
      beat: number
      end: number
      plain: boolean
    }
    const found: Link[][] = []
    const open: { group: Group | null } = { group: null }
    const close = () => {
      if (open.group && open.group.members.length > 1) found.push(open.group.members)
      open.group = null
    }

    for (const { entry, link } of line) {
      if (!link) {
        close()
        continue
      }
      const voice = link.voice
      const value = voice.value
      const tuplet = entry.step.notes.find(
        (note) => note.written?.tuplet && voice.notes.some((drawn) => drawn.note === note.note),
      )?.written?.tuplet
      const start = entry.step.startMs
      const bar = barAt(start, entry.bar)
      const length =
        valueQuarters(value.value, value.dots) *
        bar.quarterMs *
        (tuplet ? tuplet.normal / tuplet.actual : 1)
      // Which beat of its bar it starts on. The small allowance is for thirds
      // of a beat, which do not add up to a whole one in floating point.
      const inBar = start - bar.startMs
      const onBeat = Math.floor(inBar / bar.beatMs + 1e-6)
      const plain = value.flags === 1 && !value.dotted && !tuplet

      if (value.flags === 0) {
        close()
        continue
      }
      const current = open.group
      if (
        current !== null &&
        current.bar === entry.bar &&
        // Two milliseconds: a bar read from a score puts its notes where its
        // tempo marks say, and they add up to within a rounding of each other.
        Math.abs(start - current.end) < 2 &&
        (onBeat === current.beat ||
          // Plain quavers in four: beats one and two, or three and four.
          (current.plain &&
            plain &&
            bar.quarters === 4 &&
            Math.floor(onBeat / 2) === Math.floor(current.beat / 2)))
      ) {
        current.members.push(link)
        current.end = start + length
        current.plain = current.plain && plain
      } else {
        close()
        open.group = {
          members: [link],
          bar: entry.bar,
          beat: onBeat,
          end: start + length,
          plain,
        }
      }
    }
    close()
    return found
  }

  /*
   * First the beams that cross from one staff to the other.
   *
   * A line written across both staves — a right hand that runs down into the
   * bass, an arpeggio handed from one hand to the other — is one line, and its
   * short notes are beamed as one: the beam between the staves, the upper
   * staff's stems coming down to it and the lower staff's going up. Taken a
   * staff at a time, as everything below is, each of those notes stood alone
   * with a flag, and three notes of a triplet were a quaver and a pair.
   */
  const crossing = new Set<number>()
  for (const entry of measured)
    for (const note of entry.notes) if (note.voice !== undefined) crossing.add(note.voice)
  for (const number of crossing) {
    const line = measured.flatMap((entry): Place[] => {
      const on = BEAM_LINES.filter((each) =>
        voiceOn(entry, each)?.notes.some((note) => note.voice === number),
      )
      if (on.length === 0) return []
      // On both staves at one moment: a chord split between them, which no
      // one beam can be drawn to.
      if (on.length > 1) return [{ entry, link: null }]
      return [{ entry, link: { entry, voice: voiceOn(entry, on[0]!)!, on: on[0]! } }]
    })
    for (const run of runs(line)) {
      // All on one staff is no crossing: that staff's own beams, below.
      if (new Set(run.map((member) => staffOfLine(member.on))).size < 2) continue
      const id = nextId++
      for (const member of run) crossOf[member.on].set(member.entry.index, id)
    }
  }

  for (const line of BEAM_LINES) {
    // Each voice is beamed by itself: the hands keep their own rhythm, and
    // so do two voices in one hand.
    const chords = measured.flatMap((entry): Place[] => {
      const voice = voiceOn(entry, line)
      if (!voice) return []
      // Under a beam that crosses the staves already, and not under two.
      if (crossOf[line].has(entry.index)) return [{ entry, link: null }]
      return [{ entry, link: { entry, voice, on: line } }]
    })
    for (const run of runs(chords)) {
      const id = nextId++
      for (const member of run) beamOf[line].set(member.entry.index, id)
    }
  }

  const under = (marks: Record<BeamLine, Map<number, number>>, index: number) => {
    const found: Partial<Record<BeamLine, number>> = {}
    for (const line of BEAM_LINES) {
      const id = marks[line].get(index)
      if (id !== undefined) found[line] = id
    }
    return Object.keys(found).length > 0 ? found : undefined
  }
  return measured.map((entry) => {
    const beam = under(beamOf, entry.index)
    const cross = under(crossOf, entry.index)
    return beam || cross
      ? { ...entry, ...(beam ? { beam } : {}), ...(cross ? { cross } : {}) }
      : entry
  })
}
