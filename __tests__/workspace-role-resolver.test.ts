import { describe, expect, it, vi, beforeEach } from 'vitest'

/**
 * P1-5 regression: getWorkspaceRole() read the raw `active_workspace_id`
 * cookie. A stale cookie (a workspace the user left) returned null —
 * "Permission denied" — while every page rendered a different, valid
 * workspace via resolveActiveWorkspaceId(). Before the fix this test got
 * `null`; after, it gets the role in the workspace the resolver falls back to.
 */

const A = '11111111-1111-1111-1111-111111111111'
const STALE = '99999999-9999-9999-9999-999999999999'

const memberships = [{ workspace_id: A, role: 'admin', created_at: '2026-01-01T00:00:00Z' }]
let cookieValue: string | undefined = STALE

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'active_workspace_id' && cookieValue ? { value: cookieValue } : undefined,
  }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    from: () => {
      const filters: Record<string, unknown> = {}
      const q: any = {
        select: () => q,
        eq: (col: string, val: unknown) => {
          filters[col] = val
          return q
        },
        limit: () => q,
        order: async () => ({
          data: memberships.map((m) => ({ workspace_id: m.workspace_id, created_at: m.created_at })),
        }),
        maybeSingle: async () => {
          const row = memberships.find((m) => m.workspace_id === filters.workspace_id)
          return { data: row ? { role: row.role } : null }
        },
      }
      return q
    },
  }),
}))

import { getWorkspaceRole } from '@/app/actions/roles'

describe('getWorkspaceRole without an explicit workspace', () => {
  beforeEach(() => {
    cookieValue = STALE
  })

  it('ignores a stale cookie and uses the resolved active workspace', async () => {
    expect(await getWorkspaceRole()).toBe('admin')
  })

  it('uses the resolved workspace when no cookie is set', async () => {
    cookieValue = undefined
    expect(await getWorkspaceRole()).toBe('admin')
  })

  it('still honours an explicit workspace id', async () => {
    expect(await getWorkspaceRole(STALE)).toBeNull()
    expect(await getWorkspaceRole(A)).toBe('admin')
  })
})
