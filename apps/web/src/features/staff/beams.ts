import { MIDDLE_LINE, stemDirection } from '@sonara/shared'
import { STEP, yOn } from './staff-frame'
import { placementOf, STEM_STEPS, stemXFor } from './StaffNotes'
import { BEAM_LINES, staffOfLine, voiceOn, type BeamLine, type Placed } from './score'

/**
 * Beams: the bars that join short notes into the beats they belong to.
 *
 * A quaver on its own carries a flag. Four of them in a row carrying four flags
 * is a line of washing, and it says nothing about where the beat falls — which
 * is the only reason short notes are grouped at all. A beam says it at a
 * glance: these belong together, and the next beat starts where the next beam
 * does.
 *
 * Which notes share a beam is decided when the score is measured (see
 * `measureScore`), because it is a fact about rhythm. What the beam looks like
 * is decided here, once the chords have been placed, because it is geometry:
 * a beam is a line between two stems, and where the stems are is not known
 * until the page is laid out.
 *
 * The rules are the engraver's, kept to the few that matter at this size:
 *
 * - **One direction for the group.** The note furthest from the middle line
 *   decides, exactly as it does for a chord, and every stem follows.
 * - **The beam follows the notes**, rising when they rise — but only so far.
 *   A beam as steep as a scale reads as a slash; past a staff space of rise it
 *   is flattened.
 * - **Stems reach the beam, never the other way round.** The beam is placed so
 *   that the note nearest it has a stem of the normal length, and every other
 *   stem is lengthened to meet it. None is ever shortened.
 *
 * A beam that crosses from one staff to the other is the exception to the
 * first: it lies between the staves, the upper staff's stems come down to it
 * and the lower staff's go up.
 */

/** How one chord's stem is drawn when a beam decides it. */
export interface StemOverride {
  readonly up: boolean
  /** Where the stem ends: on the beam's outer edge. */
  readonly end: number
}

/** The stems of one step that beams have decided, by staff. */
export type StepStems = Partial<Record<BeamLine, StemOverride>>

/** One beam, or one level of it, as a four-cornered shape. */
export interface BeamBar {
  readonly points: string
}

export interface BeamShape {
  readonly key: string
  /** The staff it is drawn on, or null for one that lies between the two and joins both. */
  readonly staff: 'treble' | 'bass' | null
  /** The steps it joins, for deciding whether it is behind the player yet. */
  readonly indices: readonly number[]
  readonly bars: readonly BeamBar[]
  /** `3` over a triplet, where the group is one. */
  readonly tuplet?: { readonly x: number; readonly y: number; readonly text: string }
}

/** Half a staff space: the weight a beam is drawn at. */
const THICKNESS = STEP
/** From one beam of a group to the next: its thickness, and a quarter space of air. */
const PITCH = STEP * 1.6
/** The most a beam rises or falls from end to end. */
const MAX_RISE = STEP * 2
/** How long the stub of a lone short note is: about a notehead. */
const STUB = STEP * 2.4
/** The shortest stem a beam between the staves leaves a note: two staff spaces. */
const CROSS_STEM = STEP * 4

interface Member {
  readonly index: number
  readonly x: number
  /** The step of the note nearest the beam. */
  readonly outer: number
  readonly steps: readonly number[]
  readonly flags: number
  readonly tuplet?: { readonly id: number; readonly actual: number }
}

/**
 * The bars of one beam: the long one, and under it the shorter ones for the
 * notes with more than one flag.
 *
 * `edge` is the beam's outer side at an x, the side away from the noteheads;
 * the further levels are stacked in from it, down where the stems go up.
 */
function barsOf(
  members: readonly Pick<Member, 'x' | 'flags'>[],
  edge: (x: number) => number,
  up: boolean,
): BeamBar[] {
  const first = members[0]!
  const last = members.at(-1)!
  /** One bar of the beam, `level` beams in from the outer edge. */
  const bar = (from: number, to: number, level: number): BeamBar => {
    const inward = (up ? 1 : -1) * level * PITCH
    const thick = (up ? 1 : -1) * THICKNESS
    const a = edge(from) + inward
    const b = edge(to) + inward
    return {
      points: `${from},${a} ${to},${b} ${to},${b + thick} ${from},${a + thick}`,
    }
  }

  const bars: BeamBar[] = [bar(first.x, last.x, 0)]
  const levels = Math.max(...members.map((member) => member.flags))
  for (let level = 1; level < levels; level++) {
    let start: Pick<Member, 'x' | 'flags'> | null = null
    members.forEach((member, at) => {
      const has = member.flags > level
      const next = members[at + 1]
      if (has && start === null) start = member
      if (start !== null && (!has || !next || next.flags <= level)) {
        const end = has ? member : members[at - 1]!
        if (end.x > start.x) bars.push(bar(start.x, end.x, level))
        else {
          // A short note with no short neighbour: a stub, towards the
          // rest of its group.
          const towards = at === 0 || (has && next && !members[at - 1]) ? 1 : -1
          const tip = start.x + towards * STUB
          bars.push(bar(Math.min(start.x, tip), Math.max(start.x, tip), level))
        }
        start = null
      }
    })
  }
  return bars
}

export function beamsIn(
  placed: readonly Placed[],
  /** How far the two staves have been opened (`spreadOf`): a beam between them is drawn where they are. */
  spread = 0,
): {
  stems: Map<number, StepStems>
  beams: BeamShape[]
} {
  const stems = new Map<number, StepStems>()
  const beams: BeamShape[] = []

  for (const line of BEAM_LINES) {
    const staff = staffOfLine(line)
    // Gather the groups on this line: a staff's, or its lower voice's. A group that runs over the end of a
    // line is two groups, one on each: a beam does not cross a system break.
    const groups = new Map<number, Placed[]>()
    for (const entry of placed) {
      const id = entry.beam?.[line]
      if (id === undefined) continue
      const group = groups.get(id)
      if (group) group.push(entry)
      else groups.set(id, [entry])
    }

    for (const [id, entries] of groups) {
      if (entries.length < 2) continue
      const chords = entries.map((entry) => {
        // The notes under the beam are this voice's, and so is the way its
        // stems point, where the staff has two.
        const voice = voiceOn(entry, line)!
        const steps = voice.notes.map((note) => placementOf(note).steps).sort((a, b) => a - b)
        const part = entry.parts?.find((candidate) => candidate.notes === voice.notes)
        return { entry, steps, stem: voice.stem, dx: part?.dx ?? 0, flags: voice.value.flags }
      })
      const voiced = chords.find(({ stem }) => stem !== undefined)?.stem
      const up = voiced
        ? voiced === 'up'
        : stemDirection(
            chords.flatMap(({ steps }) => steps.map((step) => ({ staff, steps: step }))),
          ) === 'up'
      const middle = MIDDLE_LINE[staff]

      const members: Member[] = chords.map(({ entry, steps, dx, flags }) => ({
        index: entry.index,
        x: stemXFor(entry.x + dx, up),
        outer: up ? steps.at(-1)! : steps[0]!,
        steps,
        flags,
        tuplet: entry.tuplet?.[staff],
      }))

      /** Where each stem would end if its chord stood alone. */
      const tips = members.map(({ outer }) => {
        const reach = outer + (up ? STEM_STEPS : -STEM_STEPS)
        return yOn(up ? Math.max(reach, middle) : Math.min(reach, middle), staff)
      })

      const first = members[0]!
      const last = members.at(-1)!
      const run = last.x - first.x
      const rise = Math.max(-MAX_RISE, Math.min(MAX_RISE, tips.at(-1)! - tips[0]!))
      const slope = run > 0 ? rise / run : 0
      const along = (x: number) => tips[0]! + slope * (x - first.x)
      // Moved away from the notes until the stem nearest the beam is full
      // length. Up is towards smaller y.
      const slack = members.map((member, at) => tips[at]! - along(member.x))
      const shift = up ? Math.min(0, ...slack) : Math.max(0, ...slack)
      const edge = (x: number) => along(x) + shift

      for (const member of members) {
        stems.set(member.index, {
          ...stems.get(member.index),
          [line]: { up, end: edge(member.x) },
        })
      }

      const bars = barsOf(members, edge, up)

      // A beam that is exactly one tuplet says so with its number, on the
      // stem side, clear of the beam.
      const tuplet = first.tuplet
      const whole =
        tuplet !== undefined &&
        members.length === tuplet.actual &&
        members.every((member) => member.tuplet?.id === tuplet.id)
      const midX = (first.x + last.x) / 2

      beams.push({
        key: `${line}-${id}-${first.index}`,
        staff,
        indices: members.map((member) => member.index),
        bars,
        ...(whole
          ? {
              tuplet: {
                x: midX,
                y: edge(midX) + (up ? -STEP * 0.9 : STEP * 2.7),
                text: String(tuplet.actual),
              },
            }
          : {}),
      })
    }
  }

  /*
   * The beams that cross from one staff to the other.
   *
   * Worked out where the staves are, which is not where `yOn` says once a
   * system has opened: the upper staff is higher by the spread and the lower
   * one lower. The beam is drawn there, and each stem is told where to end in
   * its own staff's terms.
   */
  const crossing = new Map<number, { entry: Placed; line: BeamLine }[]>()
  for (const entry of placed)
    for (const line of BEAM_LINES) {
      const id = entry.cross?.[line]
      if (id === undefined) continue
      crossing.set(id, [...(crossing.get(id) ?? []), { entry, line }])
    }
  for (const [id, joined] of crossing) {
    const members = joined.map(({ entry, line }) => {
      const voice = voiceOn(entry, line)!
      const staff = staffOfLine(line)
      const steps = voice.notes.map((note) => placementOf(note).steps).sort((a, b) => a - b)
      const part = entry.parts?.find((candidate) => candidate.notes === voice.notes)
      // The lower staff's stems rise to the beam and the upper staff's fall to it.
      const up = staff === 'bass'
      const moved = staff === 'treble' ? -spread : spread
      return {
        index: entry.index,
        line,
        up,
        moved,
        x: stemXFor(entry.x + (part?.dx ?? 0), up),
        flags: voice.value.flags,
        /** The head nearest the beam, where the page has it. */
        near: yOn(up ? steps.at(-1)! : steps[0]!, staff) + moved,
        tuplet: entry.tuplet?.[staff],
      }
    })
    const above = members.filter((member) => !member.up)
    const below = members.filter((member) => member.up)
    // A line break can leave a beam with one end of itself, or one staff's
    // share: those notes keep their flags.
    if (members.length < 2 || above.length === 0 || below.length === 0) continue

    const levels = Math.max(...members.map((member) => member.flags))
    const depth = THICKNESS + (levels - 1) * PITCH
    /** As high as the beam may go and as low, leaving every note a stem. */
    const highest = Math.max(...above.map((member) => member.near)) + CROSS_STEM
    const lowest = Math.min(...below.map((member) => member.near)) - CROSS_STEM - depth
    // The notes of the two staves pass each other: no beam goes between.
    if (lowest < highest) continue
    // Midway between the staves, which is where the eye looks for it.
    const top = Math.min(lowest, Math.max(highest, -depth / 2))

    for (const member of members) {
      // A stem from below goes through every bar of the beam to its top. One
      // from above stops at the last bar it has.
      const end = member.up ? top : top + (member.flags - 1) * PITCH + THICKNESS
      stems.set(member.index, {
        ...stems.get(member.index),
        [member.line]: { up: member.up, end: end - member.moved },
      })
    }

    const first = members[0]!
    const last = members.at(-1)!
    const tuplet = first.tuplet
    const whole =
      tuplet !== undefined &&
      members.length === tuplet.actual &&
      members.every((member) => member.tuplet?.id === tuplet.id)
    beams.push({
      key: `cross-${id}-${first.index}`,
      staff: null,
      indices: members.map((member) => member.index),
      bars: barsOf(members, () => top, true),
      ...(whole
        ? {
            tuplet: { x: (first.x + last.x) / 2, y: top - STEP * 0.9, text: String(tuplet.actual) },
          }
        : {}),
    })
  }

  return { stems, beams }
}
