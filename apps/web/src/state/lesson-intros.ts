/**
 * The lessons whose introduction the player has said not to show again, by
 * address, kept on this device.
 */
const HIDDEN_INTROS_KEY = 'motius.lesson-intros-hidden'

function hiddenIntros(): string[] {
  try {
    const stored = JSON.parse(globalThis.localStorage?.getItem(HIDDEN_INTROS_KEY) ?? '[]')
    return Array.isArray(stored) ? stored.filter((entry) => typeof entry === 'string') : []
  } catch {
    return []
  }
}

export const introHidden = (key: string) => hiddenIntros().includes(key)

/** Keeps the player's answer to Show next time for one lesson. */
export function showIntroNextTime(key: string, show: boolean) {
  const others = hiddenIntros().filter((entry) => entry !== key)
  try {
    globalThis.localStorage?.setItem(
      HIDDEN_INTROS_KEY,
      JSON.stringify(show ? others : [...others, key]),
    )
  } catch {
    // Storage off: it shows again next time, which is what the box says by default.
  }
}

/** Every introduction shows again, as for a new player: part of starting over. */
export function showAllIntros() {
  try {
    globalThis.localStorage?.removeItem(HIDDEN_INTROS_KEY)
  } catch {
    // Storage off: nothing was kept to forget.
  }
}
