import type * as React from 'react'
import { cn } from '@/lib/cn'

/**
 * A filter chip: a pill that is on or off — UI Bible spec.
 *
 * 28px, between a badge and a button: something to press, but not what the
 * view is for. `aria-pressed` rather than `aria-selected`: each is a button
 * that is on or off, whether the row lets several be on or only one, and not
 * an option in a listbox. On, it changes fill, border and text together, so
 * the state survives a row of a dozen and a screen without color.
 *
 * Off, it is an outline with nothing in it, where the Bible fills it with the
 * page's surface. A chip here lands in a dialog, and the page's surface inside
 * a dialog is a hole cut in it; an outline takes on whatever it stands on.
 */
export function FilterChip({
  selected,
  count,
  className,
  children,
  ...rest
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> & {
  selected: boolean
  /** How many things it stands for, said after the label. */
  count?: number
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'touch-target inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-label whitespace-nowrap',
        'transition-[background-color,border-color,color] duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-focus-ring)]',
        'disabled:pointer-events-none disabled:opacity-45',
        selected
          ? 'border-[var(--ds-accent-border)] bg-[var(--ds-accent-subtle)] text-[var(--ds-accent-text)] hover:bg-[var(--ds-accent-subtle-hover)]'
          : 'border-[var(--ds-border-interactive)] text-[var(--ds-fg-secondary)] hover:border-[var(--ds-border-strong)] hover:bg-[var(--ds-layer-hover)] hover:text-[var(--ds-fg)]',
        className,
      )}
      {...rest}
    >
      {children}
      {count !== undefined && (
        <span className={cn('text-caption', !selected && 'text-[var(--ds-fg-muted)]')} data-tabular>
          {count}
        </span>
      )}
    </button>
  )
}
