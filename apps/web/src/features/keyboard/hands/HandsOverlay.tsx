import * as React from 'react'
import {
  keyReleases,
  playedSteps,
  scoreMsAt,
  songSteps,
  timelineOf,
  type Exercise,
  type Hand,
  type Song,
} from '@motius/shared'
import { useElementSize } from '@/lib/hooks'
import { keyCenterPercent, type KeyboardLayout } from '@/lib/keyboard-layout'
import { useKeyboardStore } from '@/state/keyboard-store'
import { useLearningStore } from '@/state/learning-store'
import { useCurrentSong, useSongStore } from '@/state/song-store'
import { useViewStore } from '@/state/view-store'
import {
  frameAt,
  handFrames,
  handPose,
  handTimeline,
  shapeAt,
  type HandKeyframe,
} from './hand-poses'

/**
 * The hands, over the keys, playing the music's fingering: a song's, or an
 * exercise's — a lesson, a scale, a chord.
 *
 * The music says which finger takes each note, and the keys light to say which
 * note. What neither shows is the hand: that three fingers go down as one
 * shape, that the hand stays put for this bar and travels for the next, that
 * the thumb is already on its way. So the hands are drawn, see-through, where
 * the fingering puts them, and move as it moves them.
 *
 * Playing, they go a little ahead of the music: a finger sets off for its key
 * just before the note and is on it as the note sounds, as a hand does. In
 * Learn, and with the song stopped, they show the step the player is on, and
 * wait; so do an exercise's, on the step asked for or the one being heard. A fingertip is down when its key is — the song's doing or the
 * player's — so it fills in the instant the key lights and not a tick later.
 *
 * Only where there is a fingering to draw. Music without one has no hands to
 * show, and a note without a finger is left out rather than guessed at.
 *
 * Drawn by hand rather than by React, from here down. The playhead moves forty
 * times a second, and a component that rendered on each of them is what made a
 * playing song stutter (see `SongScore`). This listens to the store, and when
 * a finger has somewhere new to be it moves the ten lines itself.
 */

const HANDS: readonly Hand[] = ['left', 'right']
const FINGERS = [1, 2, 3, 4, 5] as const
const NO_KEYS: readonly (number | null)[] = [null, null, null, null, null]

/** How long before its note a finger sets off, and so how long it takes to get there. */
const LEAD_MS = 110
/** How long a hand takes to settle on a step it is shown rather than played. */
const SETTLE_MS = 140
/** A keyframe on the very moment asked about has begun. */
const EDGE_MS = 0.5

/** What a finger is doing: on a key that is down, on its way to one or showing one, or neither. */
type FingerState = 'down' | 'ready' | 'idle'

/** A hand as the numbers that draw it, in pixels: each finger's tip and root, then the palm. */
type Numbers = number[]

interface View {
  group: SVGGElement
  palm: SVGRectElement
  fingers: {
    group: SVGGElement
    edge: SVGLineElement
    skin: SVGLineElement
    tip: SVGCircleElement
  }[]
  /** Where it is drawn now, where it set off from, and where it is going. */
  now: Numbers | null
  from: Numbers
  to: Numbers | null
  startedAt: number
  takesMs: number
  /** The keyframe it last took its shape from, so the same one is not set off for twice. */
  shape: HandKeyframe | null
  /** The keys its fingers are going to or showing, which is none of them while it rests. */
  going: readonly (number | null)[]
}

/** What the hands follow: each hand's keyframes, and where the music is in them. */
interface HandsSource {
  timelines: Record<Hand, readonly HandKeyframe[]>
  /** Where the music is, in the keyframes' time; whether it is sounding (the fingers then go ahead of it); which hands play. */
  at: () => { nowMs: number; sounding: boolean; leadMs: number; part: 'both' | Hand }
  /** Called whenever where the music is may have changed. */
  subscribe: (listener: () => void) => () => void
}

export function HandsOverlay({ layout }: { layout: KeyboardLayout }) {
  const on = useViewStore((state) => state.hands)
  const topic = useLearningStore((state) => state.topic)
  const exercise = useLearningStore((state) => state.exercise)
  const song = useCurrentSong()
  if (!on) return null
  if (topic === 'songs')
    return song?.hasFingering ? <SongHands song={song} layout={layout} /> : null
  return exercise && hasFingers(exercise) ? (
    <ExerciseHands exercise={exercise} layout={layout} />
  ) : null
}

const hasFingers = (exercise: Exercise) =>
  exercise.steps.some((step) => step.fingers.some((finger) => finger !== undefined))

/** A song's hands: the playhead while it plays, the step asked for in Learn. */
function SongHands({ song, layout }: { song: Song; layout: KeyboardLayout }) {
  const part = useSongStore((state) => state.part)
  const mode = useSongStore((state) => state.mode)

  // The steps Learn walks, in the order it walks them: the step the player is
  // on is counted along these, as `useSongLearning` counts it.
  const played = React.useMemo(() => {
    if (mode !== 'learn') return []
    const steps = songSteps(song, part)
    return playedSteps(song, steps).map((index) => steps[index]!)
  }, [song, part, mode])

  const source = React.useMemo<HandsSource>(() => {
    const releases = keyReleases(song)
    return {
      timelines: {
        left: handTimeline(song, 'left', releases),
        right: handTimeline(song, 'right', releases),
      },
      at: () => {
        const state = useSongStore.getState()
        const learn = state.mode === 'learn'
        const sounding = !learn && state.playing
        return {
          nowMs: learn
            ? (played[Math.min(state.stepIndex, played.length - 1)]?.startMs ?? 0)
            : scoreMsAt(song, state.positionMs),
          sounding,
          leadMs: sounding ? LEAD_MS * state.tempoScale : 0,
          part: state.part,
        }
      },
      subscribe: useSongStore.subscribe,
    }
  }, [song, played])
  return <Hands source={source} layout={layout} />
}

/** A beat of an exercise, in the keyframes' time. */
const BEAT = 1000

/**
 * An exercise's hands, where its fingering puts them: on the step being
 * demonstrated, or the step the player is on — before a run, the first, so the
 * hands show where to begin, as a teacher would.
 */
function ExerciseHands({ exercise, layout }: { exercise: Exercise; layout: KeyboardLayout }) {
  const source = React.useMemo<HandsSource>(() => {
    const timeline = timelineOf(exercise)
    const notes = timeline.notes.map((note) => ({
      note: note.note,
      hand: note.hand,
      finger: note.finger,
      startMs: note.start * BEAT,
      upMs: (note.start + note.beats) * BEAT,
    }))
    const last = Math.max(0, timeline.stepStarts.length - 2)
    return {
      timelines: { left: handFrames(notes, 'left'), right: handFrames(notes, 'right') },
      at: () => {
        const { demoStepIndex, session } = useLearningStore.getState()
        const here = Math.min(demoStepIndex ?? session.stepIndex, last)
        return {
          nowMs: (timeline.stepStarts[here] ?? 0) * BEAT,
          sounding: false,
          leadMs: 0,
          part: 'both',
        }
      },
      subscribe: useLearningStore.subscribe,
    }
  }, [exercise])
  return <Hands source={source} layout={layout} />
}

function Hands({ source, layout }: { source: HandsSource; layout: KeyboardLayout }) {
  const [frameRef, size] = useElementSize<HTMLDivElement>()
  const svgRef = React.useRef<SVGSVGElement>(null)

  React.useEffect(() => {
    const svg = svgRef.current
    if (!svg || size.width === 0 || size.height === 0) return

    const whiteKey = layout.whiteCount > 0 ? 100 / layout.whiteCount : 100
    const unit = (size.width * whiteKey) / 100
    const keyX = (note: number) => keyCenterPercent(layout, note)
    const still = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

    const views = {} as Record<Hand, View>
    for (const hand of HANDS) {
      const group = svg.querySelector<SVGGElement>(`[data-hand="${hand}"]`)!
      views[hand] = {
        group,
        palm: group.querySelector<SVGRectElement>('.hand__palm')!,
        fingers: FINGERS.map((finger) => {
          const each = group.querySelector<SVGGElement>(`[data-finger="${finger}"]`)!
          return {
            group: each,
            edge: each.querySelector<SVGLineElement>('.hand__edge')!,
            skin: each.querySelector<SVGLineElement>('.hand__skin')!,
            tip: each.querySelector<SVGCircleElement>('.hand__tip')!,
          }
        }),
        now: null,
        from: [],
        to: null,
        startedAt: 0,
        takesMs: 0,
        shape: null,
        going: NO_KEYS,
      }
      // Sized to the keys they are over: a finger is a little narrower than a
      // white key, and the thumb the widest of them.
      for (const [index, finger] of views[hand].fingers.entries()) {
        const wide = unit * (index === 0 ? 0.7 : 0.6)
        finger.edge.setAttribute('stroke-width', String(wide))
        finger.skin.setAttribute('stroke-width', String(Math.max(1, wide - 3)))
        finger.tip.setAttribute('r', String(unit * 0.16))
      }
      views[hand].palm.setAttribute('width', String(unit * 4.4))
      views[hand].palm.setAttribute('height', String(size.height))
      views[hand].palm.setAttribute('rx', String(unit * 1.1))
    }

    const numbers = (keys: readonly (number | null)[], hand: Hand): Numbers => {
      const pose = handPose(keys, hand, keyX, whiteKey)
      const x = (percent: number) => (percent / 100) * size.width
      const y = (share: number) => share * size.height
      return [
        ...pose.fingers.flatMap((finger) => [
          x(finger.tipX),
          y(finger.tipY),
          x(finger.baseX),
          y(finger.baseY),
        ]),
        x(pose.palmX),
        y(pose.palmY),
      ]
    }

    const draw = (view: View) => {
      const at = view.now!
      for (const [index, finger] of view.fingers.entries()) {
        const [tipX, tipY, baseX, baseY] = at.slice(index * 4, index * 4 + 4) as [
          number,
          number,
          number,
          number,
        ]
        for (const line of [finger.edge, finger.skin]) {
          line.setAttribute('x1', String(baseX))
          line.setAttribute('y1', String(baseY))
          line.setAttribute('x2', String(tipX))
          line.setAttribute('y2', String(tipY))
        }
        finger.tip.setAttribute('cx', String(tipX))
        finger.tip.setAttribute('cy', String(tipY))
      }
      view.palm.setAttribute('x', String(at[20]! - unit * 2.2))
      view.palm.setAttribute('y', String(at[21]! - unit * 0.35))
    }

    let frame = 0
    const tick = (time: number) => {
      let moving = false
      for (const hand of HANDS) {
        const view = views[hand]
        if (!view.to || !view.now) continue
        const along = view.takesMs <= 0 ? 1 : Math.min(1, (time - view.startedAt) / view.takesMs)
        // Quick away and gentle onto the key.
        const eased = 1 - (1 - along) ** 3
        for (let at = 0; at < view.to.length; at++)
          view.now[at] = view.from[at]! + (view.to[at]! - view.from[at]!) * eased
        draw(view)
        if (along < 1) moving = true
        else view.to = null
      }
      frame = moving ? requestAnimationFrame(tick) : 0
    }

    const moveTo = (view: View, target: Numbers, takesMs: number) => {
      // The first place a hand is drawn it is simply there.
      if (!view.now || takesMs <= 0 || still || typeof requestAnimationFrame !== 'function') {
        view.now = [...target]
        view.to = null
        draw(view)
        return
      }
      view.from = [...view.now]
      view.to = target
      view.startedAt = performance.now()
      view.takesMs = takesMs
      if (!frame) frame = requestAnimationFrame(tick)
    }

    /** Each finger's state, from the keys that are down. Cheap: it runs on every key event. */
    const mark = () => {
      const { active } = useKeyboardStore.getState()
      for (const hand of HANDS) {
        const view = views[hand]
        if (!view.shape) continue
        for (const [index, finger] of view.fingers.entries()) {
          const key = view.shape.keys[index] ?? null
          const doing: FingerState =
            key !== null && active[key] !== undefined
              ? 'down'
              : view.going[index] != null
                ? 'ready'
                : 'idle'
          if (finger.group.dataset.state !== doing) finger.group.dataset.state = doing
        }
      }
    }

    /** Where each hand is to be, from where the music has got to. */
    const place = () => {
      const { nowMs, sounding, leadMs, part } = source.at()

      for (const hand of HANDS) {
        const view = views[hand]
        const timeline = source.timelines[hand]
        const shown = (part === 'both' || part === hand) && timeline.length > 0
        view.group.style.display = shown ? '' : 'none'
        if (!shown) continue

        const ahead = frameAt(timeline, nowMs + leadMs + EDGE_MS)
        const shape = shapeAt(timeline, ahead)
        if (!shape) continue
        view.going = timeline[ahead]?.keys ?? NO_KEYS
        if (shape !== view.shape) {
          view.shape = shape
          moveTo(view, numbers(shape.keys, hand), sounding ? LEAD_MS : SETTLE_MS)
        }
      }
      mark()
    }

    place()
    const stopMusic = source.subscribe(place)
    const stopKeys = useKeyboardStore.subscribe(mark)
    return () => {
      stopMusic()
      stopKeys()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [source, layout, size.width, size.height])

  return (
    <div ref={frameRef} className="hands" aria-hidden>
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${Math.max(1, size.width)} ${Math.max(1, size.height)}`}
      >
        {HANDS.map((hand) => (
          <g key={hand} className="hand" data-hand={hand}>
            <rect className="hand__palm" />
            {FINGERS.map((finger) => (
              <g key={finger} className="hand__finger" data-finger={finger} data-state="idle">
                <line className="hand__edge" />
                <line className="hand__skin" />
                <circle className="hand__tip" />
              </g>
            ))}
          </g>
        ))}
      </svg>
    </div>
  )
}
