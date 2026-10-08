import { describe, expect, it, vi, beforeEach } from 'vitest'

/**
 * Unassigning used to be impossible: assignOwner's schema required a uuid, so
 * `assignOwner(id, null, pid)` failed validation. It also wrote no activity.
 */

const TASK = '11111111-1111-4111-8111-111111111111'
const PROJECT = '22222222-2222-4222-8222-222222222222'
const WS = '33333333-3333-4333-8333-333333333333'

const writes: { table: string; op: string; payload: unknown }[] = []
let updatedRow: Record<string, unknown> | null = { id: TASK, project_id: PROJECT, workspace_id: WS }

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
// tasks.ts imports the workspace resolver, which imports next/headers.
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'actor' } } }) },
    from: (table: string) => {
      const q: any = {
        update: (payload: unknown) => {
          writes.push({ table, op: 'update', payload })
          return q
        },
        insert: async (payload: unknown) => {
          writes.push({ table, op: 'insert', payload })
          return { error: null }
        },
        eq: () => q,
        select: () => q,
        maybeSingle: async () => ({ data: updatedRow, error: null }),
      }
      return q
    },
  }),
}))

import { assignOwner } from '@/app/actions/tasks'

describe('assignOwner', () => {
  beforeEach(() => {
    writes.length = 0
    updatedRow = { id: TASK, project_id: PROJECT, workspace_id: WS }
  })

  it('can unassign a task', async () => {
    const res = await assignOwner(TASK, null, PROJECT)
    expect(res.success).toBe(true)
    expect(writes[0]).toEqual({ table: 'tasks', op: 'update', payload: { owner_id: null } })
  })

  it('records an activity entry', async () => {
    await assignOwner(TASK, null, PROJECT)
    expect(writes[1]).toMatchObject({
      table: 'task_activity',
      op: 'insert',
      payload: { task_id: TASK, workspace_id: WS, user_id: 'actor', type: 'unassigned' },
    })
  })

  it('reports an RLS-blocked update instead of claiming success', async () => {
    updatedRow = null
    const res = await assignOwner(TASK, null, PROJECT)
    expect(res.success).toBe(false)
  })
})
