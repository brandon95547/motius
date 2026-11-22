import * as React from 'react'
import { Loader2, Search } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useDismissable } from '@/lib/hooks'
import { Listbox, ListboxOption, listKeys, useActiveInView } from '@/ui/Listbox'
import { useLearningStore } from '@/state/learning-store'
import { useSongStore } from '@/state/song-store'
import { loadCatalogSong } from './catalog'
import { findSongs, type SongMatch } from './song-search'

/**
 * A song, found by typing some of its name, on the bar.
 *
 * The chooser is the place to look for something to play: shelves, moods,
 * keys. This is for the player who already knows. A few letters, the songs
 * that have them listed under the field, and the one chosen is opened, with
 * the chooser never on screen.
 *
 * One field and nothing else until something is typed. It lists a handful,
 * best first, and says how many it left out: past that it would be a worse
 * chooser, and the chooser is one click away.
 *
 * Focus never leaves the field. The arrows move a highlight through the list
 * (`aria-activedescendant`), Enter opens the one highlighted, and Escape
 * clears what was typed.
 */
export function SongSearch({ className }: { className?: string }) {
  const library = useSongStore((state) => state.library)
  const currentId = useSongStore((state) => state.currentId)
  const [query, setQuery] = React.useState('')
  const [focused, setFocused] = React.useState(false)
  const [active, setActive] = React.useState(0)
  /** The built-in song being fetched, by the id it will have, and one that did not arrive. */
  const [loading, setLoading] = React.useState<string | null>(null)
  const [failed, setFailed] = React.useState<string | null>(null)
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  const request = React.useRef<AbortController | null>(null)
  const listId = React.useId()

  const { matches, more } = React.useMemo(() => findSongs(query, library), [query, library])
  const open = focused && query.trim().length > 0

  const clear = React.useCallback(() => {
    request.current?.abort()
    setQuery('')
    setActive(0)
    setLoading(null)
    setFailed(null)
  }, [])
  const shut = React.useCallback(() => setFocused(false), [])
  useDismissable(open, shut, [wrapRef])
  React.useEffect(() => () => request.current?.abort(), [])

  /** Found and opened: the field is put back as it was, out of the way. */
  const done = () => {
    clear()
    setFocused(false)
    inputRef.current?.blur()
  }

  const choose = async (match: SongMatch | undefined) => {
    if (!match) return
    const { builtIn, open: openSong, openBuiltIn } = useSongStore.getState()
    if (!match.entry) {
      openSong(match.id)
      done()
      return
    }
    const held = builtIn.find((song) => song.id === match.id)
    if (held) {
      openBuiltIn(held)
      done()
      return
    }
    // Choosing another while one is on its way is changing your mind.
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setFailed(null)
    setLoading(match.id)
    try {
      const song = await loadCatalogSong(
        match.entry,
        controller.signal,
        useLearningStore.getState().fingeringSystem,
      )
      if (controller.signal.aborted) return
      openBuiltIn(song)
      done()
    } catch {
      if (!controller.signal.aborted) {
        setFailed(match.title)
        setLoading(null)
      }
    }
  }

  // The highlighted song stays in sight as the arrows move it.
  useActiveInView(listRef, open, active)

  return (
    <div ref={wrapRef} className={cn('bar-search', className)}>
      <Search size={16} aria-hidden className="bar-search__icon" />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label="Search songs"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${listId}-${active}` : undefined}
        placeholder="Search songs"
        autoComplete="off"
        spellCheck={false}
        value={query}
        className="bar-search__input"
        onFocus={() => setFocused(true)}
        onBlur={(event) => {
          if (!wrapRef.current?.contains(event.relatedTarget)) setFocused(false)
        }}
        onChange={(event) => {
          setQuery(event.target.value)
          setFocused(true)
          setActive(0)
          setFailed(null)
        }}
        onKeyDown={listKeys({
          open,
          count: matches.length,
          setActive,
          onChoose: () => void choose(matches[active]),
          // Escape clears what was typed.
          onEscape: () => {
            if (query) clear()
            return Boolean(query)
          },
        })}
      />
      {loading && (
        <Loader2
          size={16}
          className="bar-search__busy animate-spin"
          aria-label="Opening the song"
        />
      )}

      {open && (
        <Listbox
          ref={listRef}
          id={listId}
          label="Songs"
          className="top-[calc(100%+8px)] right-0 max-h-[min(26rem,70vh)] w-[min(22rem,calc(100vw-1.5rem))]"
        >
          {failed && (
            <p role="alert" className="px-2.5 py-2 text-caption text-[var(--ds-warning-text)]">
              Could not load {failed}. Check the connection and choose it again.
            </p>
          )}
          {matches.length === 0 && (
            <p className="px-3 py-6 text-center text-caption text-[var(--ds-fg-muted)]">
              No song matches “{query.trim()}”.
            </p>
          )}
          {matches.map((match, index) => {
            const current = match.id === currentId
            return (
              <ListboxOption
                key={match.id}
                listId={listId}
                index={index}
                active={index === active}
                selected={current}
                onHover={setActive}
                onChoose={() => void choose(match)}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-label text-[var(--ds-fg)]">{match.title}</span>
                  <span className="truncate text-caption text-[var(--ds-fg-muted)]">
                    {match.detail}
                  </span>
                </span>
                {loading === match.id ? (
                  <Loader2
                    size={14}
                    aria-hidden
                    className="shrink-0 animate-spin text-[var(--ds-fg-muted)]"
                  />
                ) : (
                  current && (
                    <span className="shrink-0 text-label-sm text-[var(--ds-accent-text)]">
                      Open
                    </span>
                  )
                )}
              </ListboxOption>
            )
          })}
          {more > 0 && (
            <p className="px-2.5 pt-2 pb-1.5 text-caption text-[var(--ds-fg-muted)]">
              {more} more. Keep typing to narrow them down.
            </p>
          )}
        </Listbox>
      )}
    </div>
  )
}
