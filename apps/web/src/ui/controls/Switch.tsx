import * as React from 'react'
import { cn } from '@/lib/cn'

export function Switch({
  checked,
  onChange,
  label,
  description,
  id,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
  id?: string
}) {
  const generated = React.useId()
  const inputId = id ?? generated
  return (
    // `control-row` gives the row a 44px minimum under a finger. On the row
    // rather than on the switch: growing an 18px control to 44px would wreck
    // the panel's rhythm, and the label is part of the target anyway.
    <div className="control-row flex items-start justify-between gap-4">
      <label htmlFor={inputId} className="flex min-w-0 cursor-pointer flex-col gap-0.5">
        <span className="text-ui text-[var(--ds-fg)]">{label}</span>
        {description && (
          <span className="text-caption text-[var(--ds-fg-muted)]">{description}</span>
        )}
      </label>
      <button
        id={inputId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors duration-[160ms] ease-[cubic-bezier(0.2,0,0,1)]',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-focus-ring)]',
          checked
            ? 'bg-[var(--ds-accent)]'
            : 'bg-[var(--ds-field)] border border-[var(--ds-border-strong)]',
        )}
      >
        <span
          className={cn(
            'absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full shadow-e1',
            'transition-[left] duration-[160ms] ease-[cubic-bezier(0.32,0.72,0,1)]',
            // On, the knob is whatever the accent carries its labels in: white
            // on every fill but a pale one, where white would be lost.
            checked ? 'left-[21px] bg-[var(--ds-accent-fg)]' : 'left-[3px] bg-white',
          )}
        />
      </button>
    </div>
  )
}
