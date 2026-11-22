import * as React from 'react'
import { SONG_GENRES, SONG_MOODS } from '@motius/shared'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { useLearningStore } from '@/state/learning-store'
import { useSongStore } from '@/state/song-store'
import { useIsAdmin } from '@/state/account-store'
import { SONG_CATALOG, catalogSongId, loadCatalogSong, type CatalogSong } from './catalog'
import { CatalogList } from './CatalogList'
import { KeyMoodFilters } from './KeyMoodFilters'
import { MySongs } from './MySongs'
import { Notice, type Placed, type Section } from './picker-parts'
import { ShelfColumn } from './ShelfColumn'
import { ImportButton, ImportError } from './SongImport'
import { songKey, sortKeys } from './song-keys'
import { fold } from './song-search'
import { useShelfStore, type Shelf } from './shelf-store'
import { useSongCategories } from './use-song-categories'
import { useSongImport } from './use-song-import'

/**
 * Choosing a song: the ones that come with Motius, by genre and by mood, and
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
 * The import, and how a file is read, is in `use-song-import`.
 */

export function SongPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const library = useSongStore((state) => state.library)
  const builtIn = useSongStore((state) => state.builtIn)
  const currentId = useSongStore((state) => state.currentId)
  const { open: openSong, openBuiltIn, remove } = useSongStore.getState()
  const shelf = useShelfStore((state) => state.shelf)
  const chosenMood = useShelfStore((state) => state.mood)
  const chosenKey = useShelfStore((state) => state.key)
  const [query, setQuery] = React.useState('')
  /** The built-in song being fetched, by its catalog id. */
  const [loading, setLoading] = React.useState<string | null>(null)
  const [failed, setFailed] = React.useState<CatalogSong | null>(null)
  const request = React.useRef<AbortController | null>(null)
  /** Whether the rows are choices of genre and mood rather than songs to open. */
  const [editing, setEditing] = React.useState(false)
  const isAdmin = useIsAdmin()
  /** The song whose moods are laid out to choose from, by its catalog id. */
  const [choosing, setChoosing] = React.useState<string | null>(null)
  const { placed, move, moveFailed, setMoveFailed } = useSongCategories(open)
  const { importError, setImportError, onFiles } = useSongImport(onClose)

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
  }, [open, setImportError, setMoveFailed])

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
      size="lg"
      flush
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <p className="text-caption text-[var(--ds-fg-muted)]">
            MusicXML · MuseScore · MIDI. Imported songs stay on this device.
          </p>
          <div className="flex items-center gap-2.5 coarse:gap-3">
            {/* The rows become choices of genre and mood, and back again. The
                shelves are the same for everybody, so only an admin moves a song. */}
            {isAdmin && (
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
            )}
            <ImportButton onFiles={onFiles} />
          </div>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <ShelfColumn
          query={query}
          onQuery={setQuery}
          shelves={shelves}
          shelf={shelf}
          searching={searching}
          onShelf={(id) => {
            setQuery('')
            setChoosing(null)
            // The whole shelf: the mood chosen was a way of looking at
            // the one before.
            useShelfStore.setState({ shelf: id, mood: null })
          }}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* The keys and the moods, the same under every genre: all of them,
              or one at a time, and each counts what it would show with the
              other as it is. Not there for a search, which looks past them,
              or on the player's own shelf, which is all of theirs. */}
          {browsing && (
            <KeyMoodFilters
              keyRow={keyRow}
              keys={keys}
              chosenKey={key}
              mood={mood}
              allKeysCount={inMood.length + ownListed.length}
              countInKey={inKey}
              keyed={keyed}
            />
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
                detail="The server did not take the change, so the song is as it was. Check that the Motius API is running and make the change again."
              />
            )}
            {editing && (
              <p className="text-body-sm text-[var(--ds-fg-muted)]">
                Choose a genre and one or more moods for any song. A change is saved as it is made,
                for everyone who uses this Motius.
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
              <MySongs
                songs={mine}
                currentId={currentId}
                onChoose={(id) => {
                  openSong(id)
                  onClose()
                }}
                onRemove={remove}
              />
            )}

            {shelf !== 'mine' || searching ? (
              <CatalogList
                sections={sections}
                editing={editing}
                choosing={choosing}
                onChoosing={(id) => setChoosing((was) => (was === id ? null : id))}
                onMove={(entry, change) => move.mutate({ entry, change })}
                loading={loading}
                currentId={currentId}
                onChoose={(entry) => void chooseBuiltIn(entry)}
              />
            ) : null}
          </div>
        </div>
      </div>
    </Dialog>
  )
}
