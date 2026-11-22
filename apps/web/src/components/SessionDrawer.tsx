import { Drawer } from '@/ui/Drawer'
import { useLearningStore } from '@/state/learning-store'
import { usePanelStore } from '@/state/panel-store'
import { SessionPanelContent } from '@/features/learning/LearningDashboard'

/**
 * Where the run is, how it is going, and what the material is — the cards that
 * used to sit under the keyboard. An exercise's: a song shows its fingers on
 * the keys and its place over the music, and has no panel of its own.
 */
export function SessionDrawer() {
  const open = usePanelStore((state) => state.panel === 'session')
  const close = usePanelStore((state) => state.close)
  const title = useLearningStore((state) => state.exercise?.title)

  return (
    <Drawer open={open} onClose={close} title="This run" description={title}>
      <SessionPanelContent />
    </Drawer>
  )
}
