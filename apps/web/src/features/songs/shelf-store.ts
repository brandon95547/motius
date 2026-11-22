import { create } from 'zustand'
import type { SongGenre, SongMood } from '@motius/shared'

/** What the list is showing: everything, one genre, or the player's own. */
export type Shelf = 'all' | SongGenre | 'mine'

// Outside the component, so the menu's Import can turn to the player's own
// songs before the chooser is on screen.
export const useShelfStore = create<{ shelf: Shelf; mood: SongMood | null; key: string | null }>(
  () => ({
    shelf: 'all',
    // The one mood the shelf is narrowed to, or none: all of them.
    mood: null,
    // The one key the songs are narrowed to, as `keyName` says it, or none.
    // Kept from shelf to shelf, where a mood is not: a mood was a way of
    // looking at one shelf, and a key is what the player can play.
    key: null,
  }),
)

/** Turns the chooser to the player's own songs, where importing happens. */
export const showMySongs = () => useShelfStore.setState({ shelf: 'mine', mood: null })
