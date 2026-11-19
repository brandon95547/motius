import * as React from 'react'
import { cn } from '@/lib/cn'

/**
 * A button on the bar: one component for the bar's buttons, their looks its
 * options, rather than a raw <button> with classes in each place.
 *
 * - `start`: the one filled button, Start and Play — square, an icon.
 * - `stop`: the same square, outlined, for what Start turns into.
 * - `icon`: a round icon button, the bar's quieter controls.
 *
 * Like every control on the bar it takes no focus from a click: the bar sees
 * to that (TopBar), for all of them at once.
 */
export type BarButtonLook = 'start' | 'stop' | 'icon'

const LOOKS: Record<BarButtonLook, string> = {
  start: 'bar-start bar-start--icon',
  stop: 'bar-start bar-start--icon bar-start--stop',
  icon: 'bar-icon-button',
}

export function BarButton({
  look,
  label,
  icon,
  className,
  ...rest
}: {
  look: BarButtonLook
  /** Its name, and its tooltip. */
  label: string
  icon: React.ReactNode
  className?: string
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'title' | 'className'>) {
  return (
    <button
      type="button"
      className={cn(LOOKS[look], className)}
      aria-label={label}
      title={label}
      {...rest}
    >
      {icon}
    </button>
  )
}
