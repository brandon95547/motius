import { create } from 'zustand'

/**
 * The moving picture behind the music, when there is one.
 *
 * A short film on a loop, laid faintly over the stage so the stage's own color
 * stays the stronger of the two — a fire in the room, not a film to watch.
 * Off unless asked for, and the choice is kept like the color theme's, in this
 * browser.
 *
 * A list from the start, though it has one film in it: adding another is an
 * entry here and a file in `public/backdrops`.
 */
export const BACKDROPS = [
  { id: 'fireplace', label: 'Fireplace', file: 'fireplace.mp4', poster: 'fireplace-poster.webp' },
] as const

export type Backdrop = (typeof BACKDROPS)[number]['id']
/** What is chosen: one of the films, or nothing. */
export type BackdropChoice = Backdrop | 'none'

const STORAGE_KEY = 'motius.backdrop'

export const isBackdropChoice = (value: unknown): value is BackdropChoice =>
  value === 'none' || BACKDROPS.some((backdrop) => backdrop.id === value)

/** Where a film is served from. Under the app's base, like the built-in songs. */
const backdropOf = (id: Backdrop) => BACKDROPS.find((backdrop) => backdrop.id === id)!

export const backdropUrl = (id: Backdrop): string =>
  `${import.meta.env.BASE_URL}backdrops/${backdropOf(id).file}`

/** A still of it, shown until the film can play. */
export const backdropPosterUrl = (id: Backdrop): string =>
  `${import.meta.env.BASE_URL}backdrops/${backdropOf(id).poster}`

function stored(): BackdropChoice {
  try {
    const value = globalThis.localStorage?.getItem(STORAGE_KEY)
    return isBackdropChoice(value) ? value : 'none'
  } catch {
    return 'none'
  }
}

interface BackdropState {
  backdrop: BackdropChoice
  setBackdrop: (backdrop: BackdropChoice) => void
}

export const useBackdropStore = create<BackdropState>((set) => ({
  backdrop: stored(),
  setBackdrop: (backdrop) => {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, backdrop)
    } catch {
      // Private browsing. The choice holds for this session.
    }
    set({ backdrop })
  },
}))
