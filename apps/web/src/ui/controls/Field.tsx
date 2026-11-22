import type * as React from 'react'
import { cn } from '@/lib/cn'

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string
  hint?: React.ReactNode
  htmlFor?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-label text-[var(--ds-fg-secondary)]">
        {label}
      </label>
      {children}
      {hint && <p className="text-caption text-[var(--ds-fg-muted)]">{hint}</p>}
    </div>
  )
}
