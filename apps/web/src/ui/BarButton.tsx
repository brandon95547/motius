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
export type BarButtonLook = 'start' | 'stop' | 'icon' | 'options'

const LOOKS: Record<BarButtonLook, string> = {
  start: 'bar-start bar-start--icon',
  stop: 'bar-start bar-start--icon bar-start--stop',
  icon: 'bar-icon-button',
  // The area's options, alone on the bar's left.
  options: 'bar-options',
}

export function BarButton({
  look,
  label,
  icon,
  showLabel = false,
  className,
  ...rest
}: {
  look: BarButtonLook
  /** Its name, and its tooltip — or, with `showLabel`, the word written beside the icon. */
  label: string
  icon: React.ReactNode
  /** The name written out, for a start button that is not on the bar: Again, on a finished run. */
  showLabel?: boolean
  className?: string
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'title' | 'className'>) {
  if (showLabel) {
    return (
      <button
        type="button"
        className={cn(LOOKS[look].replace(' bar-start--icon', ''), className)}
        {...rest}
      >
        {icon}
        <span className="bar-start__label">{label}</span>
      </button>
    )
  }
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
