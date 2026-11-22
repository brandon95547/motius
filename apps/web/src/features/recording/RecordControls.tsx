import { Circle, History, Square } from 'lucide-react'
import { cn } from '@/lib/cn'
import { BarButton } from '@/ui/BarButton'
import { useRecordingStore } from '@/state/recording-store'

/**
 * Record, and then decide what the take was for.
 *
 * The count-in exists because the alternative is worse than it sounds: a
 * recording that begins on the click means the first note is either missed or
 * rushed, and a player watching for the moment to start is not playing.
 *
 * A red dot, because that is what record is on every machine that has ever had
 * the button — and red rather than the app's danger colour, which in the dark
 * theme is an orange and reads as a warning, not as record. Armed, the whole
 * button is red and the dot is a stop square.
 */
export function RecordButton({ className }: { className?: string }) {
  const status = useRecordingStore((state) => state.status)
  const arm = useRecordingStore((state) => state.arm)
  const stop = useRecordingStore((state) => state.stop)

  const live = status === 'recording' || status === 'counting'
  const label =
    status === 'recording'
      ? 'Stop recording'
      : status === 'counting'
        ? 'Cancel the count-in'
        : 'Record what you play'

  return (
    <BarButton
      look="icon"
      label={label}
      className={cn('bar-record', live && 'is-recording', className)}
      onClick={() => (live ? stop() : arm())}
      icon={
        live ? (
          <Square size={14} fill="currentColor" aria-hidden />
        ) : (
          <Circle className="bar-record__dot" size={16} fill="currentColor" aria-hidden />
        )
      }
    />
  )
}

/**
 * The take you closed without deciding, and the way back to it.
 *
 * A dialog that can be dismissed has to leave something behind, or dismissing
 * it is deleting it by another name. This is that something: it appears only
 * while a finished take is waiting, and arming a new recording clears it — which
 * is the one place a take is dropped without being asked for, and the one place
 * the player has plainly asked for it.
 */
export function LastTakeButton() {
  const waiting = useRecordingStore((state) => state.status === 'kept' && state.take.length > 0)
  const review = useRecordingStore((state) => state.review)

  if (!waiting) return null

  return (
    <BarButton
      look="icon"
      label="Reopen the last recording"
      onClick={review}
      icon={<History size={18} aria-hidden />}
    />
  )
}

/** The count-in, and the fact that it is running, over everything else. */
export function RecordingOverlay() {
  const status = useRecordingStore((state) => state.status)
  const count = useRecordingStore((state) => state.count)
  const elapsedMs = useRecordingStore((state) => state.elapsedMs)

  if (status === 'counting') {
    return (
      <div className="record-scrim" role="status" aria-live="assertive">
        <div className="record-countdown">
          <span className="record-countdown__number" key={count}>
            {count}
          </span>
          <span className="record-countdown__caption">Recording starts — play when it does</span>
        </div>
      </div>
    )
  }

  if (status !== 'recording') return null

  return (
    <div className="record-banner" role="status" aria-live="polite">
      <span className="record-banner__dot" aria-hidden />
      Recording {formatLength(elapsedMs)}
    </div>
  )
}

export function formatLength(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
