import { describe, expect, it } from 'vitest'
import { NAV_ITEMS, mobileNavItems, moreNavItems, isNavActive } from '@/lib/navigation'

describe('navigation', () => {
  it('fits the mobile bar (max 5) and ends with More', () => {
    const items = mobileNavItems()
    expect(items.length).toBeLessThanOrEqual(5)
    expect(items.at(-1)?.href).toBe('/dashboard/more')
  })

  it('makes every destination reachable on mobile (bar or More page)', () => {
    const reachable = new Set([...mobileNavItems(), ...moreNavItems()].map((i) => i.href))
    for (const item of NAV_ITEMS) expect(reachable.has(item.href)).toBe(true)
    expect(reachable.has('/dashboard/invites')).toBe(true)
  })

  it('has no duplicate destinations', () => {
    const hrefs = NAV_ITEMS.map((i) => i.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it('matches Home exactly and sections by prefix', () => {
    expect(isNavActive('/dashboard', '/dashboard')).toBe(true)
    expect(isNavActive('/dashboard/team', '/dashboard')).toBe(false)
    expect(isNavActive('/dashboard/projects/abc', '/dashboard/projects')).toBe(true)
    expect(isNavActive('/dashboard/projectsx', '/dashboard/projects')).toBe(false)
  })

  it('puts Cycle in the mobile bar and moves Rhythms to More', () => {
    expect(mobileNavItems().map((i) => i.href)).toEqual([
      '/dashboard',
      '/dashboard/projects',
      '/dashboard/cycle',
      '/dashboard/team',
      '/dashboard/more',
    ])
    expect(moreNavItems().map((i) => i.href)).toContain('/dashboard/rhythms')
  })
})
