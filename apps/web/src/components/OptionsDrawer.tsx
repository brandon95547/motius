import * as React from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { BarButton } from '@/ui/BarButton'
import { Drawer } from '@/ui/Drawer'
import { lazyExport } from '@/ui/OnDemand'
import { useLearningStore, type LearningTopic } from '@/state/learning-store'
import { panelActions, usePanelStore } from '@/state/panel-store'
import { useCurrentSong, useSongStore } from '@/state/song-store'
import { ScaleOptions } from '@/features/learning/ScaleControls'
import { SongOptions } from '@/features/songs/SongControls'

// The areas' options, each loaded the first time its panel opens. Scales' and
// songs' are loaded with the app: their engines share a module with them.
const ChordControls = () => import('@/features/learning/ChordControls')
const ChordOptions = lazyExport(ChordControls, 'ChordOptions')
const ArpeggioOptions = lazyExport(ChordControls, 'ArpeggioOptions')
const ProgressionOptions = lazyExport(
  () => import('@/features/learning/ProgressionControls'),
  'ProgressionOptions',
)
const RoutineControls = () => import('@/features/learning/RoutineControls')
const ExerciseOptions = lazyExport(RoutineControls, 'ExerciseOptions')
const FingeringOptions = lazyExport(RoutineControls, 'FingeringOptions')

const TRIGGER_ID = 'bar-options'
const PANEL_ID = 'options-panel'

/** What the panel is called, area by area — and the bar's button with it. */
const TITLES: Record<LearningTopic, string> = {
  scales: 'Scale Options',
  chords: 'Chord Options',
  arpeggios: 'Arpeggio Options',
  progressions: 'Progression Options',
  exercises: 'Exercise Options',
  fingering: 'Exercise Options',
  songs: 'Song Options',
  // A lesson's stage has no options of its own; the panel is not on it.
  lesson: 'Lesson',
}

const closeOptions = () => {
  if (usePanelStore.getState().panel === 'options') panelActions.close()
}

/**
 * The bar's way into the area's options: the one control on its left.
 *
 * Filled while the panel is open, so the button that opened it is plainly the
 * button that closes it.
 */
export function OptionsButton() {
  const open = usePanelStore((state) => state.panel === 'options')
  const topic = useLearningStore((state) => state.topic)
  const exercise = useLearningStore((state) => state.exercise?.title)
  const song = useCurrentSong()?.title
  // What the options are set to, where there is a word for it: a tooltip that
  // only repeated the icon would be no use to anyone who had read the icon.
  const set = topic === 'songs' ? song : exercise
  const label = set ? `${TITLES[topic]}: ${set}` : TITLES[topic]

  return (
    <BarButton
      look="options"
      id={TRIGGER_ID}
      label={label}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={open ? PANEL_ID : undefined}
      onClick={() => (open ? panelActions.close() : panelActions.open('options'))}
      icon={<SlidersHorizontal size={18} aria-hidden />}
    />
  )
}

/**
 * The options of the area that is open, in a panel that slides in from the
 * left, under the button that opens it.
 *
 * Over the workspace, not beside it: the staff and the keys keep their width,
 * so a scale does not re-lay itself out every time the panel is opened. And
 * with no scrim, because the point of changing a setting here is to watch it
 * land on the staff — which is also why this is not a modal, and does not trap
 * the Tab key the way the app's other panels do.
 *
 * The Bible anchors a detail panel to the right and turns it into a bottom
 * sheet on a phone. This one is on the left at every width on purpose: it
 * belongs to the button above it, the right is where Settings opens, and a
 * bottom sheet would cover the keys — the one thing a player needs to reach
 * while trying a setting out.
 *
 * It closes itself when it would be in the way: on a press anywhere on the
 * workspace, on Escape, when the area changes, and when a run or a song starts,
 * since the first bars of the staff are underneath it.
 */
export function OptionsDrawer() {
  const open = usePanelStore((state) => state.panel === 'options')
  const topic = useLearningStore((state) => state.topic)

  const close = React.useCallback(() => {
    // Focus goes back to the button only if it was in the panel: a press
    // somewhere else has already put it where the player meant.
    if (document.getElementById(PANEL_ID)?.contains(document.activeElement))
      document.getElementById(TRIGGER_ID)?.focus()
    closeOptions()
  }, [])

  // Another area's options are another panel. Leaving this one — for the
  // dashboard too, which unmounts it — puts it away.
  React.useEffect(() => closeOptions, [topic])

  const running = useLearningStore((state) => state.session.status === 'running')
  const songGoing = useSongStore((state) => state.playing || state.learning)
  React.useEffect(() => {
    if (running || songGoing) closeOptions()
  }, [running, songGoing])

  return (
    <Drawer
      open={open}
      onClose={close}
      title={TITLES[topic]}
      docked={{ className: 'options-drawer', id: PANEL_ID, within: '.top-bar' }}
    >
      <React.Suspense fallback={null}>
        {topic === 'scales' ? (
          <ScaleOptions />
        ) : topic === 'chords' ? (
          <ChordOptions />
        ) : topic === 'arpeggios' ? (
          <ArpeggioOptions />
        ) : topic === 'progressions' ? (
          <ProgressionOptions />
        ) : topic === 'exercises' ? (
          <ExerciseOptions />
        ) : topic === 'fingering' ? (
          <FingeringOptions />
        ) : (
          <SongOptions />
        )}
      </React.Suspense>
    </Drawer>
  )
}
