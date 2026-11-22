import * as React from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { SONG_GENRES, SONG_MOODS, type SetSongCategoryInput, type SongGenre } from '@motius/shared'
import { cn } from '@/lib/cn'
import { controlShell, FilterChip, Select } from '@/ui/Controls'
import { catalogSongId, type CatalogSong } from './catalog'
import {
  focusRing,
  nameOf,
  OpenMark,
  row,
  rowCurrent,
  rowIdle,
  Shelved,
  type Placed,
  type Section,
} from './picker-parts'

/**
 * The songs that come with Motius, a shelf to a heading: each to open, or,
 * while categories are being edited, its genre and moods to choose.
 */
export function CatalogList({
  sections,
  editing,
  choosing,
  onChoosing,
  onMove,
  loading,
  currentId,
  onChoose,
}: {
  sections: readonly Section[]
  editing: boolean
  /** The song whose moods are laid out to choose from, by its catalog id. */
  choosing: string | null
  onChoosing: (id: string) => void
  onMove: (entry: CatalogSong, change: SetSongCategoryInput) => void
  /** The built-in song being fetched, by its catalog id. */
  loading: string | null
  currentId: string | null
  onChoose: (entry: CatalogSong) => void
}) {
  return sections.map((section) => (
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
              onChoosing={() => onChoosing(entry.id)}
              onChange={(change) => onMove(entry, change)}
            />
          ) : (
            <li key={entry.id}>
              <button
                type="button"
                aria-busy={loading === entry.id || undefined}
                aria-current={catalogSongId(entry) === currentId ? 'true' : undefined}
                onClick={() => onChoose(entry)}
                className={cn(
                  row,
                  focusRing,
                  catalogSongId(entry) === currentId ? rowCurrent : rowIdle,
                )}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-ui text-[var(--ds-fg)]">{entry.title}</span>
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
