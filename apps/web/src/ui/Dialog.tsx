import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { IconButton } from './Button'
import { useDismissable, useFocusTrap, useMediaQuery } from '@/lib/hooks'

/* ===========================================================================
   DIALOG — UI Bible spec.

   A panel in the middle of the screen, over a scrim. It stops everything, so
   it is for the short task the page behind makes no sense without: choosing
   the song before there is a song to show. Anything read beside the workspace,
   or changed while watching it land, is a Drawer.

   Three sizes, one shape: every dialog is 4:3 — a notice (30 x 22.5rem: a
   line or two to read and close, as which hand is which), small (48 x 36rem:
   a lesson's introduction and results) or large (64 x 48rem: a picker that
   needs the room) — so one dialog never looks like a different kind of thing
   from another. On a screen too short or narrow for it, the whole panel
   scales down, still 4:3, rather than being squashed. Its height is fixed by
   its shape, so the body scrolls when it says more than fits, while the
   header and footer stay put. On a phone a small or large one fills the
   screen: a centered panel there has no margins to spare. A notice stays a
   card in the middle, as it fits.
   ======================================================================== */

export type DialogSize = 'notice' | 'sm' | 'lg'

/* The width, and through the 4:3 shape the height: no wider than the size,
   than the screen less its margins, or than the screen's height allows. */
const widths: Record<DialogSize, string> = {
  notice: 'w-[min(30rem,calc(100vw-2rem),calc((100dvh-3rem)*4/3))]',
  sm: 'w-[min(48rem,calc(100vw-3rem),calc((100dvh-3rem)*4/3))]',
  lg: 'w-[min(64rem,calc(100vw-3rem),calc((100dvh-3rem)*4/3))]',
}

export function Dialog({
  open,
  onClose,
  eyebrow,
  title,
  description,
  children,
  footer,
  size = 'sm',
  flush,
}: {
  open: boolean
  onClose: () => void
  /** Where it is, in small capitals above the title: a chapter, a section. */
  eyebrow?: string
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: DialogSize
  /** The body lays itself out and scrolls its own regions: no padding here. */
  flush?: boolean
}) {
  const panelRef = React.useRef<HTMLDivElement>(null)
  const isNarrow = useMediaQuery('(max-width: 39.999rem)')
  const titleId = React.useId()
  const descriptionId = React.useId()

  useDismissable(open, onClose, [panelRef])
  useFocusTrap(open, panelRef)

  // Focus moves into the panel on open and goes back where it was on close,
  // and the page behind stops scrolling. The panel takes the focus rather than
  // its first field: on a touch screen a focused field brings up the keyboard
  // over the thing that was just opened.
  React.useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className={cn('fixed inset-0 z-50 grid place-items-center', !isNarrow && 'p-6')}
      role="presentation"
    >
      {/* Dimmed and a little out of focus: the page reads as paused, not gone. */}
      <div
        className="absolute inset-0 bg-[var(--ds-layer-scrim)] backdrop-blur-[2px] motion-safe:animate-[fade-in_160ms_cubic-bezier(0.2,0,0,1)_both]"
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
          'relative flex flex-col overflow-hidden bg-[var(--c-bar-raised)] shadow-e5 outline-none',
          'motion-safe:animate-[scale-in_200ms_cubic-bezier(0.32,0.72,0,1)_both]',
          isNarrow && size !== 'notice'
            ? 'h-dvh w-full'
            : cn(
                'aspect-[4/3] rounded-[var(--radius-2xl)] border border-[var(--ds-border)]',
                widths[size],
              ),
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--ds-border-subtle)] px-6 pt-5 pb-4">
          <div className="flex min-w-0 flex-col gap-1">
            {eyebrow && (
              <p className="text-label uppercase tracking-[0.09em] text-[var(--ds-fg-secondary)]">
                {eyebrow}
              </p>
            )}
            <h2 id={titleId} className="text-h3 text-[var(--ds-fg)]">
              {title}
            </h2>
            {description && (
              // A subheading, in the text's own colour: on the dark panel a
              // muted grey under a bright title read as faint.
              <p id={descriptionId} className="text-body-lg font-medium text-[var(--ds-fg)]">
                {description}
              </p>
            )}
          </div>
          <IconButton label="Close" icon={<X />} size="sm" onClick={onClose} />
        </header>

        <div
          className={cn(
            // What a dialog says is read, so it is in the text's own colour.
            'min-h-0 flex-1 text-body text-[var(--ds-fg)]',
            flush ? 'flex flex-col' : 'overflow-y-auto px-6 py-5',
          )}
        >
          {children}
        </div>

        {footer && (
          <footer className="flex items-center justify-end gap-2.5 coarse:gap-3 border-t border-[var(--ds-border-subtle)] px-6 py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}
