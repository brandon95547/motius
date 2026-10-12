import * as React from 'react'
import { create } from 'zustand'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Loader2, Search, Trash2, Upload } from 'lucide-react'
import {
  SONG_GENRES,
  SONG_MOODS,
  type SetSongCategoryInput,
  type Song,
  type SongCategoryChoice,
  type SongGenre,
  type SongMood,
} from '@sonara/shared'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { Button, IconButton } from '@/ui/Button'
import { controlShell, FilterChip, Select } from '@/ui/Controls'
import { Dialog } from '@/ui/Dialog'
import { useLearningStore } from '@/state/learning-store'
import { useSongStore } from '@/state/song-store'
import { SONG_CATALOG, catalogSongId, loadCatalogSong, type CatalogSong } from './catalog'
import { readSong, type ImportFailure, type ImportResult } from './read-song'
import { shortKey, songKey, sortKeys } from './song-keys'
import { fold } from './song-search'

/**
 * Choosing a song: the ones that come with Sonara, by genre and by mood, and
 * the player's own, with the way to import more.
 *
 * A dialog, and the first thing the Songs area shows, because the area has
 * nothing to put on the staff until one is chosen. It is the only place a song
 * is chosen from: the built-in pieces and the imported ones are one list to
 * the person looking for something to play, and two places to look would be a
 * fact about where the files are kept.
 *
 * The genres are the shelves, down the side, and a song is on one. The moods
 * divide every genre the same way, so they are one choice over the list rather
 * than a list of their own under each genre: all of them, or one at a time.
 * With a genre chosen and all its moods showing, the list is laid out mood by
 * mood, and a song is under each mood it has, so one that is two of them is
 * listed twice.
 *
 * Over the moods are the keys, a button for each one a song is in, for the
 * player who would rather stay in the keys their hands know. The moods are a
 * dropdown under them and the keys are the row, because there are more keys
 * than moods and a key is two letters where a mood is three words: eighteen
 * keys fit where eight moods did.
 *
 * Which genre a piece is in and which moods it has are opinions. The catalog
 * has them for every piece; "Edit categories" turns each row into those two
 * choices, and a change is kept by the server, so it is made once for everyone
 * rather than in one browser.
 *
 * The import is deliberately format-sniffing rather than extension-trusting.
 * A `.mid` that is really XML, or a `.xml` that is really a MIDI file, are both
 * things that happen when files come out of other programs, and the first four
 * bytes settle it in a way a filename never can.
 */

/** What the list is showing: everything, one genre, or the player's own. */
type Shelf = 'all' | SongGenre | 'mine'

/** A built-in song as it is filed now: by the catalog, or by a change to it. */
interface Placed {
  readonly entry: CatalogSong
  readonly genre: SongGenre
  readonly moods: readonly SongMood[]
}

/** A stretch of the list under one heading. */
interface Section {
  readonly id: string
  readonly title: string
  readonly songs: readonly Placed[]
}

/** The key the changed songs are kept under in the query cache. */
const MOVED = ['song-categories'] as const
type Moves = { items: SongCategoryChoice[] }

// Outside the component, so the menu's Import can turn to the player's own
// songs before the chooser is on screen.
const useShelfStore = create<{ shelf: Shelf; mood: SongMood | null; key: string | null }>(() => ({
  shelf: 'all',
  // The one mood the shelf is narrowed to, or none: all of them.
  mood: null,
  // The one key the songs are narrowed to, as `keyName` says it, or none.
  // Kept from shelf to shelf, where a mood is not: a mood was a way of
  // looking at one shelf, and a key is what the player can play.
  key: null,
}))

/** Turns the chooser to the player's own songs, where importing happens. */
export const showMySongs = () => useShelfStore.setState({ shelf: 'mine', mood: null })

/** Named for what the file is, not for what it is closest to. */
const SOURCE_LABELS: Record<string, string> = {
  midi: 'MIDI',
  musicxml: 'MusicXML',
  musescore: 'MuseScore',
}

/** A piece and which score of it, for naming the controls of one row. */
const nameOf = (entry: CatalogSong) => `${entry.title}${entry.edition ? `, ${entry.edition}` : ''}`

const row = [
  'flex w-full items-center gap-3 rounded-[var(--radius-md)] border p-2.5 text-left',
  'transition-[background-color,border-color] duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)]',
].join(' ')
const rowIdle =
  'border-[var(--ds-border-subtle)] hover:border-[var(--ds-border-strong)] hover:bg-[var(--ds-layer-hover)]'
const rowCurrent = 'border-[var(--ds-accent-border)] bg-[var(--ds-layer-selected)]'
const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-focus-ring)]'

export function SongPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const library = useSongStore((state) => state.library)
  const builtIn = useSongStore((state) => state.builtIn)
  const currentId = useSongStore((state) => state.currentId)
  const { add, open: openSong, openBuiltIn, remove } = useSongStore.getState()
  const shelf = useShelfStore((state) => state.shelf)
  const chosenMood = useShelfStore((state) => state.mood)
  const chosenKey = useShelfStore((state) => state.key)
  const [query, setQuery] = React.useState('')
  /** The built-in song being fetched, by its catalog id. */
  const [loading, setLoading] = React.useState<string | null>(null)
  const [failed, setFailed] = React.useState<CatalogSong | null>(null)
  const [importError, setImportError] = React.useState<ImportResult | null>(null)
  const request = React.useRef<AbortController | null>(null)
  /** Whether the rows are choices of genre and mood rather than songs to open. */
  const [editing, setEditing] = React.useState(false)
  /** The song whose moods are laid out to choose from, by its catalog id. */
  const [choosing, setChoosing] = React.useState<string | null>(null)
  const [moveFailed, setMoveFailed] = React.useState<CatalogSong | null>(null)

  /*
   * What each song has been changed to, over what the catalog says of it.
   *
   * Asked of the server, which keeps the changes. Without an answer — no
   * server, or nothing changed — every song is as it came, and the chooser is
   * as usable as it was.
   */
  const queryClient = useQueryClient()
  const moved = useQuery({
    queryKey: MOVED,
    queryFn: ({ signal }) => api.listSongCategories(signal),
    staleTime: Infinity,
    enabled: open,
  })
  const placed = React.useMemo<readonly Placed[]>(() => {
    const changes = new Map(moved.data?.items.map((item) => [item.songId, item]))
    return SONG_CATALOG.map((entry) => {
      const change = changes.get(entry.id)
      return { entry, genre: change?.genre ?? entry.genre, moods: change?.moods ?? entry.moods }
    })
  }, [moved.data])
  const move = useMutation({
    mutationFn: ({ entry, change }: { entry: CatalogSong; change: SetSongCategoryInput }) =>
      api.setSongCategory(entry.id, change),
    // Where it is going at once, and back as it was if the server refuses.
    onMutate: async ({ entry, change }) => {
      setMoveFailed(null)
      await queryClient.cancelQueries({ queryKey: MOVED })
      const before = queryClient.getQueryData<Moves>(MOVED)
      const earlier = before?.items.find((item) => item.songId === entry.id)
      queryClient.setQueryData<Moves>(MOVED, {
        items: [
          ...(before?.items ?? []).filter((item) => item.songId !== entry.id),
          {
            songId: entry.id,
            genre: change.genre ?? earlier?.genre ?? null,
            moods: change.moods ?? earlier?.moods ?? null,
          },
        ],
      })
      return { before }
    },
    onError: (_error, { entry }, context) => {
      queryClient.setQueryData(MOVED, context?.before)
      setMoveFailed(entry)
    },
  })

  // Shut, it forgets what was typed and what went wrong: the next time it
  // opens is another errand. The shelf is kept, since that is where they were.
  React.useEffect(() => {
    if (open) return
    request.current?.abort()
    setQuery('')
    setLoading(null)
    setFailed(null)
    setImportError(null)
    setEditing(false)
    setChoosing(null)
    setMoveFailed(null)
  }, [open])

  const chooseBuiltIn = async (entry: CatalogSong) => {
    const held = builtIn.find((song) => song.id === catalogSongId(entry))
    if (held) {
      openBuiltIn(held)
      onClose()
      return
    }
    // Choosing another while one is on its way is changing your mind.
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setFailed(null)
    setLoading(entry.id)
    try {
      const song = await loadCatalogSong(
        entry,
        controller.signal,
        useLearningStore.getState().fingeringSystem,
      )
      if (controller.signal.aborted) return
      openBuiltIn(song)
      onClose()
    } catch {
      if (!controller.signal.aborted) setFailed(entry)
    } finally {
      if (request.current === controller) setLoading(null)
    }
  }

  const onFiles = async (list: FileList | null) => {
    // Copied out before the first await. A FileList is a live view of the
    // input, and the input is cleared the moment this returns — so reading it
    // again after an await finds it empty, and the dialog never closes.
    const files = [...(list ?? [])]
    if (files.length === 0) return

    setImportError(null)
    let imported = 0
    for (const file of files) {
      const result = await readSong(file, {
        fingering: useLearningStore.getState().fingeringSystem,
      })
      if ('song' in result) {
        add(result.song)
        imported++
      } else {
        setImportError(result)
      }
    }
    // Out of the way once there is something to play. A file we could not read
    // keeps the dialog open, with the reason on screen.
    if (imported > 0) onClose()
  }

  const sought = fold(query.trim())
  const searching = sought.length > 0
  // A search looks everywhere: someone typing a name is not thinking about
  // which genre it is in, or which mood it has.
  const genre = searching || shelf === 'all' || shelf === 'mine' ? null : shelf
  const mood = searching ? null : chosenMood
  const key = searching ? null : chosenKey
  const browsing = !searching && shelf !== 'mine'
  /** The songs of the shelf, before a mood or a key narrows them. */
  const shelved = placed.filter((song) => genre === null || song.genre === genre)
  /** The shelf in the key chosen: what the moods count. */
  const keyed = shelved.filter((song) => key === null || song.entry.key === key)
  const found = keyed.filter(
    ({ entry }) =>
      !searching ||
      fold(`${entry.title} ${entry.composer} ${entry.edition ?? ''}`).includes(sought),
  )
  // The song whose moods are being chosen stays while they are: switched off
  // the mood it was found under, it would otherwise go from under the pointer.
  const wanted = (song: Placed) =>
    mood === null || song.moods.includes(mood) || (editing && song.entry.id === choosing)
  // One genre is laid out mood by mood. Everything is laid out genre by genre,
  // and so is a genre being edited: each song once, with its own two choices.
  const sections: readonly Section[] = (
    genre !== null && !editing
      ? SONG_MOODS.filter((each) => mood === null || each.id === mood).map((each) => ({
          id: each.id,
          title: each.label,
          songs: found.filter((song) => song.moods.includes(each.id)),
        }))
      : SONG_GENRES.map((entry) => ({
          id: entry.id,
          title: entry.label,
          songs: found.filter((song) => song.genre === entry.id && wanted(song)),
        }))
  ).filter((section) => section.songs.length > 0)
  // The player's own have a key and no mood: under All songs they are listed
  // until a mood is chosen, the ones in the key that is. Their own shelf has
  // all of them, whatever was chosen elsewhere.
  const ownListed = shelf === 'all' && mood === null ? library : []
  const mine = searching
    ? library.filter((song) => fold(song.title).includes(sought))
    : shelf === 'mine'
      ? library
      : ownListed.filter((song) => key === null || songKey(song) === key)
  const showMine = searching ? mine.length > 0 : shelf === 'mine' || mine.length > 0
  const nothing = searching && sections.length === 0 && mine.length === 0
  // The player's own in a key are something there, though no built-in song is in it.
  const empty = browsing && sections.length === 0 && mine.length === 0
  const listed =
    new Set(sections.flatMap((section) => section.songs.map((song) => song.entry.id))).size +
    (showMine ? mine.length : 0)

  // Every key a song is in, the player's own included, and what each would
  // show: the shelf in the mood chosen.
  const keys = React.useMemo(
    () =>
      sortKeys([
        ...SONG_CATALOG.map((entry) => entry.key),
        ...library.flatMap((song) => songKey(song) ?? []),
      ]),
    [library],
  )
  const inMood = shelved.filter((song) => mood === null || song.moods.includes(mood))
  // On a phone the keys are one line that scrolls, and the one chosen can be
  // off the end of it when the chooser opens on a key chosen earlier.
  const keyRow = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!open || !browsing) return
    keyRow.current
      ?.querySelector<HTMLElement>('[aria-pressed="true"]')
      ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [open, browsing, key])
  const inKey = (name: string) =>
    inMood.filter((song) => song.entry.key === name).length +
    ownListed.filter((song) => songKey(song) === name).length

  const shelves: readonly { id: Shelf; label: string; count: number }[] = [
    { id: 'all', label: 'All songs', count: SONG_CATALOG.length + library.length },
    ...SONG_GENRES.map((entry) => ({
      id: entry.id,
      label: entry.label,
      count: placed.filter((song) => song.genre === entry.id).length,
    })),
    { id: 'mine', label: 'My songs', count: library.length },
  ]

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Choose a song"
      description="Pick a piece to learn, or import one of your own."
      size="xl"
      tall
      flush
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <p className="text-caption text-[var(--ds-fg-muted)]">
            MusicXML · MuseScore · MIDI. Imported songs stay on this device.
          </p>
          <div className="flex items-center gap-2.5 coarse:gap-3">
            {/* The rows become choices of genre and mood, and back again. */}
            <Button
              size="sm"
              variant={editing ? 'tonal' : 'text'}
              aria-pressed={editing}
              onClick={() => {
                setEditing((on) => !on)
                setChoosing(null)
              }}
            >
              {editing ? 'Done' : 'Edit categories'}
            </Button>
            <ImportButton onFiles={onFiles} />
          </div>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* A column of shelves beside the list, and a row of them above it
            where there is no room for a column. */}
        <div className="flex shrink-0 flex-col gap-3 border-b border-[var(--ds-border-subtle)] py-4 md:w-56 md:border-r md:border-b-0">
          <div className="relative px-6 md:pr-4">
            <Search
              size={15}
              className="pointer-events-none absolute top-1/2 left-9 -translate-y-1/2 text-[var(--ds-fg-muted)]"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search songs"
              aria-label="Search songs"
              className={cn(
                controlShell(),
                // Sixteen pixels where a finger types: smaller, and a phone zooms
                // the page in to the field.
                'h-9 rounded-[var(--radius-md)] pr-3 pl-9 text-body text-[var(--ds-fg)] placeholder:text-[var(--ds-fg-muted)] md:text-body-sm',
              )}
            />
          </div>
          <div
            role="group"
            aria-label="Show"
            className="scrollbar-none flex gap-1.5 overflow-x-auto px-6 md:min-h-0 md:flex-1 md:flex-col md:gap-0.5 md:overflow-x-visible md:overflow-y-auto md:pr-4"
          >
            {shelves.map((entry) => {
              const on = !searching && shelf === entry.id
              // A genre nothing is in yet is there to be seen, and filled from
              // Edit categories; there is nothing in it to go and look at. The
              // one being looked at stays, though its last song has just left.
              const vacant =
                entry.count === 0 && entry.id !== 'all' && entry.id !== 'mine' && shelf !== entry.id
              return (
                <button
                  key={entry.id}
                  type="button"
                  aria-pressed={on}
                  disabled={vacant}
                  title={vacant ? 'No songs in this genre yet' : undefined}
                  onClick={() => {
                    setQuery('')
                    setChoosing(null)
                    // The whole shelf: the mood chosen was a way of looking at
                    // the one before.
                    useShelfStore.setState({ shelf: entry.id, mood: null })
                  }}
                  className={cn(
                    'flex h-8 shrink-0 items-center justify-between gap-3 rounded-[var(--radius-md)] px-3 text-label whitespace-nowrap coarse:h-11',
                    'transition-[background-color,color] duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)]',
                    // Inside the button: the row scrolls, and would clip a ring
                    // drawn outside it.
                    'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ds-focus-ring)]',
                    // My songs is the player's, the rest came with the app.
                    entry.id === 'mine' && 'md:mt-2',
                    on
                      ? 'bg-[var(--ds-layer-selected)] text-[var(--ds-fg)]'
                      : vacant
                        ? 'cursor-default text-[var(--ds-fg-disabled)]'
                        : 'text-[var(--ds-fg-secondary)] hover:bg-[var(--ds-layer-hover)] hover:text-[var(--ds-fg)]',
                  )}
                >
                  {entry.label}
                  <span
                    className={cn('text-caption', !vacant && 'text-[var(--ds-fg-muted)]')}
                    data-tabular
                  >
                    {entry.count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* The keys and the moods, the same under every genre: all of them,
              or one at a time, and each counts what it would show with the
              other as it is. Not there for a search, which looks past them,
              or on the player's own shelf, which is all of theirs. */}
          {browsing && (
            <div className="flex shrink-0 flex-col gap-3 border-b border-[var(--ds-border-subtle)] py-3 md:pt-5 md:pb-4">
              <div
                ref={keyRow}
                role="group"
                aria-label="Key"
                className="scrollbar-none flex items-center gap-2 overflow-x-auto px-6 md:flex-wrap md:overflow-x-visible coarse:md:gap-y-4"
              >
                <FilterChip
                  selected={key === null}
                  count={inMood.length + ownListed.length}
                  onClick={() => useShelfStore.setState({ key: null })}
                >
                  All keys
                </FilterChip>
                {keys.map((name) => {
                  const on = key === name
                  const count = inKey(name)
                  return (
                    <FilterChip
                      key={name}
                      selected={on}
                      count={count}
                      // Said in full: "Cm" is not a word a screen reader has.
                      aria-label={`${name}, ${count} ${count === 1 ? 'song' : 'songs'}`}
                      title={name}
                      // Nothing to show is nothing to choose. The one that is
                      // chosen stays, though its last song has just left it.
                      disabled={count === 0 && !on}
                      onClick={() => useShelfStore.setState({ key: name })}
                    >
                      {shortKey(name)}
                    </FilterChip>
                  )
                })}
              </div>
              <div className="px-6">
                <div className="w-full sm:w-64">
                  <Select
                    aria-label="Mood"
                    value={mood ?? ''}
                    onChange={(event) =>
                      useShelfStore.setState({
                        mood: (event.target.value || null) as SongMood | null,
                      })
                    }
                    options={[
                      { value: '', label: `All moods (${keyed.length})` },
                      ...SONG_MOODS.map((each) => {
                        const count = keyed.filter((song) => song.moods.includes(each.id)).length
                        return {
                          value: each.id,
                          label: `${each.label} (${count})`,
                          disabled: count === 0 && mood !== each.id,
                        }
                      }),
                    ]}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
            {/* Said rather than shown: what a mood switched on or off did to
                the list, for someone who cannot see it change. */}
            <p className="sr-only" aria-live="polite">
              {listed} {listed === 1 ? 'song' : 'songs'}
            </p>
            {failed && (
              <Notice
                title={`Could not load ${failed.title}`}
                detail="The score did not arrive. Check the connection and choose it again."
              />
            )}
            {importError && 'failure' in importError && <ImportError result={importError} />}
            {moveFailed && (
              <Notice
                title={`Could not change ${moveFailed.title}`}
                detail="The server did not take the change, so the song is as it was. Check that the Sonara API is running and make the change again."
              />
            )}
            {editing && (
              <p className="text-body-sm text-[var(--ds-fg-muted)]">
                Choose a genre and one or more moods for any song. A change is saved as it is made,
                for everyone who uses this Sonara.
              </p>
            )}

            {nothing && (
              <p className="text-body-sm text-[var(--ds-fg-muted)]">
                No song matches “{query.trim()}”.
              </p>
            )}
            {empty && (
              <p className="text-body-sm text-[var(--ds-fg-muted)]">
                {shelved.length === 0
                  ? `Nothing in ${SONG_GENRES.find((entry) => entry.id === genre)?.label} yet. To put a song here, choose Edit categories and give it this genre.`
                  : key === null
                    ? 'No song here has that mood.'
                    : mood === null
                      ? `No song here is in ${key}.`
                      : `No song here is in ${key} and has that mood.`}
              </p>
            )}

            {showMine && (
              <Shelved title="My songs">
                {mine.length === 0 ? (
                  <p className="text-body-sm text-[var(--ds-fg-muted)]">
                    Nothing imported yet. A MusicXML or MuseScore file is the one to bring if you
                    have a choice: those carry the staves, the dynamics, the pedaling and the
                    fingering. MIDI keeps a performance exactly as played, and carries none of those
                    — the format has nowhere to put them.
                  </p>
                ) : (
                  <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                    {mine.map((song) => (
                      <ImportedRow
                        key={song.id}
                        song={song}
                        current={song.id === currentId}
                        onChoose={() => {
                          openSong(song.id)
                          onClose()
                        }}
                        onRemove={() => remove(song.id)}
                      />
                    ))}
                  </ul>
                )}
              </Shelved>
            )}

            {shelf !== 'mine' || searching
              ? sections.map((section) => (
                  <Shelved key={section.id} title={section.title}>
                    {/* One to a line while they are being changed: beside two
                        choices, half a line is too short to tell four editions
                        of one piece apart. */}
                    <ul className={cn('grid grid-cols-1 gap-2', !editing && 'lg:grid-cols-2')}>
                      {section.songs.map((song) => {
                        const { entry } = song
                        return editing ? (
                          <EditRow
                            key={entry.id}
                            song={song}
                            choosing={choosing === entry.id}
                            onChoosing={() =>
                              setChoosing((id) => (id === entry.id ? null : entry.id))
                            }
                            onChange={(change) => move.mutate({ entry, change })}
                          />
                        ) : (
                          <li key={entry.id}>
                            <button
                              type="button"
                              aria-busy={loading === entry.id || undefined}
                              aria-current={catalogSongId(entry) === currentId ? 'true' : undefined}
                              onClick={() => void chooseBuiltIn(entry)}
                              className={cn(
                                row,
                                focusRing,
                                catalogSongId(entry) === currentId ? rowCurrent : rowIdle,
                              )}
                            >
                              <span className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate text-ui text-[var(--ds-fg)]">
                                  {entry.title}
                                </span>
                                <span className="truncate text-caption text-[var(--ds-fg-muted)]">
                                  {entry.composer}
                                  {entry.edition && ` · ${entry.edition}`}
                                </span>
                              </span>
                              {loading === entry.id ? (
                                <Loader2
                                  size={16}
                                  className="shrink-0 animate-spin text-[var(--ds-fg-muted)]"
                                  aria-label="Loading"
                                />
                              ) : (
                                catalogSongId(entry) === currentId && <OpenMark />
                              )}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </Shelved>
                ))
              : null}
          </div>
        </div>
      </div>
    </Dialog>
  )
}

/**
 * A built-in song as two choices rather than something to open: its genre,
 * and its moods.
 *
 * The genre is one of ten, and a native select. The moods are any number of
 * eight, which no native control does well, so they are the same switches the
 * list is narrowed with, folded away under a field that reads out what is
 * chosen: open on the one song being worked on, not eight pills on every row.
 * They unfold in the row rather than float over it. A floating panel inside a
 * dialog is beneath the dialog, and Escape would shut both.
 */
function EditRow({
  song,
  choosing,
  onChoosing,
  onChange,
}: {
  song: Placed
  /** Whether its moods are laid out to choose from. */
  choosing: boolean
  onChoosing: () => void
  onChange: (change: SetSongCategoryInput) => void
}) {
  const { entry } = song
  const name = nameOf(entry)
  const panelId = React.useId()
  const chosen = SONG_MOODS.filter((mood) => song.moods.includes(mood.id))
    .map((mood) => mood.label)
    .join(', ')

  return (
    <li className={cn(row, rowIdle, 'flex-wrap')}>
      <span className="flex min-w-0 flex-1 basis-40 flex-col">
        <span className="truncate text-ui text-[var(--ds-fg)]">{entry.title}</span>
        <span className="truncate text-caption text-[var(--ds-fg-muted)]">
          {entry.composer}
          {entry.edition && ` · ${entry.edition}`}
        </span>
      </span>
      <div className="flex w-full gap-2 sm:w-auto">
        <div className="min-w-0 flex-1 sm:w-40 sm:flex-none">
          <Select
            size="sm"
            aria-label={`Genre for ${name}`}
            value={song.genre}
            onChange={(event) => onChange({ genre: event.target.value as SongGenre })}
            options={SONG_GENRES.map((option) => ({ value: option.id, label: option.label }))}
          />
        </div>
        <button
          type="button"
          aria-expanded={choosing}
          aria-controls={panelId}
          aria-label={`Moods for ${name}: ${chosen}`}
          onClick={onChoosing}
          className={cn(
            controlShell(),
            // The select's own measurements, so the two read as a pair.
            'relative h-8 min-w-0 flex-1 cursor-pointer rounded-[var(--radius-md)] pr-9 pl-3 text-left text-body-sm text-[var(--ds-fg)] sm:w-52 sm:flex-none',
          )}
        >
          <span className="block truncate">{chosen}</span>
          <ChevronDown
            size={15}
            aria-hidden
            className={cn(
              'pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[var(--ds-fg-muted)] transition-transform duration-[120ms]',
              choosing && 'rotate-180',
            )}
          />
        </button>
      </div>
      {choosing && (
        <div
          id={panelId}
          role="group"
          aria-label={`Moods for ${name}`}
          className="flex w-full flex-wrap gap-2 coarse:gap-y-4"
        >
          {SONG_MOODS.map((mood) => {
            const on = song.moods.includes(mood.id)
            // A song has a mood: its last one stays until another is chosen.
            const last = on && song.moods.length === 1
            return (
              <FilterChip
                key={mood.id}
                selected={on}
                aria-disabled={last || undefined}
                title={last ? 'A song keeps at least one mood' : undefined}
                onClick={() => {
                  if (last) return
                  onChange({
                    moods: SONG_MOODS.map((each) => each.id).filter((id) =>
                      id === mood.id ? !on : song.moods.includes(id),
                    ),
                  })
                }}
              >
                {mood.label}
              </FilterChip>
            )
          })}
        </div>
      )}
    </li>
  )
}

/** A shelf of the list: its name, a label's distance above what it names. */
function Shelved({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-overline text-[var(--ds-fg-muted)] uppercase">{title}</h3>
      {children}
    </section>
  )
}

/** Says which song is the one already open. */
function OpenMark() {
  return <span className="shrink-0 text-label-sm text-[var(--ds-accent-text)]">Open</span>
}

function ImportedRow({
  song,
  current,
  onChoose,
  onRemove,
}: {
  song: Song
  current: boolean
  onChoose: () => void
  onRemove: () => void
}) {
  return (
    <li className={cn(row, 'coarse:gap-4', current ? rowCurrent : rowIdle)}>
      <button
        type="button"
        aria-current={current ? 'true' : undefined}
        onClick={onChoose}
        className={cn('flex min-w-0 flex-1 flex-col items-start text-left', focusRing)}
      >
        <span className="w-full truncate text-ui text-[var(--ds-fg)]">{song.title}</span>
        <span className="text-caption text-[var(--ds-fg-muted)]">
          {SOURCE_LABELS[song.source] ?? 'Score'} · {song.measureCount}{' '}
          {song.measureCount === 1 ? 'bar' : 'bars'} · {Math.round(song.bpm)} BPM
          {song.handsInferred ? ' · hands guessed from pitch' : ''}
          {song.handsSuggested
            ? ` · hand suggested for ${song.handsSuggested} ${song.handsSuggested === 1 ? 'note' : 'notes'}`
            : ''}
          {(song.parts?.length ?? 0) > 1 && <>{` · ${song.parts.join(', ')}`}</>}
        </span>
        <Provided song={song} />
        {song.partsKnown === false && (
          <span className="mt-1 text-caption text-[var(--ds-warning-text)]">
            Imported before drums were separated, so every part plays on the piano. Import the file
            again to split them.
          </span>
        )}
      </button>
      {current && <OpenMark />}
      <IconButton
        size="sm"
        variant="text"
        label={`Remove ${song.title}`}
        icon={<Trash2 />}
        onClick={onRemove}
      />
    </li>
  )
}

function Notice({ title, detail, name }: { title: string; detail: string; name?: string }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--ds-warning-border)] bg-[var(--ds-warning-subtle)] p-3"
    >
      <span className="text-ui text-[var(--ds-fg)]">{title}</span>
      <span className="text-body-sm text-[var(--ds-fg-secondary)]">{detail}</span>
      {name && <span className="text-caption text-[var(--ds-fg-muted)]">{name}</span>}
    </div>
  )
}

/**
 * What went wrong, and what to do about it.
 *
 * Each failure needs its own sentence. "Unsupported file" tells someone
 * holding a PDF of the piece they want to learn nothing they can act on, and
 * the three cases here have three genuinely different answers.
 */
function ImportError({ result }: { result: Extract<ImportResult, { failure: ImportFailure }> }) {
  const body = {
    pdf: {
      title: 'A PDF is a picture of the music, not the music',
      detail:
        'There are no notes inside a PDF, only ink — reading one needs optical recognition, and the result always needs checking by eye. MuseScore is free and can open a PDF and save it as MuseScore or MusicXML. Bring that back here and everything works.',
    },
    empty: {
      title: 'Nothing playable in this file',
      detail: 'The format was recognized, but there were no notes in it.',
    },
    unknown: {
      title: 'Not a file we could read',
      detail: 'Sonara reads MusicXML, MuseScore and MIDI files.',
    },
  }[result.failure]

  return <Notice title={body.title} detail={body.detail} name={result.name} />
}

/**
 * What the file carried, and what it did not.
 *
 * Every format loses something different and the player has no way to tell
 * which — "no pedaling in this piece" and "this file did not record pedaling"
 * look identical once imported. Saying so is the only way to tell them apart,
 * and it is also the argument for bringing a score rather than a MIDI.
 */
function Provided({ song }: { song: Song }) {
  const provides = song.provides
  if (!provides) return null

  const labels: [keyof typeof provides, string][] = [
    ['rhythm', 'Rhythm'],
    ['staves', 'Hands'],
    ['dynamics', 'Dynamics'],
    ['pedal', 'Pedal'],
    ['fingering', 'Fingering'],
  ]
  const missing = labels.filter(([key]) => !provides[key])
  if (missing.length === 0) return null

  return (
    <span className="mt-0.5 text-caption text-[var(--ds-fg-muted)]">
      Not in this file: {missing.map(([, label]) => label.toLowerCase()).join(', ')}
    </span>
  )
}

function ImportButton({ onFiles }: { onFiles: (files: FileList | null) => void }) {
  const input = React.useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".musicxml,.xml,.mxl,.mscz,.mid,.midi,audio/midi,application/vnd.recordare.musicxml+xml"
        multiple
        hidden
        onChange={(event) => {
          onFiles(event.target.files)
          // Cleared so choosing the same file twice in a row still fires.
          event.target.value = ''
        }}
      />
      {/* Outlined: what this dialog is for is choosing, and the songs are the
          way to do that. Importing is the other thing you can do here. */}
      <Button
        size="sm"
        variant="outlined"
        startIcon={<Upload />}
        onClick={() => input.current?.click()}
      >
        Import a song
      </Button>
    </>
  )
}
