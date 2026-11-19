import * as React from 'react'
import {
  ArrowDownToLine,
  AudioWaveform,
  BookOpen,
  ChevronRight,
  Circle,
  CircleOff,
  Film,
  Flame,
  Gauge,
  Hand,
  Music,
  LayoutGrid,
  MoreVertical,
  Palette,
  Piano,
  Settings,
  Square,
  Upload,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import logoUrl from '@/assets/motius-logo.svg'
import { ActionMenu, type MenuAction } from '@/ui/Menu'
import { useMidi } from '@/midi/MidiProvider'
import { useLearningStore } from '@/state/learning-store'
import { panelActions } from '@/state/panel-store'
import { pageActions, usePageStore } from '@/state/page-store'
import { useRecordingStore } from '@/state/recording-store'
import { useCurrentSong } from '@/state/song-store'
import { BACKDROPS, useBackdropStore } from '@/state/backdrop-store'
import { COLOR_THEMES, useThemeStore } from '@/state/theme-store'
import { useViewStore } from '@/state/view-store'
import { findCategory, pagesUnder } from '@/features/areas/areas'
import { LessonAboutButton, LessonsButton } from '@/features/areas/Lessons'
import { OptionsButton } from '@/components/OptionsDrawer'
import { LastTakeButton, RecordButton } from '@/features/recording/RecordControls'
import {
  DemoButton,
  MetronomeToggle,
  ModeTabs,
  StartButton,
  TempoControl,
} from '@/features/learning/ScaleControls'
import {
  SongMetronomeToggle,
  SongModeTabs,
  SongTempoControl,
  SongTransport,
} from '@/features/songs/SongControls'
import { SongSearch } from '@/features/songs/SongSearch'
import { showMySongs } from '@/features/songs/SongPicker'

/**
 * How you are practising, in one row across the top.
 *
 * On the left, the name and one button: the options of the area that is open,
 * which slide in over the workspace. What is being practised used to be spread
 * along the bar as an icon a setting; it is all behind that button now, in
 * words.
 *
 * On the right, how: the mode as three tabs, the tempo as a number with its
 * arrows, the metronome, then the buttons that act — Hear, Record, Start. Past
 * a divider, the utilities that do not change what is being practised — the
 * MIDI readout, the Progress and Settings panels, and the menu, which is also
 * how you move between the dashboard and the areas.
 *
 * The row does not wrap and does not scroll. It folds, and the widths it folds
 * at are written next to the classes that do it, in the stylesheet. Every
 * control is still reachable at 320px; none of them is ever cut in half.
 */
export function TopBar() {
  const topic = useLearningStore((state) => state.topic)
  const page = usePageStore((state) => state.page)
  const area = page === 'area' ? topic : null
  // A lesson that is written plays like an area: shown, walked through, or kept score of.
  const playable = useLearningStore((state) => page === 'lesson' && state.exercise !== null)

  return (
    // A click on the bar's controls leaves focus where it was. They drive what
    // is playing, and the keys that do it too — Space to pause, the computer
    // keyboard as a piano — must keep going to the music after one is clicked,
    // not land on it (and draw its focus ring when Space is next pressed). Tab
    // still reaches every control, and Space and Enter press the one it is on.
    // A field is the exception: clicking into the tempo is to type in it.
    <header
      className="top-bar"
      onMouseDown={(event) => {
        const target = event.target as Element
        if (target.closest('button, [role="radio"], [role="tab"]') && !target.closest('input'))
          event.preventDefault()
      }}
    >
      <div className="top-bar__row">
        <Brand keep={area === null} deep={page === 'category' || page === 'lesson'} />
        {page === 'lesson' && <LessonsButton />}
        {page === 'lesson' && <LessonAboutButton />}
        {area === null && <PageTitle />}
        {area && <OptionsButton />}
        {area === 'songs' && <NowPlaying />}

        <span className="top-bar__spacer" />

        {area && <BackdropMenu className="bar-sm" />}
        {area && <ThemeMenu className="bar-sm" />}

        {area && area !== 'songs' && (
          <>
            <ModeTabs />
            <span className="top-bar__divider bar-sm" aria-hidden />
            <TempoControl className="bar-xs" />
            <MetronomeToggle className="bar-mid" />
            <span className="top-bar__divider bar-sm" aria-hidden />
            <DemoButton />
            <span className="bar-mid top-bar__cluster">
              <RecordButton />
              <LastTakeButton />
            </span>
            <StartButton />
          </>
        )}

        {playable && (
          <>
            <ModeTabs />
            <span className="top-bar__divider bar-sm" aria-hidden />
            <DemoButton />
            <StartButton />
          </>
        )}

        {area === 'songs' && (
          <>
            <SongModeTabs />
            <span className="top-bar__divider bar-sm" aria-hidden />
            <SongTempoControl className="bar-xs" />
            <SongMetronomeToggle className="bar-mid" />
            <span className="top-bar__divider bar-sm" aria-hidden />
            <SongTransport />
            <SongSearch className="bar-roomy" />
          </>
        )}

        <span className="top-bar__divider bar-mid" aria-hidden />
        <Utilities area={area} />
      </div>
    </header>
  )
}

/**
 * The name, which gives way as the bar narrows: the word first, then the mark.
 * The tab already says where you are, and the controls cannot. The dashboard
 * has no controls to make room for, so there it stays whole. A page under the
 * dashboard has the way down to it to show, and on a phone the word gives its
 * room to that: `Practice › Sight-Reading` matters more there than a name the
 * mark already stands for.
 */
function Brand({ keep, deep = false }: { keep: boolean; deep?: boolean }) {
  return (
    <div className={cn('top-bar__brand', !keep && 'bar-mid')}>
      <img className="top-bar__logo" src={logoUrl} alt="" title="Motius" />
      <span className={cn('top-bar__name', !keep && 'bar-full', deep && 'bar-sm')}>Motius</span>
    </div>
  )
}

/**
 * Where you are, off the areas: the dashboard's name, or the way down to the
 * page or the stage that is up — Dashboard, Piano Foundations, Keyboard
 * Layout — each step but the last a way back to it. On a section's stage the
 * trail ends at the section: which lesson is up is said on the stage, in the
 * list of them and over the staff.
 *
 * It is the page's heading. Those pages have none of their own: the bar is the
 * one place a page's name is on every page, and a second, larger one under it
 * was the same word twice over a grid of cards that were the point.
 *
 * Each step back says how far up it is, which is what the stylesheet folds the
 * trail by when the bar is too narrow for the whole way down.
 */
function PageTitle() {
  const categoryId = usePageStore((state) => state.category)
  const path = usePageStore((state) => state.path)
  const category = findCategory(categoryId)
  const way = category ? pagesUnder(category, path).slice(0, 1) : []
  const trail = [
    { label: 'Dashboard', open: pageActions.openDashboard },
    ...(category
      ? [{ label: category.label, open: () => pageActions.openCategory(category) }]
      : []),
    ...way.map((section) => ({
      label: section.label,
      open: () => pageActions.openSection(category!, [section]),
    })),
  ]

  return (
    <nav className="top-bar__trail" aria-label="You are here">
      {trail.map((step, index) =>
        index === trail.length - 1 ? (
          <h1 key={index} className="top-bar__title" aria-current="page">
            {step.label}
          </h1>
        ) : (
          <React.Fragment key={index}>
            <button
              type="button"
              className="top-bar__crumb"
              data-up={trail.length - 1 - index}
              onClick={step.open}
            >
              {step.label}
            </button>
            <ChevronRight size={16} className="top-bar__crumb-mark" aria-hidden />
          </React.Fragment>
        ),
      )}
    </nav>
  )
}

/**
 * Which song is open, in words, beside the button that changes it.
 *
 * The staff shows the notes and nothing on it says whose they are; the name
 * was only in a tooltip and in the options panel. It takes the room the bar
 * has to spare and no more: a long title is cut short rather than pushing a
 * control along, and on a bar too narrow to have the room it is not shown.
 */
function NowPlaying() {
  const song = useCurrentSong()
  // With nothing open it says what to do instead, in the quieter voice: it is
  // a prompt, not a name.
  if (!song)
    return (
      <p className="top-bar__now bar-full">
        <span className="top-bar__now-prompt">Choose a song</span>
      </p>
    )
  return (
    <p className="top-bar__now bar-full" title={song.title}>
      <span className="top-bar__now-verb">Playing</span> {song.title}
    </p>
  )
}

/**
 * The color theme, beside the mode tabs: a palette, and the three themes under
 * it, each with a dot of its own color.
 *
 * On a bar too narrow to hold it, the same choice is in Settings.
 */
function ThemeMenu({ className }: { className?: string }) {
  const theme = useThemeStore((state) => state.theme)
  const setTheme = useThemeStore((state) => state.setTheme)
  return (
    <ActionMenu
      label="Color theme"
      icon={<Palette size={18} aria-hidden />}
      className={className}
      actions={COLOR_THEMES.map((option) => ({
        id: option.id,
        label: option.label,
        icon: <span className="theme-swatch" style={{ backgroundColor: option.swatch }} />,
        checked: theme === option.id,
        onSelect: () => setTheme(option.id),
      }))}
    />
  )
}

/**
 * The film behind the music, beside the color theme: none, or one of the
 * loops. A menu though there is one film so far — the next is a line in the
 * list.
 *
 * On a bar too narrow to hold it, the same choice is in Settings.
 */
function BackdropMenu({ className }: { className?: string }) {
  const backdrop = useBackdropStore((state) => state.backdrop)
  const setBackdrop = useBackdropStore((state) => state.setBackdrop)
  return (
    <ActionMenu
      label="Background video"
      icon={<Film size={18} aria-hidden />}
      // Lit while a film is playing, as the metronome's button is while it ticks.
      className={cn(className, backdrop !== 'none' && 'bar-icon-button--on')}
      actions={[
        {
          id: 'none',
          label: 'None',
          icon: <CircleOff size={16} aria-hidden />,
          checked: backdrop === 'none',
          onSelect: () => setBackdrop('none'),
        },
        ...BACKDROPS.map((option) => ({
          id: option.id,
          label: option.label,
          icon: <Flame size={16} aria-hidden />,
          checked: backdrop === option.id,
          onSelect: () => setBackdrop(option.id),
        })),
      ]}
    />
  )
}

/**
 * What is above the keys: the staff, or falling notes. Beside Settings, on
 * every screen with keys, at every width — the one place it is chosen. The
 * icon is the choice that is up. Songs have only the staff so far.
 */
function StageViewMenu() {
  const view = useViewStore((state) => state.stageView)
  const setView = useViewStore((state) => state.setStageView)
  const songs = useLearningStore((state) => state.topic === 'songs')
  const Icon = view === 'falling' ? ArrowDownToLine : Music
  return (
    <ActionMenu
      label={view === 'falling' ? 'Above the keys: falling notes' : 'Above the keys: staff'}
      icon={<Icon size={18} aria-hidden />}
      actions={[
        {
          id: 'staff',
          label: 'Staff',
          icon: <Music size={16} />,
          checked: view === 'staff',
          onSelect: () => setView('staff'),
        },
        {
          id: 'falling',
          label: 'Falling notes',
          icon: <ArrowDownToLine size={16} />,
          checked: view === 'falling',
          disabled: songs,
          title: songs ? 'Songs keep the staff for now' : undefined,
          onSelect: () => setView('falling'),
        },
      ]}
    />
  )
}

function Utilities({ area }: { area: string | null }) {
  const recording = useRecordingStore((state) => state.status)
  const page = usePageStore((state) => state.page)
  const live = recording === 'recording' || recording === 'counting'
  const progressLabel = area === 'songs' ? 'Hand position' : 'Progress'
  const ProgressIcon = area === 'songs' ? Hand : Gauge

  /*
   * What the bar has folded away at this width, and only that. At full width
   * Progress, Settings and Record are on the bar already, and a menu repeating
   * them is a second place to look for the same thing. `menu-only-*` shows an
   * item exactly where its `bar-*` twin is hidden.
   */
  const folded: MenuAction[] = [
    ...(area && area !== 'songs'
      ? [
          {
            id: 'record',
            label: live ? 'Stop recording' : 'Record what you play',
            icon: live ? <Square size={16} /> : <Circle size={16} />,
            onSelect: () =>
              live ? useRecordingStore.getState().stop() : useRecordingStore.getState().arm(),
            className: 'menu-only-mid',
          },
        ]
      : []),
    ...(area
      ? [
          {
            id: 'progress',
            label: progressLabel,
            icon: <ProgressIcon size={16} />,
            onSelect: () => panelActions.open('session'),
            className: 'menu-only-sm',
          },
        ]
      : []),
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings size={16} />,
      onSelect: () => panelActions.open('settings'),
      className: 'menu-only-sm',
    },
  ].map((action, index) => (index === 0 ? { ...action, separated: true } : action))

  const actions: MenuAction[] = [
    // The way home, which an area has no other of: its bar has no trail, and
    // the bar along the bottom is not there. The places on the dashboard are
    // on the dashboard, and the menu does not list them again.
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutGrid size={16} />,
      checked: page === 'dashboard',
      onSelect: pageActions.openDashboard,
    },
    ...folded,
    {
      id: 'fundamentals',
      label: 'Fundamentals',
      icon: <BookOpen size={16} />,
      onSelect: () => panelActions.open('fundamentals'),
      separated: true,
    },
    {
      id: 'devices',
      label: 'Keyboard & MIDI setup',
      icon: <Piano size={16} />,
      onSelect: () => panelActions.open('devices'),
    },
    {
      id: 'import',
      label: 'Import a song…',
      icon: <Upload size={16} />,
      // Importing is done in the song chooser, which Songs opens on: so this
      // goes there, turned to the player's own songs.
      onSelect: () => {
        showMySongs()
        pageActions.openArea('songs')
      },
    },
  ]

  return (
    <>
      <MidiStatus className="bar-full" />
      {area && (
        <button
          type="button"
          className="bar-icon-button bar-sm"
          aria-label={progressLabel}
          title={progressLabel}
          onClick={() => panelActions.open('session')}
        >
          <ProgressIcon size={18} aria-hidden />
        </button>
      )}
      {(page === 'area' || page === 'lesson') && <StageViewMenu />}
      <button
        type="button"
        className="bar-icon-button bar-sm"
        aria-label="Settings"
        title="Settings"
        onClick={() => panelActions.open('settings')}
      >
        <Settings size={18} aria-hidden />
      </button>
      <ActionMenu label="Menu" icon={<MoreVertical size={18} aria-hidden />} actions={actions} />
    </>
  )
}

/**
 * Whether a MIDI keyboard is connected — a readout, not a button, because it is
 * the thing you check without meaning to. The status sits on the icon rather
 * than beside it: it belongs to the thing.
 */
function MidiStatus({ className }: { className?: string }) {
  const midi = useMidi()
  const connected = midi.connectedPorts.length
  const name = connected === 1 ? (midi.connectedPorts[0]?.name ?? 'Keyboard') : null
  const label =
    connected === 0
      ? 'No MIDI keyboard connected'
      : connected === 1
        ? `${name} connected`
        : `${connected} keyboards connected`

  return (
    <span className={cn('midi-status', className)} role="img" aria-label={label} title={label}>
      <AudioWaveform size={17} aria-hidden />
      <span className="midi-status__dot" data-connected={connected > 0} aria-hidden />
    </span>
  )
}
