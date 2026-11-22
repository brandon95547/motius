import { create } from 'zustand'

/**
 * Whether a finished lesson's results are put away. They open when a run
 * ends; closed, they stay closed until the next run ends, or until the
 * lesson's introduction opens them again (See results).
 */
export const useResultsStore = create<{ closed: boolean }>(() => ({ closed: false }))

export const resultsActions = {
  close: () => useResultsStore.setState({ closed: true }),
  open: () => useResultsStore.setState({ closed: false }),
}
