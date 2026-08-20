import { describe, expect, it, vi } from 'vitest'
import { makeFakeSupabase } from './stubs/fake-postgrest'

/**
 * P0-5, APP LAYER ONLY.
 *
 * /dashboard/focus schedules a session with no task and no project. If the
 * action does not resolve a workspace, focus_schedules.workspace_id lands NULL,
 * process_due_focus_schedules copies the NULL onto focus_sessions, and the
 * SELECT policy then hides the session from its own owner.
 *
 * This proves the INSERT carries a workspace. It does NOT prove the RLS policy
 * or the backfill — those need a database.
 */

const fake = makeFakeSupabase({
  workspace_members: [
    { workspace_id: 'workspace-1', created_at: '2026-01-01' },
    { workspace_id: 'workspace-2', created_at: '2026-02-01' },
  ],
})

const supabase = {
  ...fake,
  auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
}

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => supabase }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))

const INPUT = {
  task_id: null,
  start_time: new Date(Date.now() + 3600_000).toISOString(),
  duration_minutes: 25,
}

describe('P0-5 a scheduled session is created with a workspace', () => {
  it('CURRENT working tree: focus_schedules.workspace_id is not null', async () => {
    const { scheduleFocusSession } = await import('@/app/actions/scheduling')
    const result = await scheduleFocusSession(INPUT)

    expect(result, JSON.stringify(result)).toEqual({ success: true })

    const row = fake.inserted.focus_schedules.at(-1)
    console.log('CURRENT insert ->', JSON.stringify(row))
    expect(row.workspace_id, 'workspace_id is NULL — the session will be invisible').toBeTruthy()
    expect(row.workspace_id).toBe('workspace-1')
  })

  it('DISCRIMINATOR — HEAD (pre-fix) inserts a workspace-less schedule', async () => {
    const { scheduleFocusSession } = await import('./head/scheduling.head')
    await scheduleFocusSession(INPUT)

    const row = fake.inserted.focus_schedules.at(-1)
    console.log('HEAD insert ->', JSON.stringify(row))
    expect(row.workspace_id ?? null).toBeNull()
  })
})
