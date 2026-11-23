/**
 * A yes-or-no the player chose, kept on this device: whether a reminder or a
 * tip shows next time. Unset is yes, so a new device shows them all; storage
 * off keeps the choice for this session only.
 */
export function keptShow(key: string): boolean {
  try {
    return globalThis.localStorage?.getItem(key) !== 'true'
  } catch {
    return true
  }
}

export function keepShow(key: string, show: boolean) {
  try {
    if (show) globalThis.localStorage?.removeItem(key)
    else globalThis.localStorage?.setItem(key, 'true')
  } catch {
    // Storage off: the choice holds for this session.
  }
}
