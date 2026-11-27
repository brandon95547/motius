import * as React from 'react'
import type { StepCrossing } from '@motius/shared'
import { closeCrossingTip, useCrossingTip } from '@/state/crossing-tips'
import { panelActions } from '@/state/panel-store'
import { useViewStore } from '@/state/view-store'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { FingerChart } from '@/ui/FingerChart'
import { NarratedText } from '@/ui/Narration'
import { CrossingDrawing } from './CrossingDrawing'

/**
 * How to cross, before the key that needs it (`state/crossing-tips.ts` says
 * when): the crossing drawn, and what to do in a sentence or two, read aloud,
 * as simply as it can be said. Where the other hand takes over, the words —
 * that it starts here, and which bars are its — and that hand under them.
 * Loaded the first time a lesson's run reaches a crossing. Closing it, any
 * way, lets the run go on to the key. Opened again from the info button, it
 * offers the lesson's introduction too.
 */
export function CrossingTip() {
  const { crossing: due, asked } = useCrossingTip()
  // Kept while it closes, so its words do not vanish under the animation out.
  const [shown, setShown] = React.useState<StepCrossing | null>(due)
  if (due && due !== shown) setShown(due)
  const [showNext, setShowNext] = React.useState(true)
  const hands = useViewStore((state) => state.hands)
  const close = () => closeCrossingTip(showNext)
  // Opened again from the info button: the lesson's introduction a click away.
  const introduction = () => {
    close()
    panelActions.open('lesson')
  }
  if (!shown) return null
  const { title, text, narration } = wordsFor(shown)

  return (
    <Dialog
      open={due !== null}
      onClose={close}
      eyebrow={
        shown.kind === 'hand-change'
          ? undefined
          : `${shown.hand === 'left' ? 'Left' : 'Right'} hand, going ${shown.direction}`
      }
      title={title}
      size="notice"
      showNext={{ checked: showNext, onChange: setShowNext }}
      footer={
        <>
          {asked && (
            <Button variant="outlined" onClick={introduction}>
              Lesson introduction
            </Button>
          )}
          <Button onClick={close}>Got it</Button>
        </>
      }
    >
      <div className="crossing-tip">
        {shown.kind !== 'hand-change' && <CrossingDrawing crossing={shown} />}
        {/* Read aloud as it opens, with its button to the right, as a lesson's objective is. */}
        <NarratedText file={narration} open={due !== null}>
          {text}
          {/* Where the see-through hands are on the keys (View ▸ Hands on the keys), they
              play the crossing too, on the very keys. A recorded tip says so in its own words. */}
          {hands &&
            !narration &&
            shown.kind !== 'hand-change' &&
            ' Watch the hands on the keyboard: they show it too.'}
        </NarratedText>
        {/* The other hand taking over: under its words, that hand, its fingers
            numbered in its color, as the finger numbers show them. */}
        {shown.kind === 'hand-change' && <FingerChart hands={shown.hand} compact note={null} />}
      </div>
    </Dialog>
  )
}

/** What the crossing is called, what to do in plain words, and its recording where it has one. */
function wordsFor({ kind, finger, keys, to, hand }: StepCrossing): {
  title: string
  text: string
  narration?: string
} {
  const target = keys[to]
  if (kind === 'hand-change')
    return hand === 'right'
      ? {
          title: 'Right hand',
          text: 'Your right hand starts here with your thumb. The green bars represent your right hand.',
          narration: 'right-hand-starts.mp3',
        }
      : {
          title: 'Left hand',
          text: 'Your left hand starts here. The blue bars represent your left hand.',
        }
  // Recorded for the one in Notes A to G (and A to G Repeated): thumb under to
  // D, its words as said (the user, 2026-11-23).
  if (kind === 'thumb-under' && target === 'D')
    return {
      title: 'Thumb under',
      text: 'Tuck your thumb under your fingers to play D, letting your hand follow. Watch the keyboard fingering below and notice the purple falling bars where the change happens.',
      narration: 'thumb-under-to-d-3.mp3',
    }
  if (kind === 'thumb-under')
    return {
      title: 'Thumb under',
      text: `Tuck your thumb under your fingers to play ${target}. Your hand follows it.`,
    }
  // Recorded for the one in Notes A to G (and A to G Repeated): 3 over to F,
  // its words as said (the user, 2026-11-23).
  if (finger === 3 && target === 'F')
    return {
      title: 'Finger 3 over',
      text: 'Cross finger 3 over your thumb to play F, letting your hand follow. Watch the keyboard fingering. Finger crossings are highlighted in purple.',
      narration: 'finger-3-over-to-f-2.mp3',
    }
  return {
    title: `Finger ${finger} over`,
    text: `Cross finger ${finger} over your thumb to play ${target}. Your hand follows it.`,
  }
}
