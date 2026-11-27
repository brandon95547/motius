import * as React from 'react'
import { closeHandsReminder, useHandsReminder } from '@/state/hands-reminder'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { FingerChart } from '@/ui/FingerChart'
import { NarratedText } from '@/ui/Narration'

/**
 * Which hand is which, in the middle of the screen, as the notes are about to
 * fall (`hands-reminder.ts` says when): the finger chart a lesson's Finger
 * numbers shows, its fingertips in the hands' colors, and a sentence that
 * ties both to the bars, read aloud as a lesson's objective is. Closing it,
 * any way, quiets it and starts what was pressed.
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
      showNext={{ checked: showNext, onChange: setShowNext }}
      footer={<Button onClick={close}>Got it</Button>}
    >
      <FingerChart compact note={null} />
      <NarratedText file="which-hand-is-which.mp3" open={open}>
        Blue is your left hand, green your right. The number on each bar is the finger that plays
        it.
      </NarratedText>
    </Dialog>
  )
}
