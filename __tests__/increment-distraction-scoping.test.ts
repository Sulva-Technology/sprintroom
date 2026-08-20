import { describe, expect, it, vi, beforeEach } from 'vitest'

/**
 * P1-4 regression.
 *
 * `incrementDistraction(sessionId)` did no auth check and read the session with
 * `.eq('id', ...)` only. "Sessions viewable by members" lets any workspace
 * member READ a colleague's session, so the read succeeded for someone else's
 * row; the UPDATE was then blocked by "Sessions updatable by owner" but the
 * result was never checked and the action still resolved cleanly. Because the
 * offline sync queue treats a clean resolve as "synced", the queued item was
 * deleted — a denied write reported as success.
 *
 * Before the fix this test failed three ways: no getUser() call, no user_id
 * filter on either the read or the write, and no return value at all.
 */

const calls: { eq: Array<[string, unknown]>; getUserCalled: boolean } = {
  eq: [],
  getUserCalled: false,
}

let currentUser: { id: string } | null = { id: 'user-1' }
let sessionRow: Record<string, unknown> | null = null

function chain(result: unknown) {
  const target: any = {
    select: () => target,
    update: () => target,
    eq: (col: string, val: unknown) => {
      calls.eq.push([col, val])
      return target
    },
    maybeSingle: async () => result,
    single: async () => result,
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  }
  return target
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => {
        calls.getUserCalled = true
        return { data: { user: currentUser } }
      },
    },
    from: (table: string) => {
      if (table === 'focus_sessions') {
        return chain({ data: sessionRow, error: null })
      }
      return chain({ data: null, error: null })
    },
  }),
}))

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({ redirect: () => {} }))
vi.mock('@/app/actions/workspaces', () => ({ getActiveWorkspaceId: async () => 'ws-1' }))

import { incrementDistraction } from '@/app/actions/focus'

beforeEach(() => {
  calls.eq = []
  calls.getUserCalled = false
  currentUser = { id: 'user-1' }
  sessionRow = null
})

describe('P1-4: incrementDistraction is scoped to the calling user', () => {
  it('requires an authenticated user', async () => {
    currentUser = null
    const result = await incrementDistraction('session-1')

    expect(calls.getUserCalled, 'never called getUser()').toBe(true)
    expect(result).toEqual({ success: false, error: 'Not authenticated' })
  })

  it('filters the read by user_id, not just the session id', async () => {
    sessionRow = { distractions_count: 2, task_id: null }
    await incrementDistraction('session-1')

    expect(calls.eq, 'read/write was not scoped to user_id').toContainEqual(['user_id', 'user-1'])
    expect(calls.eq).toContainEqual(['id', 'session-1'])
  })

  it('reports failure (not success) when the session is not the caller’s', async () => {
    sessionRow = null // RLS + the user_id filter yield no row
    const result = await incrementDistraction('someone-elses-session')

    expect(result, 'a denied write must not resolve as success').toEqual({
      success: false,
      error: 'Focus session not found',
    })
  })

  it('returns success for the owner', async () => {
    sessionRow = { distractions_count: 0, task_id: null }
    const result = await incrementDistraction('session-1')
    expect(result).toEqual({ success: true })
  })
})
