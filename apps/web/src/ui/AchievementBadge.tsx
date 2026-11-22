import { Lock, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * A badge as it is drawn: a shield with its icon, in the lessons' violet once
 * earned — gold for a whole section — and grey with a lock until then. One drawing for the Progress page's
 * badges and the reveal after a lesson; `size` is its width in pixels.
 *
 * The shields are placeholders until the badge art is drawn: the same shape
 * for every badge, the icon saying which.
 */
export function AchievementBadge({
  icon: Icon,
  earned,
  gold = false,
  size = 64,
  className,
}: {
  icon: LucideIcon
  earned: boolean
  /** Gold once earned, for finishing a whole section; violet otherwise. */
  gold?: boolean
  size?: number
  className?: string
}) {
  return (
    <span
      className={cn('achievement-badge', className)}
      data-earned={earned}
      data-gold={gold && earned}
      style={{ width: size, height: size * 1.125 }}
      aria-hidden
    >
      <svg viewBox="0 0 64 72" className="achievement-badge__shield">
        <path d="M32 2 60 12v22c0 17-12 29-28 36C16 63 4 51 4 34V12Z" />
        <path
          className="achievement-badge__rim"
          d="M32 8 54 16v18c0 13.5-9.3 23.4-22 29.4C19.3 57.4 10 47.5 10 34V16Z"
        />
      </svg>
      <Icon className="achievement-badge__icon" size={Math.round(size * 0.42)} strokeWidth={1.75} />
      {!earned && <Lock className="achievement-badge__lock" size={Math.round(size * 0.22)} />}
    </span>
  )
}
