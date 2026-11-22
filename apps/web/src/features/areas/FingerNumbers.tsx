import * as React from 'react'
import { Hand } from 'lucide-react'
import { Button } from '@/ui/Button'
import { Popover } from '@/ui/Menu'
import { lazyExport, OnDemand } from '@/ui/OnDemand'

const FingerChart = lazyExport(() => import('@/ui/FingerChart'), 'FingerChart')

/**
 * What the finger numbers are, for a player who does not know them yet: both
 * hands as they rest on the keys, seen from above, each fingertip numbered —
 * 1 the thumb to 5 the little finger, the same on both hands. Opened from a
 * small button beside a lesson's How to play, where the numbers are used.
 */

export function FingerNumbers() {
  const [open, setOpen] = React.useState(false)
  const button = React.useRef<HTMLButtonElement>(null)
  return (
    <>
      <Button
        ref={button}
        variant="text"
        size="sm"
        startIcon={<Hand size={16} aria-hidden />}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((now) => !now)}
      >
        Finger numbers
      </Button>
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
