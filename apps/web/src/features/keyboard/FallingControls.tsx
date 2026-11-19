import { Repeat, X } from 'lucide-react'
import { stepAtBeat, type ExerciseTimeline } from '@motius/shared'
import { Button } from '@/ui/Button'
import { fallingClock, useFallingStore } from '@/state/falling-store'
import { useLearningStore } from '@/state/learning-store'

/**
 * What the player can do to the falling notes besides play them, over the
 * field: the pause it is in, and a stretch of the music to loop.
 *
 * Shown while the music is still — paused, or not started — which is when the
 * player is placing it. A loop already set stays in view, to be cleared.
 * A loop's ends are the step at the keys: drag the music to where the stretch
 * starts and set its start, then to where it ends and set its end.
 */
export function FallingControls({ timeline }: { timeline: ExerciseTimeline }) {
  const paused = useFallingStore((state) => state.paused)
  const loop = useFallingStore((state) => state.loop)
  const setLoop = useFallingStore((state) => state.setLoop)
  const running = useLearningStore((state) => state.session.status === 'running')
  const demoing = useLearningStore((state) => state.demoStepIndex !== null)
  const still = (paused || !running) && !demoing
  if (!still && !loop) return null

  const starts = timeline.stepStarts
  /** The step at the keys. */
  const stepHere = () => stepAtBeat(timeline, fallingClock.now)
  const setStart = () => {
    const from = starts[stepHere()]!
    setLoop({ from, to: loop && loop.to > from ? loop.to : starts[starts.length - 1]! })
  }
  const setEnd = () => {
    const to = starts[stepHere() + 1]!
    setLoop({ from: loop && loop.from < to ? loop.from : 0, to })
  }

  return (
    // Its own presses stay its own: the field under it pauses on a tap.
    <div className="falling-controls" onPointerDown={(event) => event.stopPropagation()}>
      {paused && running && (
        <p className="stage-pill falling-controls__paused" role="status">
          Paused <span className="stage-pill__muted">· tap or press Space to go on</span>
        </p>
      )}
      {still && (
        <div className="stage-pill falling-controls__loop">
          <Repeat size={16} aria-hidden />
          <Button size="sm" variant="text" onClick={setStart}>
            Loop from here
          </Button>
          <Button size="sm" variant="text" onClick={setEnd}>
            to here
          </Button>
        </div>
      )}
      {loop && (
        <div className="stage-pill falling-controls__loop">
          <Repeat size={16} aria-hidden />
          Looping
          <Button size="sm" variant="text" onClick={() => setLoop(null)} aria-label="Stop looping">
            <X size={14} aria-hidden />
          </Button>
        </div>
      )}
    </div>
  )
}
