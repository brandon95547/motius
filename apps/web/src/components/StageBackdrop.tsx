import * as React from 'react'
import { backdropUrl, useBackdropStore } from '@/state/backdrop-store'

/**
 * The film behind the music.
 *
 * Nothing at all until one is chosen — no element, so nothing is fetched. Then
 * a silent loop under everything on the stage, which no pointer and no screen
 * reader ever meets.
 *
 * It plays whatever the system's motion setting: nothing starts it but the
 * player choosing it, by name, from a menu that is only films — that choice is
 * the consent Reduce Motion is there to ask for. It is faint, slow and silent,
 * and None takes it away.
 */
export function StageBackdrop() {
  const backdrop = useBackdropStore((state) => state.backdrop)
  const ref = React.useRef<HTMLVideoElement>(null)

  React.useEffect(() => {
    const video = ref.current
    if (!video) return
    // Set here as well as in the markup: a film that is not muted when it is
    // asked to play is one the browser will not start on its own.
    video.muted = true
    // A browser that refuses to start it (a power-saving mode, say) leaves it
    // on its first frame, which is still the picture that was asked for.
    void video.play()?.catch(() => {})
  }, [backdrop])

  if (backdrop === 'none') return null
  return (
    <video
      ref={ref}
      key={backdrop}
      className="stage__backdrop"
      src={backdropUrl(backdrop)}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      disablePictureInPicture
      aria-hidden
      tabIndex={-1}
    />
  )
}
