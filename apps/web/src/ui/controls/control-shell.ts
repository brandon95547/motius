import { cn } from '@/lib/cn'

/* ===========================================================================
   FORM CONTROLS — UI Bible spec.

   The field sits on --ds-field, which is ABOVE every surface in the ramp, the
   overlay included. Material 3's rule and the Bible's: a control you can act
   on is a surface standing on the page, not a hole cut into it. Using the
   inset token here lands a field below the card it sits in, which reads as a
   recess and — on a near-black canvas — as a control that has been switched
   off.
   ======================================================================== */

export type ControlSize = 'sm' | 'md'

export const controlSizes: Record<ControlSize, string> = {
  sm: 'h-8 text-body-sm rounded-[var(--radius-md)]',
  md: 'h-9 text-body rounded-[var(--radius-md)]',
}

export function controlShell(disabled?: boolean) {
  return cn(
    'w-full bg-[var(--ds-field)] border border-[var(--ds-border-interactive)]',
    'transition-[border-color,box-shadow,background-color] duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)]',
    // The hover lift is the other half of "this is a control": it answers the
    // pointer. Suppressed when disabled, which is not a control.
    !disabled && 'hover:bg-[var(--ds-field-hover)] hover:border-[var(--ds-border-strong)]',
    // Focus is a border colour change plus a 3px halo. The halo is what makes
    // it visible at a glance; the border change is what makes it precise.
    'focus:outline-none focus-visible:outline-none',
    'focus:border-[var(--ds-accent)] focus:shadow-[0_0_0_3px_var(--ds-accent-subtle)]',
    disabled && 'cursor-not-allowed opacity-50',
  )
}
