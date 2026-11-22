import type * as React from 'react'
import { cn } from '@/lib/cn'

/**
 * Mutually exclusive options: a row of them, or with `columns` a grid — the
 * motions and textures of a scale. Under about five choices for a row.
 *
 * One Tab stop for the group and arrow keys inside it, the way a radio group
 * works everywhere else; six choices that were each a Tab stop would put the
 * next setting six presses away. The arrows step over a choice that is not on
 * offer, and hovering it says why (`title`).
 */
export function SegmentedControl<T extends string | number>({
  value,
  onChange,
  options,
  label,
  columns,
  className,
}: {
  value: T
  onChange: (value: T) => void
  options: readonly { value: T; label: string; disabled?: boolean; title?: string }[]
  label: string
  /** Laid out as a grid of this many columns, rather than one row. */
  columns?: number
  className?: string
}) {
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const group = event.currentTarget
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0
    if (step === 0) return
    event.preventDefault()
    const offered = options.filter((option) => !option.disabled)
    const index = offered.findIndex((option) => option.value === value)
    const next = offered[(index + step + offered.length) % offered.length]
    if (!next) return
    onChange(next.value)
    // The chosen button is re-rendered as the Tab stop; move focus onto it.
    requestAnimationFrame(() =>
      group.querySelector<HTMLButtonElement>(`[data-value="${String(next.value)}"]`)?.focus(),
    )
  }
  // Something is always the Tab stop, even when the value is none of them.
  const stop = options.some((option) => option.value === value)
    ? value
    : options.find((option) => !option.disabled)?.value

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        'w-full gap-0.5 rounded-[var(--radius-md)] border border-[var(--ds-border-interactive)] bg-[var(--ds-field)] p-0.5',
        // Every row as tall as the tallest, so a name on two lines leaves its neighbours alone.
        columns ? 'grid auto-rows-fr' : 'inline-flex items-center',
        className,
      )}
      style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            data-value={String(option.value)}
            tabIndex={option.value === stop ? 0 : -1}
            disabled={option.disabled}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={cn(
              'min-h-7 flex-1 rounded-[var(--radius-sm)] px-2 text-label-sm transition-colors duration-[120ms]',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ds-focus-ring)]',
              'disabled:cursor-not-allowed disabled:opacity-50',
              selected
                ? 'bg-[var(--ds-accent)] text-[var(--ds-accent-fg)]'
                : 'text-[var(--ds-fg-secondary)] enabled:hover:bg-[var(--ds-layer-hover)] enabled:hover:text-[var(--ds-fg)]',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
