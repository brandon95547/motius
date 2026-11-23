import * as React from 'react'
import type { StepCrossing } from '@motius/shared'
import { closeCrossingTip, useCrossingDue } from '@/state/crossing-tips'
import { useViewStore } from '@/state/view-store'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { CrossingAnimation } from './CrossingAnimation'

/**
 * How to cross, before the key that needs it (`state/crossing-tips.ts` says
 * when): the crossing drawn and moving, and what to do in a sentence or two,
 * as simply as it can be said. Loaded the first time a lesson's run reaches a
 * crossing. Closing it, any way, lets the run go on to the key.
 */
export function CrossingTip() {
  const due = useCrossingDue()
  // Kept while it closes, so its words do not vanish under the animation out.
  const [shown, setShown] = React.useState<StepCrossing | null>(due)
  if (due && due !== shown) setShown(due)
  const [showNext, setShowNext] = React.useState(true)
  const hands = useViewStore((state) => state.hands)
  const close = () => closeCrossingTip(showNext)
  if (!shown) return null
  const { title, text } = wordsFor(shown)

  return (
    <Dialog
      open={due !== null}
      onClose={close}
      eyebrow={`${shown.hand === 'left' ? 'Left' : 'Right'} hand, going ${shown.direction}`}
      title={title}
      size="notice"
      showNext={{ checked: showNext, onChange: setShowNext }}
      footer={<Button onClick={close}>Got it</Button>}
    >
      <div className="crossing-tip">
        <CrossingAnimation crossing={shown} />
        <p className="crossing-tip__text">
          {text}
          {/* Where the see-through hands are on the keys (View ▸ Hands on the keys), they
              play the crossing too, on the very keys. */}
          {hands && ' Watch the hands on the keyboard: they show it too.'}
        </p>
      </div>
    </Dialog>
  )
}

/** What the crossing is called, and what to do, in plain words. */
function wordsFor({ kind, finger, keys, to }: StepCrossing) {
  const target = keys[to]
  if (kind === 'thumb-under')
    return {
      title: 'Thumb under',
      text: `Tuck your thumb under your fingers to play ${target}. Your hand follows it.`,
    }
  return {
    title: `Finger ${finger} over`,
    text: `Cross finger ${finger} over your thumb to play ${target}. Your hand follows it.`,
  }
}
