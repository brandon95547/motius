import { cn } from '@/lib/cn'
import { pageActions, usePageStore } from '@/state/page-store'
import { DESTINATIONS, HOME } from '@/features/areas/areas'

/**
 * The places at the top of the app that are not cards on the dashboard, in one
 * row along the bottom: the dashboard itself, then Lessons, Songs, Practice,
 * Progress and Search.
 *
 * On the dashboard and the pages under it, and not in an area: there the
 * bottom of the screen is the keyboard's, and the way out is the menu's.
 *
 * Drawn to the dashboard mock (new dashboard.png, 2026-10-12), which has six
 * places where the Bible stops at five and keeps the bar on a wide screen
 * where the Bible would have a sidebar. So the six are a group in the middle
 * of the bar rather than spread across it, and on a phone each still has its
 * word under its icon.
 */
export function BottomNav() {
  const page = usePageStore((state) => state.page)
  const category = usePageStore((state) => state.category)
  // The nine categories have no place of their own here: each is a page under
  // the dashboard, so Home is where you are on any of them.
  const here =
    page !== 'dashboard' && DESTINATIONS.some((place) => place.id === category) ? category : HOME.id

  const items = [
    { ...HOME, open: pageActions.openDashboard },
    ...DESTINATIONS.map((place) => ({
      id: place.id,
      label: place.label,
      icon: place.icon,
      open: () => pageActions.openCategory(place),
    })),
  ]

  return (
    <nav className="bottom-nav" aria-label="Primary">
      <ul className="bottom-nav__row">
        {items.map(({ id, label, icon: Icon, open }) => (
          <li key={id} className="bottom-nav__slot">
            <button
              type="button"
              className={cn('bottom-nav__item', here === id && 'bottom-nav__item--here')}
              aria-current={here === id ? 'page' : undefined}
              onClick={open}
            >
              <Icon size={20} />
              <span className="bottom-nav__label">{label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
