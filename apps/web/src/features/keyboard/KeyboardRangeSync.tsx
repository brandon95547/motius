import * as React from 'react'
import { useMidi } from '@/midi/MidiProvider'
import { useLearningStore } from '@/state/learning-store'

/**
 * Tells the exercises which keys the player actually has.
 *
 * So that an exercise is placed where the book prints it when the keyboard
 * reaches that far: A major in contrary motion goes down to the A at the very
 * bottom of an 88, which a 61-key instrument does not have. With nothing
 * plugged in it is a 61-key instrument's: every exercise then fits the smallest
 * keyboard most players own, and the keyboard on screen shows at least that.
 */
export function KeyboardRangeSync() {
  const { connectedPorts } = useMidi()
  const low = Math.min(...connectedPorts.flatMap((port) => port.device?.config.range.low ?? []))
  const high = Math.max(...connectedPorts.flatMap((port) => port.device?.config.range.high ?? []))
  const setPlayableRange = useLearningStore((state) => state.setPlayableRange)
  React.useEffect(() => {
    setPlayableRange(Number.isFinite(low) && Number.isFinite(high) ? { low, high } : null)
  }, [low, high, setPlayableRange])
  return null
}
