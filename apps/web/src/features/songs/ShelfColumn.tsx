import { Search } from 'lucide-react'
import { cn } from '@/lib/cn'
import { controlShell } from '@/ui/Controls'
import type { Shelf } from './shelf-store'

/**
 * The search and the shelves: a column of them beside the list, and a row of
 * them above it where there is no room for a column.
 */
export function ShelfColumn({
  query,
  onQuery,
  shelves,
  shelf,
  searching,
  onShelf,
}: {
  query: string
  onQuery: (query: string) => void
  shelves: readonly { id: Shelf; label: string; count: number }[]
  shelf: Shelf
  searching: boolean
  onShelf: (shelf: Shelf) => void
}) {
  return (
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
          onChange={(event) => onQuery(event.target.value)}
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
              onClick={() => onShelf(entry.id)}
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
  )
}
