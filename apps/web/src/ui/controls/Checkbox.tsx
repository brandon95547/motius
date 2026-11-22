import { cn } from '@/lib/cn'

/**
 * A checkbox: a choice about one thing, said in a few words beside it — "Show
 * next time" — where a switch would be a setting. The browser's own box, in
 * the accent, so it is a real checkbox to every reader and every keyboard.
 */
export function Checkbox({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  className?: string
}) {
  return (
    <label
      className={cn(
        'control-row inline-flex cursor-pointer items-center gap-2 text-ui text-[var(--ds-fg)]',
        className,
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--ds-accent)]"
      />
      {label}
    </label>
  )
}
