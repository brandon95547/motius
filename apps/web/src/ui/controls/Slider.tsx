import * as React from 'react'
import { cn } from '@/lib/cn'

export function Slider({
  value,
  onChange,
  onCommit,
  min,
  max,
  step = 1,
  label,
  formatValue,
  id,
  origin = 'start',
  bare = false,
  valueText,
  className,
}: {
  value: number
  onChange: (value: number) => void
  /**
   * Fired when the drag ends, not on every frame of it. `onChange` keeps the
   * thumb under the finger; `onCommit` is where a save belongs — a slider wired
   * straight to a mutation sends eighty requests to move twelve semitones.
   */
  onCommit?: (value: number) => void
  min: number
  max: number
  step?: number
  label: string
  formatValue?: (value: number) => string
  id?: string
  /**
   * Where the filled part of the track starts. A bipolar control — transpose,
   * pan, a trim — has a meaningful zero in the middle, and filling it from the
   * left says "half on" when the honest reading is "off".
   */
  origin?: 'start' | 'center'
  /** The track alone, its label for screen readers only: where the words beside it say what it is. */
  bare?: boolean
  /** What a screen reader says for the value, where the number is not it: `Bar 12`. */
  valueText?: (value: number) => string
  className?: string
}) {
  const generated = React.useId()
  const inputId = id ?? generated
  const percent = max === min ? 0 : ((value - min) / (max - min)) * 100
  const anchor = origin === 'center' ? 50 : 0
  const from = Math.min(anchor, percent)
  const to = Math.max(anchor, percent)

  const input = (
    <input
      id={inputId}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={bare ? label : undefined}
      aria-valuetext={valueText?.(value)}
      onChange={(event) => onChange(Number(event.target.value))}
      onPointerUp={() => onCommit?.(value)}
      onKeyUp={() => onCommit?.(value)}
      onBlur={() => onCommit?.(value)}
      className={cn('motius-slider', bare && className)}
      // The filled portion of the track is painted from these custom
      // properties rather than from a second element, so the thumb stays a
      // real native control with real keyboard and assistive-tech behaviour.
      style={{ '--slider-from': `${from}%`, '--slider-to': `${to}%` } as React.CSSProperties}
    />
  )
  if (bare) return input

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={inputId} className="text-label text-[var(--ds-fg-secondary)]">
          {label}
        </label>
        <span className="text-label-sm text-[var(--ds-fg)]" data-tabular>
          {formatValue ? formatValue(value) : value}
        </span>
      </div>
      {input}
    </div>
  )
}
