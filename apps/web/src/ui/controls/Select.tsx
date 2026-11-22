import type * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { controlShell, controlSizes, type ControlSize } from './control-shell'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

/**
 * Native select. Under about fifteen known options with no search need, the
 * native control wins outright: free keyboard support, a free mobile wheel
 * picker, and zero bundle cost. A custom listbox has to re-implement all of it
 * and usually gets type-ahead wrong.
 */
export function Select({
  options,
  size = 'md',
  className,
  ...rest
}: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> & {
  options: readonly SelectOption[]
  size?: ControlSize
}) {
  return (
    <div className="relative">
      <select
        className={cn(
          controlShell(rest.disabled),
          controlSizes[size],
          // 36px of right padding, not 12: the chevron needs 16px plus its own
          // gutter, or a long option label collides with it.
          'cursor-pointer appearance-none pl-3 pr-9 text-[var(--ds-fg)]',
          className,
        )}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={15}
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ds-fg-muted)]"
      />
    </div>
  )
}
