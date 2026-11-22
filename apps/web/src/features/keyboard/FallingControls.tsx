import { useFallingStore } from '@/state/falling-store'
import { useLearningStore } from '@/state/learning-store'

/**
 * What the falling notes say over the field besides the notes: that a run is
 * paused, and how to go on.
 */
export function FallingControls() {
  const paused = useFallingStore((state) => state.paused)
  const running = useLearningStore((state) => state.session.status === 'running')
  if (!paused || !running) return null

  return (
    // Its own presses stay its own: the field under it pauses on a tap.
    <div className="falling-controls" onPointerDown={(event) => event.stopPropagation()}>
      <p className="stage-pill falling-controls__paused" role="status">
        Paused <span className="stage-pill__muted">· tap or press Space to go on</span>
      </p>
    </div>
  )
}
