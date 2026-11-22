import { create } from 'zustand'
import { api } from '@/lib/api'

/**
 * What the player is aiming for: the weekly goal they chose and the badges
 * they have seen unlock, kept with their account. What they have earned is
 * worked out from their runs by `useAchievements` (`achievements.ts`), which is
 * loaded only where it is shown.
 */
interface GoalsState {
  weeklyGoal: number | null
  seenBadges: ReadonlySet<string>
  loaded: boolean
  load: () => Promise<void>
  setWeeklyGoal: (goal: number | null) => Promise<void>
  /** Notes badges as seen, so each unlock is shown once. */
  see: (ids: readonly string[]) => Promise<void>
  /** Forgets them, on sign-out or a reset (which the server mirrors). */
  clear: () => void
}

export const useGoalsStore = create<GoalsState>((set, get) => ({
  weeklyGoal: null,
  seenBadges: new Set(),
  loaded: false,

  load: async () => {
    try {
      const goals = await api.goals()
      set({ weeklyGoal: goals.weeklyGoal, seenBadges: new Set(goals.seenBadges), loaded: true })
    } catch (error) {
      // Without them the badges still show; only the reveals and the goal wait.
      console.error('Motius could not load the goals.', error)
    }
  },

  setWeeklyGoal: async (goal) => {
    const goals = await api.setWeeklyGoal(goal)
    set({ weeklyGoal: goals.weeklyGoal })
  },

  see: async (ids) => {
    const fresh = ids.filter((id) => !get().seenBadges.has(id))
    if (fresh.length === 0) return
    // Seen at once here, so a reveal is not shown twice while the save is on its way.
    set({ seenBadges: new Set([...get().seenBadges, ...fresh]) })
    try {
      await api.seeBadges(fresh)
    } catch (error) {
      console.error('Motius could not save the badges seen.', error)
    }
  },

  clear: () => set({ weeklyGoal: null, seenBadges: new Set(), loaded: false }),
}))
