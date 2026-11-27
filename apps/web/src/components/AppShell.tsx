import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Instrument } from '@motius/shared'
import { api } from '@/lib/api'
import { useAudio } from '@/audio/AudioProvider'
import { TopBar } from '@/components/TopBar'
import { loadWorkspace } from '@/components/workspace-chunk'
import { BottomNav } from '@/components/BottomNav'
import { useRunHistory } from '@/components/use-run-history'
import { useLessonSettings } from '@/components/use-lesson-settings'
import { RecordingOverlay } from '@/features/recording/RecordControls'
import { KeyboardRangeSync } from '@/features/keyboard/KeyboardRangeSync'
import { Dashboard } from '@/features/areas/Dashboard'
import { lazyExport, OnDemand } from '@/ui/OnDemand'
import { useHandsReminder } from '@/state/hands-reminder'
import { useLearningStore } from '@/state/learning-store'
import { usePanelStore } from '@/state/panel-store'
import { usePageStore, usePageSync } from '@/state/page-store'
import { useRecordingStore } from '@/state/recording-store'
import { useIsAdmin } from '@/state/account-store'
import { preloadSoundEffects } from '@/audio/sound-effects'

/*
 * The signed-in app: the bar, the dashboard or the workspace, and the panels.
 * Each page is its own chunk: the workspace, Progress and the admin's page load
 * the first time they open, and every panel, the song chooser and the theory
 * the first time they are shown. The shell itself stays this size whatever a
 * page adds.
 */
const Workspace = lazyExport(loadWorkspace, 'Workspace')
const SettingsDrawer = lazyExport(() => import('@/components/SettingsDrawer'), 'SettingsDrawer')
const SessionDrawer = lazyExport(() => import('@/components/SessionDrawer'), 'SessionDrawer')
const DeviceSettingsDrawer = lazyExport(
  () => import('@/features/devices/DeviceSettingsDrawer'),
  'DeviceSettingsDrawer',
)
const RecordingReview = lazyExport(
  () => import('@/features/recording/RecordingReview'),
  'RecordingReview',
)
const SongPicker = lazyExport(() => import('@/features/songs/SongPicker'), 'SongPicker')
const SongExport = lazyExport(() => import('@/features/songs/SongExport'), 'SongExport')
const HandsReminder = lazyExport(() => import('@/features/keyboard/HandsReminder'), 'HandsReminder')
const ScaleTheoryDialog = lazyExport(
  () => import('@/features/theory/ScaleTheoryDialog'),
  'ScaleTheoryDialog',
)
const KeyTheoryDrawer = lazyExport(
  () => import('@/features/theory/KeyTheoryDrawer'),
  'KeyTheoryDrawer',
)
const FundamentalsDrawer = lazyExport(
  () => import('@/features/theory/FundamentalsDrawer'),
  'FundamentalsDrawer',
)
const ProgressPage = lazyExport(() => import('@/features/progress/ProgressPage'), 'ProgressPage')
const LessonSettingsPage = lazyExport(
  () => import('@/features/areas/LessonSettingsPage'),
  'LessonSettingsPage',
)

const LAST_INSTRUMENT_KEY = 'motius:instrument'

export function AppShell() {
  const audio = useAudio()
  const panel = usePanelStore((state) => state.panel)
  const remindingHands = useHandsReminder((state) => state.waiting !== null)
  const closePanel = usePanelStore((state) => state.close)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const topic = useLearningStore((state) => state.topic)
  const page = usePageStore((state) => state.page)
  const records = usePageStore(
    (state) => state.page === 'category' && state.category === 'progress',
  )
  const isAdmin = useIsAdmin()
  const reviewing = useRecordingStore((state) => state.status === 'review')
  usePageSync()
  useRunHistory()
  useLessonSettings()
  usePrefetchWorkspace()

  // Every sound effect decoded before it is needed, so none waits on a fetch
  // at the moment it is supposed to land.
  React.useEffect(() => {
    void preloadSoundEffects()
  }, [])

  const catalogue = useQuery({
    queryKey: ['instruments'],
    queryFn: ({ signal }) => api.listInstruments(signal),
    staleTime: Infinity,
  })

  const instruments = React.useMemo(() => catalogue.data?.items ?? [], [catalogue.data])

  const select = React.useCallback(
    (instrument: Instrument) => {
      setSelectedId(instrument.id)
      audio.loadInstrument(instrument)
      try {
        globalThis.localStorage?.setItem(LAST_INSTRUMENT_KEY, instrument.id)
      } catch {
        // Private browsing, or storage disabled. Remembering the last piano is
        // a convenience, and losing it is not worth an error path.
      }
    },
    [audio],
  )

  // Pick a piano as soon as the catalogue arrives: the one the player used
  // last, or the server's default. Choosing nothing would leave a keyboard on
  // screen that makes no sound, which reads as a bug rather than as a prompt.
  React.useEffect(() => {
    if (selectedId || instruments.length === 0) return
    let remembered: string | null = null
    try {
      remembered = globalThis.localStorage?.getItem(LAST_INSTRUMENT_KEY) ?? null
    } catch {
      remembered = null
    }
    const instrument =
      instruments.find((item) => item.id === remembered) ??
      instruments.find((item) => item.id === catalogue.data?.defaultInstrumentId) ??
      instruments[0]
    if (instrument) select(instrument)
  }, [instruments, selectedId, catalogue.data?.defaultInstrumentId, select])

  // The FIRST failure is enough to stop saying "loading". The retry carries on
  // quietly behind it — but a player should not have to wait out the whole
  // retry budget to learn that something is wrong.
  const catalogueFailed = catalogue.isError || catalogue.failureCount > 0

  /*
   * Three bands, top to bottom, filling the screen and never scrolling it: the
   * bar with every setting, the stage with the music, the keys along the
   * bottom. Everything else is a panel over them — opened from the bar, and
   * gone when it is not. The stage and the keys are the workspace, and the
   * area's options slide in over its left edge rather than taking width from it.
   *
   * The dashboard takes the workspace's place: it is where you choose what to
   * play, not where you play it. Under it, where the keys would be, the places
   * to choose between. A section's stage is the workspace too, with the
   * lesson that is up over the staff and its lessons a sheet from the left.
   */
  return (
    <div className="app-shell">
      <TopBar />

      {page !== 'area' && page !== 'lesson' ? (
        <>
          {page === 'admin' && isAdmin ? (
            <React.Suspense fallback={<main className="dashboard" />}>
              <LessonSettingsPage />
            </React.Suspense>
          ) : records ? (
            <React.Suspense fallback={<main className="dashboard" />}>
              <ProgressPage />
            </React.Suspense>
          ) : (
            <Dashboard />
          )}
          <BottomNav />
        </>
      ) : (
        <React.Suspense fallback={<div className="workspace" />}>
          <Workspace
            page={page}
            catalogueError={catalogue.isError ? catalogue.error : null}
            onRetryCatalogue={() => void catalogue.refetch()}
          />
        </React.Suspense>
      )}

      <KeyboardRangeSync />

      {/* Which hand is which, before the notes fall: loaded the first time it is wanted. */}
      <OnDemand when={remindingHands}>
        <HandsReminder />
      </OnDemand>
      <OnDemand when={panel === 'settings'}>
        <SettingsDrawer
          instruments={instruments}
          selectedId={selectedId}
          onSelectInstrument={select}
          catalogueFailed={catalogueFailed}
        />
      </OnDemand>
      <OnDemand when={panel === 'session'}>
        <SessionDrawer />
      </OnDemand>
      {/* The theory of whatever is on the keys: a scale has its own panel, and
          everything else that is in a key shares one. */}
      {topic === 'scales' || topic === 'songs' ? (
        <OnDemand when={panel === 'theory'}>
          <ScaleTheoryDialog open={panel === 'theory'} onClose={closePanel} />
        </OnDemand>
      ) : (
        topic !== 'lesson' && (
          <OnDemand when={panel === 'theory'}>
            <KeyTheoryDrawer open={panel === 'theory'} onClose={closePanel} topic={topic} />
          </OnDemand>
        )
      )}
      <OnDemand when={panel === 'fundamentals'}>
        <FundamentalsDrawer open={panel === 'fundamentals'} onClose={closePanel} />
      </OnDemand>
      <OnDemand when={panel === 'devices'}>
        <DeviceSettingsDrawer open={panel === 'devices'} onClose={closePanel} />
      </OnDemand>
      <OnDemand when={panel === 'library'}>
        <SongPicker open={panel === 'library'} onClose={closePanel} />
      </OnDemand>
      <OnDemand when={panel === 'export'}>
        <SongExport open={panel === 'export'} onClose={closePanel} />
      </OnDemand>
      <RecordingOverlay />
      <OnDemand when={reviewing}>
        <RecordingReview />
      </OnDemand>
    </div>
  )
}

/**
 * The workspace is the next page for nearly every visit to the dashboard, so it
 * is fetched once the dashboard has drawn and the browser is idle: opening an
 * area or a lesson then finds it ready. Not where the player saves data; then
 * it loads when it opens.
 */
function usePrefetchWorkspace() {
  React.useEffect(() => {
    if ((navigator as { connection?: { saveData?: boolean } }).connection?.saveData) return
    const idle = globalThis.requestIdleCallback ?? ((run: () => void) => setTimeout(run, 1))
    const cancel = globalThis.cancelIdleCallback ?? clearTimeout
    // Ahead of time only: opening it loads it again, and says so if it cannot.
    const handle = idle(() => void loadWorkspace().catch(() => {}))
    return () => cancel(handle as number)
  }, [])
}
