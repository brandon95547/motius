import * as React from 'react'
import { cn } from '@/lib/cn'

/**
 * The list under a typed-in field: the Combobox's, and the bar's song search.
 * One list, so both look and behave alike — the field keeps the focus, the
 * arrows move a highlight (`aria-activedescendant`), and a press on an option
 * chooses it without taking the focus away.
 */

/** The list itself, placed by `className` under its field. */
export const Listbox = React.forwardRef<
  HTMLDivElement,
  { id: string; label?: string; className?: string; children: React.ReactNode }
>(function Listbox({ id, label, className, children }, ref) {
  return (
    <div
      ref={ref}
      id={id}
      role="listbox"
      aria-label={label}
      className={cn(
        'absolute z-10 overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface-overlay)] p-1 shadow-e4',
        className,
      )}
    >
      {children}
    </div>
  )
})

/** One option: its id is the list's id and its place, which the field points at. */
export function ListboxOption({
  listId,
  index,
  active,
  selected,
  onHover,
  onChoose,
  children,
}: {
  listId: string
  index: number
  active: boolean
  selected: boolean
  onHover: (index: number) => void
  onChoose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      id={`${listId}-${index}`}
      role="option"
      aria-selected={selected}
      data-active={active}
      // The field keeps the focus; a press on an option must not take it.
      onMouseDown={(event) => event.preventDefault()}
      onMouseEnter={() => onHover(index)}
      onClick={onChoose}
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-1.5 coarse:min-h-11',
        active && 'bg-[var(--ds-layer-hover)]',
      )}
    >
      {children}
    </div>
  )
}

/** The highlighted option kept in sight as the arrows move it, or as the list opens on the current one. */
export function useActiveInView(
  listRef: React.RefObject<HTMLElement | null>,
  open: boolean,
  ...when: readonly unknown[]
) {
  React.useEffect(() => {
    if (!open) return
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView?.({ block: 'nearest' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ...when])
}

/** The arrows, Enter and Escape of a field with a list: shared, so both fields answer them alike. */
export function listKeys({
  open,
  count,
  setActive,
  onOpen,
  onChoose,
  onEscape,
}: {
  open: boolean
  count: number
  setActive: React.Dispatch<React.SetStateAction<number>>
  onOpen?: () => void
  onChoose: () => void
  /** Return false to leave Escape to whatever is behind the field. */
  onEscape: () => boolean
}) {
  return (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open && onOpen) onOpen()
      else setActive((index) => Math.min(count - 1, index + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (open) setActive((index) => Math.max(0, index - 1))
    } else if (event.key === 'Enter' && open) {
      event.preventDefault()
      onChoose()
    } else if (event.key === 'Escape' && onEscape()) {
      // The field's own Escape: whatever panel the field is in stays open.
      event.stopPropagation()
      event.nativeEvent.stopImmediatePropagation()
    }
  }
}
