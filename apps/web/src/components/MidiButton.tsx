import { KeyboardMusic } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useMidi } from '@/midi/MidiProvider'
import { panelActions } from '@/state/panel-store'
import { BarButton } from '@/ui/BarButton'

/**
 * The MIDI keyboard, at a glance and a click away: a keyboard with a light —
 * green and steady when one is connected, flashing when none is — that
 * connects one when pressed (asking the browser, where it has not been asked)
 * and opens Keyboard & MIDI setup, which says what it found.
 */
export function MidiButton({ className }: { className?: string }) {
  const midi = useMidi()
  const connected = midi.connectedPorts.length
  const name = connected === 1 ? (midi.connectedPorts[0]?.name ?? 'Keyboard') : null
  const label =
    connected === 0
      ? 'Connect a MIDI keyboard'
      : connected === 1
        ? `${name} connected`
        : `${connected} keyboards connected`

  return (
    <BarButton
      look="icon"
      className={cn('midi-status', className)}
      label={label}
      icon={
        <>
          <KeyboardMusic size={19} aria-hidden />
          <span className="midi-status__dot" data-connected={connected > 0} aria-hidden />
        </>
      }
      onClick={() => {
        if (midi.canRequest) midi.connect()
        panelActions.open('devices')
      }}
    />
  )
}
