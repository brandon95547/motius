import { create } from 'zustand'

/**
 * The falling notes' own state: whether they are paused, the section looped,
 * and where in the music each step was played.
 *
 * The position itself — the beat at the keys right now — changes every frame,
 * so it is not here, where a change would re-render whatever reads it. It is
 * `fallingClock.now`, which the field writes and the few things that need it
 * (setting a loop's ends) read when they need it.
 *
 * Played positions are kept in beats, not in clock time: with a pause or a
 * drag through the music in the middle of a run, when a step was due is only
 * known on the music's own clock.
 */

/** A stretch of the music, in beats, played over and over: from its start to its end. */
export interface Loop {
  readonly from: number
  readonly to: number
}

interface FallingState {
  paused: boolean
  loop: Loop | null
  /** Step to the beat it was played on, in a run that keeps time (Practice). */
  playedAt: Readonly<Record<number, number>>
  setPaused: (paused: boolean) => void
  setLoop: (loop: Loop | null) => void
  markPlayed: (step: number, beat: number) => void
  /** A new run, or the music moved: nothing has been played yet from here. */
  clearPlayed: () => void
}

export const useFallingStore = create<FallingState>((set) => ({
  paused: false,
  loop: null,
  playedAt: {},
  setPaused: (paused) => set({ paused }),
  setLoop: (loop) => set({ loop }),
  markPlayed: (step, beat) => set((state) => ({ playedAt: { ...state.playedAt, [step]: beat } })),
  clearPlayed: () => set({ playedAt: {} }),
}))

/** The beat at the keys right now. Written by the field every frame; never rendered. */
export const fallingClock = { now: 0 }
