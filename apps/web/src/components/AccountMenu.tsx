import * as React from 'react'
import { LogOut, Settings, SlidersHorizontal } from 'lucide-react'
import type { User } from '@motius/shared'
import { signOut } from '@/features/account/sign-out'
import { findCategory } from '@/lib/outline/outline'
import { useAccountStore } from '@/state/account-store'
import { panelActions } from '@/state/panel-store'
import { pageActions, usePageStore } from '@/state/page-store'
import { ActionMenu, type MenuAction } from '@/ui/Menu'

/**
 * Who is signed in, at the far right of the bar: their picture (or their
 * initials) in a circle, and behind it what is theirs — their settings, their
 * progress, an admin's Lesson settings, and signing out. Settings lives here
 * and nowhere else on the bar.
 */
export function AccountMenu() {
  const user = useAccountStore((state) => state.user)
  const page = usePageStore((state) => state.page)
  const category = usePageStore((state) => state.category)
  if (!user) return null
  const progress = findCategory('progress')

  const actions: MenuAction[] = [
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings size={16} />,
      onSelect: () => panelActions.open('settings'),
      heading: user.email,
    },
    ...(progress
      ? [
          {
            id: 'progress',
            label: 'Progress',
            icon: <progress.icon size={16} />,
            checked: page === 'category' && category === 'progress',
            onSelect: () => pageActions.openCategory(progress),
          },
        ]
      : []),
    // The admin's page: how each lesson opens, for everybody.
    ...(user.isAdmin
      ? [
          {
            id: 'lesson-settings',
            label: 'Lesson settings',
            icon: <SlidersHorizontal size={16} />,
            checked: page === 'admin',
            onSelect: pageActions.openAdmin,
          },
        ]
      : []),
    {
      id: 'sign-out',
      label: 'Sign out',
      icon: <LogOut size={16} />,
      onSelect: () => void signOut(),
      separated: true,
    },
  ]

  return (
    <ActionMenu
      label={`Account: ${user.name}`}
      icon={<Avatar user={user} />}
      actions={actions}
      className="account-button"
    />
  )
}

/** The account's picture from Google, or its initials where there is none or it will not load. */
function Avatar({ user }: { user: User }) {
  const [broken, setBroken] = React.useState(false)
  if (user.picture && !broken) {
    return (
      <img
        className="account-button__picture"
        src={user.picture}
        alt=""
        width={32}
        height={32}
        // Google's picture host refuses requests that say where they came from.
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
      />
    )
  }
  const initials =
    user.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]!.toUpperCase())
      .join('') || user.email[0]!.toUpperCase()
  return (
    <span className="account-button__initials" aria-hidden>
      {initials}
    </span>
  )
}
