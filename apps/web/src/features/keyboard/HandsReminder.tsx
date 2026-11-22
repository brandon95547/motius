import * as React from 'react'
import { Hand } from 'lucide-react'
import { closeHandsReminder, useHandsReminder } from '@/state/hands-reminder'
import { Button } from '@/ui/Button'
import { Checkbox } from '@/ui/Controls'
import { Dialog } from '@/ui/Dialog'

/**
 * Which hand is which, in the middle of the screen, as the notes are about to
 * fall (`hands-reminder.ts` says when): no words, only each hand's color over
 * a faint hand, blue on the left and green on the right, as the hands are. Closing it, any way, starts what was
 * pressed.
 */
export function HandsReminder() {
  const open = useHandsReminder((state) => state.waiting !== null)
  const [showNext, setShowNext] = React.useState(true)
  const close = () => closeHandsReminder(showNext)

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Which hand is which"
      size="notice"
      footer={
        <div className="flex w-full flex-wrap items-center gap-2.5 coarse:gap-3">
          <Checkbox label="Show next time" checked={showNext} onChange={setShowNext} />
          <div className="ml-auto">
            <Button onClick={close}>Got it</Button>
          </div>
        </div>
      }
    >
      {/* Seen, not read: each hand's color over a faint hand, left on the left.
          The words are for a screen reader. */}
      <div className="hands-reminder">
        {(['left', 'right'] as const).map((hand) => (
          <div key={hand} className="hands-reminder__hand" data-hand={hand}>
            <Hand className="hands-reminder__picture" strokeWidth={1.25} aria-hidden />
            <span className="hands-reminder__swatch" aria-hidden />
            <span className="sr-only">
              {hand === 'left' ? 'Blue is your left hand.' : 'Green is your right hand.'}
            </span>
          </div>
        ))}
      </div>
    </Dialog>
  )
}
