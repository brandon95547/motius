import * as React from 'react'
import {
  AlignEndHorizontal,
  Eye,
  BookOpen,
  ChevronRight,
  Circle,
  CircleOff,
  Flame,
  Gauge,
  Hand,
  Music,
  LayoutGrid,
  MoreVertical,
  Piano,
  Square,
  Upload,
  Info,
  GraduationCap,
  LibraryBig,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { BarButton } from '@/ui/BarButton'
import logoUrl from '@/assets/motius-logo.svg'
import { ActionMenu, type MenuAction } from '@/ui/Menu'
import { useLearningStore } from '@/state/learning-store'
import { panelActions } from '@/state/panel-store'
import { pageActions, usePageStore } from '@/state/page-store'
import { useRecordingStore } from '@/state/recording-store'
import { useCurrentSong } from '@/state/song-store'
import { BACKDROPS, useBackdropStore } from '@/state/backdrop-store'
import { COLOR_THEMES, useThemeStore } from '@/state/theme-store'
import { useViewStore } from '@/state/view-store'
import { findCategory, pagesUnder } from '@/lib/outline/outline'
import {
  LessonAboutButton,
  LessonsButton,
  openLessonAbout,
  useHasLessonAbout,
} from '@/features/areas/Lessons'
import { useHere } from '@/features/areas/lesson-here'
import { MidiButton } from '@/components/MidiButton'
import { showMySongs } from '@/features/songs/shelf-store'
import { AccountMenu } from '@/components/AccountMenu'
import { loadWorkspace } from '@/components/workspace-chunk'
import { lazyExport, OnDemand } from '@/ui/OnDemand'

const GoalChip = lazyExport(() => import('@/features/progress/GoalChip'), 'GoalChip')
// Shown only where there is music to play, so they come with the workspace.
const OptionsButton = lazyExport(loadWorkspace, 'OptionsButton')
const SongSearch = lazyExport(loadWorkspace, 'SongSearch')
const PlayControls = lazyExport(loadWorkspace, 'PlayControls')

/**
 * How you are practising, in one row across the top.
 *
 * On the left, the name and one button: the options of the area that is open,
 * which slide in over the workspace. What is being practised used to be spread
 * along the bar as an icon a setting; it is all behind that button now, in
 * words.
 *
 * On the right, how: the mode as three tabs, the tempo as a number with its
 * arrows, the metronome, then the buttons that act — Record, and Play, each
 * kind in a pill of its own. Then the tools that do not change what is being
 * practised — the view, the MIDI keyboard, This run, and the menu, which is
 * also how you move between the dashboard and the areas — and, last, the
 * account: Settings, Progress and signing out.
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
  const onProgress = usePageStore(
    (state) => state.page === 'category' && state.category === 'progress',
  )

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
        <Brand keep={area === null && !playable} deep={page === 'category' || page === 'lesson'} />
        {area === null && <PageTitle lesson={page === 'lesson'} />}
        <React.Suspense fallback={null}>
          {area && <OptionsButton />}
          {area === 'songs' && <NowPlaying />}
          {area === 'songs' && <SongSearch className="bar-roomy" />}
        </React.Suspense>

        <span className="top-bar__spacer" />

        {/* The playing controls: one set, wherever there is music to play. */}
        {(area || playable) && (
          <React.Suspense fallback={null}>
            <PlayControls />
          </React.Suspense>
        )}

        {/* The next badge, where the bar has no music to play — but not on
            Progress, which shows it. */}
        {!area && !playable && !onProgress && (
          <OnDemand when>
            <GoalChip />
          </OnDemand>
        )}
        <Utilities area={area} playing={Boolean(area || playable)} />
        <AccountMenu />
      </div>
    </header>
  )
}

/**
 * The name, and the way home: the mark and the word take you to the dashboard,
 * which is why the trail beside it starts below it. It gives way as the bar
 * narrows: the word first, then the mark. The dashboard has no controls to
 * make room for, so there it stays whole. A page under the dashboard has the
 * way down to it to show, and on a phone the word gives its room to that:
 * `Practice › Sight-Reading` matters more there than a name the mark already
 * stands for. The menu has Dashboard too, on every screen.
 */
function Brand({ keep, deep = false }: { keep: boolean; deep?: boolean }) {
  return (
    <button
      type="button"
      className={cn('top-bar__brand', !keep && 'bar-mid')}
      aria-label="Motius: dashboard"
      onClick={pageActions.openDashboard}
    >
      <img className="top-bar__logo" src={logoUrl} alt="" />
      <span className={cn('top-bar__name', !keep && 'bar-roomy', deep && 'bar-sm')} aria-hidden>
        Motius
      </span>
    </button>
  )
}

/**
 * Where you are, off the areas: the way down to the page or the lesson that is
 * up — Piano Foundations, Keyboard Layout, Two black keys — each step
 * but the last a way back to it. The dashboard is not a step: the logo beside
 * the trail is the way home, so on the dashboard itself the trail is empty and
 * its name is for screen readers only.
 *
 * It is the page's heading. Those pages have none of their own: the bar is the
 * one place a page's name is on every page, and a second, larger one under it
 * was the same word twice over a grid of cards that were the point.
 *
 * Each step back says how far up it is, which is what the stylesheet folds the
 * trail by when the bar is too narrow for the whole way down. The unit is the
 * one step that never folds away: it leads with the books the lessons' last
 * results go back to it by, and when the bar narrows it is the books alone, so
 * the way back to the unit is on the bar wherever a lesson is.
 */
function PageTitle({ lesson }: { lesson: boolean }) {
  const categoryId = usePageStore((state) => state.category)
  const path = usePageStore((state) => state.path)
  const here = useHere()
  const category = findCategory(categoryId)
  const way = category ? pagesUnder(category, path).slice(0, 1) : []
  const up = lesson && here ? here.lessons[here.index] : undefined
  const trail: { label: string; open: () => void; unit?: boolean }[] = [
    ...(category
      ? [{ label: category.label, open: () => pageActions.openCategory(category), unit: true }]
      : []),
    ...way.map((section) => ({
      label: section.label,
      open: () => pageActions.openSection(category!, [section]),
    })),
    ...(up ? [{ label: up.lesson.label, open: () => {} }] : []),
  ]

  if (trail.length === 0) return <h1 className="sr-only">Dashboard</h1>
  return (
    <nav
      className={cn('top-bar__trail', lesson && 'top-bar__trail--lesson')}
      aria-label="You are here"
    >
      {trail.map((step, index) =>
        index === trail.length - 1 ? (
          <h1 key={index} className="top-bar__title" aria-current="page">
            {step.label}
          </h1>
        ) : (
          <React.Fragment key={index}>
            <button
              type="button"
              className={cn('top-bar__crumb', step.unit && 'top-bar__crumb--unit')}
              data-up={trail.length - 1 - index}
              aria-label={step.unit ? step.label : undefined}
              title={step.unit ? step.label : undefined}
              onClick={step.open}
            >
              {step.unit ? (
                <>
                  <LibraryBig size={18} className="top-bar__crumb-icon" aria-hidden />
                  <span className="top-bar__crumb-label">{step.label}</span>
                </>
              ) : (
                step.label
              )}
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
  // With nothing open, what to do instead, in the quieter voice — and the way
  // to do it: the song chooser, at every width.
  if (!song)
    return (
      <button
        type="button"
        className="top-bar__now top-bar__now-prompt"
        onClick={() => panelActions.open('library')}
      >
        Choose a song
      </button>
    )
  return (
    <p className="top-bar__now bar-full" title={song.title}>
      <span className="top-bar__now-verb">Playing</span> {song.title}
    </p>
  )
}

/**
 * How the stage looks, in one menu on every screen: what is above the keys
 * (the staff or falling notes), the see-through hands, the film behind the
 * music and the color theme. Each is the same choice wherever it is made, so
 * it is made in one place, and kept. The menu is always on the bar, at every
 * width: nothing in it needs a second home in Settings.
 */
function ViewMenu() {
  const view = useViewStore((state) => state.stageView)
  const setView = useViewStore((state) => state.setStageView)
  const hands = useViewStore((state) => state.hands)
  const setHands = useViewStore((state) => state.setHands)
  const backdrop = useBackdropStore((state) => state.backdrop)
  const setBackdrop = useBackdropStore((state) => state.setBackdrop)
  const theme = useThemeStore((state) => state.theme)
  const setTheme = useThemeStore((state) => state.setTheme)
  return (
    <ActionMenu
      label="View"
      icon={<Eye size={18} aria-hidden />}
      actions={[
        {
          id: 'staff',
          heading: 'Above the keys',
          label: 'Staff',
          icon: <Music size={16} />,
          checked: view === 'staff',
          onSelect: () => setView('staff'),
        },
        {
          id: 'falling',
          label: 'Falling notes',
          icon: <AlignEndHorizontal size={16} />,
          checked: view === 'falling',
          onSelect: () => setView('falling'),
        },
        {
          id: 'hands',
          label: 'Hands on the keys',
          icon: <Hand size={16} />,
          toggle: true,
          checked: hands,
          title: 'See-through hands playing the fingering, wherever the music has one',
          separated: true,
          onSelect: () => setHands(!hands),
        },
        {
          id: 'none',
          heading: 'Background film',
          label: 'None',
          icon: <CircleOff size={16} aria-hidden />,
          checked: backdrop === 'none',
          separated: true,
          onSelect: () => setBackdrop('none'),
        },
        ...BACKDROPS.map((option) => ({
          id: option.id,
          label: option.label,
          icon: <Flame size={16} aria-hidden />,
          checked: backdrop === option.id,
          onSelect: () => setBackdrop(option.id),
        })),
        ...COLOR_THEMES.map((option, index) => ({
          id: option.id,
          heading: index === 0 ? 'Color theme' : undefined,
          label: option.label,
          icon: <span className="theme-swatch" style={{ backgroundColor: option.swatch }} />,
          checked: theme === option.id,
          separated: index === 0,
          onSelect: () => setTheme(option.id),
        })),
      ]}
    />
  )
}

function Utilities({ area, playing }: { area: string | null; playing: boolean }) {
  const recording = useRecordingStore((state) => state.status)
  const page = usePageStore((state) => state.page)
  const live = recording === 'recording' || recording === 'counting'
  // An exercise's run and what it is; a song has none of its own to show; its
  // fingers are on the keys, and its place is over the music.
  const progress = area !== null && area !== 'songs'
  const about = useHasLessonAbout() && page === 'lesson'

  /*
   * What the bar has folded away at this width, and only that. At full width
   * This run and Record are on the bar already, and a menu repeating
   * them is a second place to look for the same thing. `menu-only-*` shows an
   * item exactly where its `bar-*` twin is hidden.
   */
  const folded: MenuAction[] = [
    ...(area
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
    ...(page === 'lesson'
      ? [
          {
            id: 'lessons',
            label: 'Lessons',
            icon: <GraduationCap size={16} className="lessons-icon" />,
            onSelect: () => panelActions.open('lessons'),
            className: 'menu-only-sm',
          },
        ]
      : []),
    ...(about
      ? [
          {
            id: 'about-lesson',
            label: 'About this lesson',
            icon: <Info size={16} />,
            onSelect: openLessonAbout,
            className: 'menu-only-sm',
          },
        ]
      : []),
    ...(progress
      ? [
          {
            id: 'this-run',
            label: 'This run',
            icon: <Gauge size={16} />,
            onSelect: () => panelActions.open('session'),
            className: 'menu-only-sm',
          },
        ]
      : []),
  ].map((action, index) => (index === 0 ? { ...action, separated: true } : action))

  const actions: MenuAction[] = [
    ...folded,
    // The way home, on every screen, beside the logo that is one too: a name
    // to read in a menu is easier to find than a mark to know. The places on
    // the dashboard are on the dashboard, and the menu does not list them again.
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutGrid size={16} />,
      checked: page === 'dashboard',
      onSelect: pageActions.openDashboard,
      separated: true,
    },
    {
      id: 'fundamentals',
      label: 'Fundamentals',
      icon: <BookOpen size={16} />,
      onSelect: () => panelActions.open('fundamentals'),
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
    // The tools, in one pill: how the stage looks, the keyboard, what the
    // lesson asks, this run, and the rest in the menu. Settings is the
    // account's, beside it.
    <div className="bar-group bar-group--tools">
      <ViewMenu />
      {/* Beside the metronome where there is music to play; here, where there is none. */}
      {!playing && <MidiButton className="bar-mid" />}
      {page === 'lesson' && <LessonsButton className="bar-sm" />}
      {page === 'lesson' && <LessonAboutButton className="bar-sm" />}
      {progress && (
        <BarButton
          look="icon"
          label="This run"
          className="bar-sm"
          onClick={() => panelActions.open('session')}
          icon={<Gauge size={18} aria-hidden />}
        />
      )}
      <ActionMenu label="Menu" icon={<MoreVertical size={18} aria-hidden />} actions={actions} />
    </div>
  )
}
