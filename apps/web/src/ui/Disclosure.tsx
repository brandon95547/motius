import * as React from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface DisclosureProps {
  readonly label: React.ReactNode
  readonly children: React.ReactNode
  /** Open or closed from outside, where one of a group opens at a time. Its own otherwise. */
  readonly open?: boolean
  readonly onOpenChange?: (open: boolean) => void
  /** A heading for the button, where it names a part of a list. */
  readonly heading?: 'h2' | 'h3'
  /** The button's own look, in place of the small link-like one. */
  readonly triggerClassName?: string
  /** Beside the label, at the row's end: a count, say. */
  readonly aside?: React.ReactNode
  readonly className?: string
}

const LINK_LOOK =
  'flex w-fit items-center gap-1 text-label-sm text-[var(--ds-fg-secondary)] hover:text-[var(--ds-fg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-focus-ring)]'

/**
 * A button that shows or hides what is under it. Closed until opened, unless
 * whoever holds it says otherwise: a list whose parts open one at a time keeps
 * which is open itself.
 */
export function Disclosure({
  label,
  children,
  open: given,
  onOpenChange,
  heading: Heading,
  triggerClassName,
  aside,
  className = 'flex flex-col gap-2',
}: DisclosureProps) {
  const [own, setOwn] = React.useState(false)
  const open = given ?? own
  const id = React.useId()
  const Chevron = open ? ChevronDown : ChevronRight
  const trigger = (
    <button
      type="button"
      className={triggerClassName ?? LINK_LOOK}
      aria-expanded={open}
      aria-controls={id}
      onClick={() => {
        setOwn(!open)
        onOpenChange?.(!open)
      }}
    >
      <Chevron size={14} aria-hidden />
      <span>{label}</span>
      {aside}
    </button>
  )
  return (
    <div className={className}>
      {Heading ? <Heading>{trigger}</Heading> : trigger}
      <div id={id} hidden={!open}>
        {open && children}
      </div>
    </div>
  )
}
