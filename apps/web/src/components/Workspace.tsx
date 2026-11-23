import * as React from 'react'
import { AlertTriangle } from 'lucide-react'
import { ApiClientError } from '@/lib/api'
import { Stage } from '@/components/Stage'
import { OptionsDrawer } from '@/components/OptionsDrawer'
import { KeyboardDock } from '@/features/keyboard/KeyboardDock'
import { SongEngine } from '@/features/songs/SongControls'
import { ScaleEngine } from '@/features/learning/ScaleControls'
import { LessonComplete } from '@/features/areas/LessonResults'
import { LessonIntro, LessonsDrawer, LessonSoon } from '@/features/areas/Lessons'
import { Button } from '@/ui/Button'
import { useLearningStore } from '@/state/learning-store'
import { useCrossingDue } from '@/state/crossing-tips'
import { lazyExport, OnDemand } from '@/ui/OnDemand'

/*
 * The workspace: where the music is played, its own chunk, loaded when an area
 * or a lesson first opens (and fetched early, on the way in). The dashboard
 * does not carry it, so what is added here weighs on this page alone.
 */

// The bar's controls for the music on the stage, loaded with it (`TopBar`); the
// Songs area's search is its own (`TopBar`).
export { OptionsButton } from '@/components/OptionsDrawer'
export { PlayControls } from '@/components/PlayControls'

// How to cross, loaded the first time a lesson's run reaches a crossing.
const CrossingTip = lazyExport(() => import('@/features/areas/CrossingTip'), 'CrossingTip')

export interface WorkspaceProps {
  page: 'area' | 'lesson'
  /** The piano catalog's failure, if it failed: the stage says so instead. */
  catalogueError: unknown
  onRetryCatalogue: () => void
}

export function Workspace({ page, catalogueError, onRetryCatalogue }: WorkspaceProps) {
  const topic = useLearningStore((state) => state.topic)
  const crossingDue = useCrossingDue() !== null
  const ready = useLearningStore((state) => state.ready)
  // The area's builder, or the lesson's section, if this is the first time.
  React.useEffect(ready, [ready])
  return (
    <>
      <div className="workspace" data-lesson={page === 'lesson'}>
        {page === 'area' && <OptionsDrawer />}
        {catalogueError ? (
          <main className="stage stage--message">
            <CatalogueError error={catalogueError} onRetry={onRetryCatalogue} />
          </main>
        ) : (
          <>
            {page === 'lesson' ? (
              <Stage>
                <LessonSoon />
              </Stage>
            ) : (
              <Stage />
            )}
            <KeyboardDock />
          </>
        )}
      </div>

      {/* The engines run for their topic whatever the bar is showing: a song
          must keep playing, and a metronome keep time, while a menu is shut.
          Leaving for the dashboard is leaving the area, and stops them. */}
      {topic !== 'songs' && <ScaleEngine />}
      {page === 'area' && topic === 'songs' && <SongEngine />}

      {page === 'lesson' && (
        <>
          <LessonsDrawer />
          <LessonIntro />
          <LessonComplete />
          <OnDemand when={crossingDue}>
            <CrossingTip />
          </OnDemand>
        </>
      )}
    </>
  )
}

/** What is actually making the sound right now. */
function CatalogueError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const message =
    error instanceof ApiClientError ? error.message : 'The piano catalog could not be loaded.'

  return (
    <div className="flex flex-col items-start gap-3 rounded-[var(--radius-xl)] border border-[var(--ds-danger-border)] bg-[var(--ds-danger-subtle)] p-5">
      <div className="flex items-center gap-2 text-[var(--ds-danger-text)]">
        <AlertTriangle size={18} aria-hidden />
        <h2 className="text-h4">Could not load the pianos</h2>
      </div>
      <p className="text-body-sm text-[var(--ds-fg-secondary)]">{message}</p>
      <p className="text-caption text-[var(--ds-fg-muted)]">
        Check that the Motius API is running — <code className="font-mono">npm run dev</code> starts
        both halves.
      </p>
      <Button size="sm" variant="outlined" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}
