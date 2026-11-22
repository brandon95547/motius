import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { IconButton } from './Button'
import { useDismissable, useFocusTrap, useMediaQuery } from '@/lib/hooks'

/**
 * A side sheet on a wide screen and a bottom sheet on a narrow one. The side
 * is the right unless a sheet belongs to a control on the bar's left: a
 * section's lessons come in from the left, under the button that opens them.
 *
 * The two are the same component because they are the same thing: a surface
 * that slides in over a scrim and owns focus until it is dismissed. Only the
 * edge it enters from changes, and that is a viewport question — unlike touch
 * targets, which are a pointer question.
 *
 * A dialog gets its lift from the scrim rather than from a lighter surface,
 * so a sheet is on the dashboard cards' surface, a notch above the bars, and
 * not on the lighter overlay that menus use.
 */
export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  side = 'right',
  fit = false,
  docked,
}: {
  side?: 'left' | 'right'
  /** As wide as what is in it, up to the usual width, rather than always that wide: a list of names. */
  fit?: boolean
  /**
   * Docked over the workspace rather than over a scrim: for settings whose
   * effect is watched as they change. Not modal — it does not trap Tab or stop
   * the page scrolling — and a press on `within` (the bar) leaves it open.
   * `className` places it; `id` lets its button point at it.
   */
  docked?: { className: string; id?: string; within?: string }
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  const panelRef = React.useRef<HTMLDivElement>(null)
  const isNarrow = useMediaQuery('(max-width: 47.999rem)')
  const titleId = React.useId()
  const descriptionId = React.useId()
  const modal = !docked

  useDismissable(open, onClose, [panelRef], docked?.within)
  useFocusTrap(open && modal, panelRef)

  // Focus moves into the panel on open. A modal sheet also stops the page
  // behind it scrolling and gives focus back on close; without both, a
  // keyboard user tabs into content they cannot see. A docked panel leaves the
  // page as it is, and its owner says where focus goes when it closes.
  React.useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    if (!modal) return
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [open, modal])

  if (!open) return null

  const header = (
    <header className="flex items-start justify-between gap-4 border-b border-[var(--ds-border-subtle)] px-5 py-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 id={titleId} className="text-h4 text-[var(--ds-fg)]">
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className="text-body-sm text-[var(--ds-fg-muted)]">
            {description}
          </p>
        )}
      </div>
      <IconButton label="Close" icon={<X />} size="sm" onClick={onClose} />
    </header>
  )

  if (docked) {
    return (
      <div
        ref={panelRef}
        id={docked.id}
        role="dialog"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={docked.className}
      >
        {header}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">{children}</div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex" role="presentation">
      <div
        className="absolute inset-0 bg-[var(--ds-layer-scrim)] motion-safe:animate-[fade-in_160ms_cubic-bezier(0.2,0,0,1)_both]"
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          'relative flex flex-col bg-[var(--c-bar-raised)] shadow-e5 outline-none',
          side === 'left' ? 'mr-auto' : 'ml-auto',
          !isNarrow && (fit ? 'w-max max-w-[min(26rem,100%)]' : 'w-[26rem] max-w-full'),
          isNarrow
            ? 'mt-auto max-h-[88dvh] w-full rounded-t-[var(--radius-2xl)] border-t border-[var(--ds-border)] motion-safe:animate-[sheet-in_260ms_cubic-bezier(0.32,0.72,0,1)_both]'
            : side === 'left'
              ? 'h-full border-r border-[var(--ds-border)] motion-safe:animate-[drawer-in-left_260ms_cubic-bezier(0.32,0.72,0,1)_both]'
              : 'h-full border-l border-[var(--ds-border)] motion-safe:animate-[drawer-in-right_260ms_cubic-bezier(0.32,0.72,0,1)_both]',
        )}
      >
        {isNarrow && (
          <div className="flex justify-center pt-2" aria-hidden>
            <span className="h-1 w-9 rounded-full bg-[var(--ds-border-strong)]" />
          </div>
        )}
        {header}

        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer && (
          <footer className="flex items-center justify-end gap-2 coarse:gap-3 border-t border-[var(--ds-border-subtle)] px-5 py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}
