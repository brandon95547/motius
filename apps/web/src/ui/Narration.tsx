import * as React from 'react'
import { Pause, Play } from 'lucide-react'
import { keepShow, keptShow } from '@/state/kept-choice'
import { IconButton } from '@/ui/Button'

/**
 * Words read aloud — a lesson's objective, or a tip: played by itself the
 * first time its dialog opens on this device, and after that only from its
 * button, so it is not said again and again (the user, 2026-11-23). Paused or
 * played on from the same button. The file is content, named by the lesson or
 * the tip, and fetched only when it plays.
 */
const heardKey = (file: string) => `motius.narration-heard:${file}`

export function Narration({ file, open }: { file: string; open: boolean }) {
  const audio = React.useRef<HTMLAudioElement | null>(null)
  // The file playing now, for the one element kept as the file changes.
  const current = React.useRef(file)
  // What the sound is doing, from the sound itself: a start that was cut
  // short or refused, whenever its answer comes, never says it is playing.
  const [playing, setPlaying] = React.useState(false)

  const stop = React.useCallback(() => {
    const element = audio.current
    if (!element) return
    element.pause()
    element.currentTime = 0
  }, [])

  const pause = React.useCallback(() => audio.current?.pause(), [])

  // From the start the first time and after the end; else on from the pause.
  const play = React.useCallback(() => {
    const src = `${import.meta.env.BASE_URL}narration/${file}`
    current.current = file
    if (!audio.current) {
      const element = new Audio()
      element.preload = 'none'
      element.onplaying = () => {
        setPlaying(true)
        // Heard once, here: from now on it waits for its button.
        keepShow(heardKey(current.current), false)
      }
      element.onpause = () => setPlaying(false)
      element.onended = () => setPlaying(false)
      audio.current = element
    }
    const element = audio.current
    if (!element.src.endsWith(src)) element.src = src
    else if (element.ended) element.currentTime = 0
    element.play().catch(() => {
      // The browser keeps sound for a tap or a click: with no click yet on the
      // page it refuses to start it by itself, and the button is there to ask.
      // Or a pause or a close cut the start short. Either way it is not playing.
    })
  }, [file])

  // Read as the dialog opens, the first time; quiet as it closes, or as the lesson changes.
  React.useEffect(() => {
    if (!open) return
    if (keptShow(heardKey(file))) play()
    return stop
  }, [open, file, play, stop])

  return playing ? (
    <IconButton label="Pause" icon={<Pause />} size="sm" variant="inverse" onClick={pause} />
  ) : (
    <IconButton
      label="Read the objective aloud"
      icon={<Play />}
      size="sm"
      variant="inverse"
      onClick={play}
    />
  )
}

/**
 * A dialog's words with their play button to the right, where they are read
 * aloud: a crossing's tip, or which hand is which.
 */
export function NarratedText({
  file,
  open,
  children,
}: {
  file?: string
  open: boolean
  children: React.ReactNode
}) {
  return (
    <div className="narrated">
      <p className="narrated__text">{children}</p>
      {file && <Narration file={file} open={open} />}
    </div>
  )
}
