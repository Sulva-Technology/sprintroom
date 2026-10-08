import {
  House,
  FolderKanban,
  Users,
  Repeat2,
  Timer,
  Wallet,
  Settings,
  MailPlus,
  Menu,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = { href: string; label: string; icon: LucideIcon; mobile: boolean }

/**
 * The single navigation list. Desktop shows all of it; mobile shows the
 * `mobile: true` items plus "More", and the More page lists the rest.
 * Two spaces: Home (me) and Team (us) — everything else supports one of them.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: House, mobile: true },
  { href: '/dashboard/projects', label: 'Projects', icon: FolderKanban, mobile: true },
  { href: '/dashboard/team', label: 'Team', icon: Users, mobile: true },
  { href: '/dashboard/rhythms', label: 'Rhythms', icon: Repeat2, mobile: true },
  { href: '/dashboard/focus', label: 'Focus', icon: Timer, mobile: false },
  { href: '/dashboard/finances', label: 'Finances', icon: Wallet, mobile: false },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings, mobile: false },
]

const MORE_ITEM: NavItem = { href: '/dashboard/more', label: 'More', icon: Menu, mobile: true }
const INVITES_ITEM: NavItem = { href: '/dashboard/invites', label: 'Invites', icon: MailPlus, mobile: false }

export function mobileNavItems(): NavItem[] {
  return [...NAV_ITEMS.filter((i) => i.mobile), MORE_ITEM]
}

export function moreNavItems(): NavItem[] {
  return [...NAV_ITEMS.filter((i) => !i.mobile), INVITES_ITEM]
}

export function isNavActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(`${href}/`)
}
