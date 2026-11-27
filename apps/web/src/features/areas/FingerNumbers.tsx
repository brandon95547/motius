import * as React from 'react'
import { Popover } from '@/ui/Menu'
import { lazyExport, OnDemand } from '@/ui/OnDemand'

const FingerChart = lazyExport(() => import('@/ui/FingerChart'), 'FingerChart')

/**
 * What the finger numbers are, for a player who does not know them yet: both
 * hands as they rest on the keys, seen from above, each fingertip numbered —
 * 1 the thumb to 5 the little finger, the same on both hands. Opened from a
 * link at the end of a lesson's reminder.
 */

export function FingerNumbers({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const button = React.useRef<HTMLButtonElement>(null)
  return (
    <>
      {/* A link in the sentence, though it opens the chart in place: a button. */}
      <button
        ref={button}
        type="button"
        className="finger-numbers-link"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((now) => !now)}
      >
        {children}
      </button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={button}
        label="Finger numbers"
        className="finger-numbers"
      >
        {/* The chart, loaded the first time it opens. */}
        <OnDemand when={open}>
          <FingerChart />
        </OnDemand>
      </Popover>
    </>
  )
}
