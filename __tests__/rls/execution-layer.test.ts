/**
 * Execution-layer harness: cycles, notifications, labels.
 * Same contract as multi-tenant-boundary.test.ts: needs `supabase start`,
 * FAILS LOUDLY when the stack is unreachable. `outsider` owns workspace X and
 * has no membership in W.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const ANON = process.env.SUPABASE_TEST_ANON_KEY ?? ''
const SERVICE = process.env.SUPABASE_TEST_SERVICE_KEY ?? ''
const PASSWORD = 'Passw0rd!test'

let reachable = false
let unreachableReason = 'SUPABASE_TEST_ANON_KEY / SUPABASE_TEST_SERVICE_KEY not set'
let admin: SupabaseClient

const ids: Record<string, string> = {}
const cli: Record<string, SupabaseClient> = {}
const row: Record<string, string> = {}

const USERS: Array<[string, string, 'W' | 'X']> = [
  ['owner', 'owner', 'W'],
  ['member', 'member', 'W'],
  ['viewer', 'viewer', 'W'],
  ['outsider', 'owner', 'X'],
]

const todayKey = () => new Date().toISOString().slice(0, 10)
const daysFromToday = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

async function signIn(email: string): Promise<SupabaseClient> {
  const c = createClient(URL, ANON, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw error
  return c
}

function gate() {
  if (!reachable) throw new Error('local Supabase unreachable, so this proof is UNPROVEN: ' + unreachableReason)
}

beforeAll(async () => {
  if (!SERVICE || !ANON) return
  admin = createClient(URL, SERVICE, { auth: { persistSession: false } })
  const probe = await admin.from('workspaces').select('id').limit(1)
  if (probe.error) {
    unreachableReason = probe.error.message
    return
  }
  reachable = true

  for (const [name] of USERS) {
    const created = await admin.auth.admin.createUser({ email: `${name}@exec.test`, password: PASSWORD, email_confirm: true })
    if (created.data.user) ids[name] = created.data.user.id
  }

  for (const w of ['W', 'X'] as const) {
    const owner = w === 'W' ? ids.owner : ids.outsider
    const { data } = await admin.from('workspaces').insert({ name: 'exec-' + w, owner_id: owner }).select('id').single()
    row['ws' + w] = data!.id
    const { data: p } = await admin.from('projects').insert({ workspace_id: data!.id, name: 'proj-' + w, created_by: owner }).select('id').single()
    row['project' + w] = p!.id
  }

  for (const [name, role, w] of USERS) {
    await admin.from('workspace_members').upsert(
      { workspace_id: row['ws' + w], user_id: ids[name], role },
      { onConflict: 'workspace_id,user_id' },
    )
  }

  const { data: t } = await admin
    .from('tasks')
    .insert({ project_id: row.projectW, workspace_id: row.wsW, title: 'exec-task', created_by: ids.owner })
    .select('id')
    .single()
  row.taskW = t!.id

  for (const [name] of USERS) cli[name] = await signIn(`${name}@exec.test`)
}, 180_000)

afterAll(async () => {
  if (!reachable) return
  await admin.from('workspaces').delete().in('id', [row.wsW, row.wsX])
  for (const name of Object.keys(ids)) await admin.auth.admin.deleteUser(ids[name])
})

describe('cycles', () => {
  it('rollover moves unfinished tasks forward and freezes the score', async () => {
    gate()
    const { data: old } = await admin
      .from('cycles')
      .insert({ workspace_id: row.wsW, name: 'old', starts_on: daysFromToday(-14), ends_on: daysFromToday(-8) })
      .select('id')
      .single()
    const { data: open } = await admin
      .from('tasks')
      .insert({ project_id: row.projectW, workspace_id: row.wsW, title: 'open', created_by: ids.owner, status: 'today', cycle_id: old!.id })
      .select('id')
      .single()
    const { data: done } = await admin
      .from('tasks')
      .insert({ project_id: row.projectW, workspace_id: row.wsW, title: 'done', created_by: ids.owner, status: 'done', cycle_id: old!.id })
      .select('id')
      .single()

    const { error } = await admin.rpc('rollover_ended_cycles')
    expect(error).toBeNull()

    const { data: closed } = await admin.from('cycles').select('*').eq('id', old!.id).single()
    expect(closed!.completed_at).not.toBeNull()
    expect(closed!.completed_count).toBe(1)
    expect(closed!.carried_over_count).toBe(1)

    const { data: next } = await admin
      .from('cycles')
      .select('id, starts_on, ends_on')
      .eq('workspace_id', row.wsW)
      .is('completed_at', null)
      .single()
    // Idle workspace: the next cycle starts today and keeps the 7-day length.
    expect(next!.starts_on).toBe(todayKey())
    expect(next!.ends_on).toBe(daysFromToday(6))

    const { data: moved } = await admin.from('tasks').select('cycle_id, carry_over_count').eq('id', open!.id).single()
    expect(moved).toEqual({ cycle_id: next!.id, carry_over_count: 1 })
    const { data: stayed } = await admin.from('tasks').select('cycle_id').eq('id', done!.id).single()
    expect(stayed!.cycle_id).toBe(old!.id)
    row.cycleW = next!.id
  })

  it('outsiders cannot see a workspace’s cycles', async () => {
    gate()
    const { data } = await cli.outsider.from('cycles').select('id').eq('workspace_id', row.wsW)
    expect(data ?? []).toHaveLength(0)
  })

  it('viewers cannot create cycles', async () => {
    gate()
    const { error } = await cli.viewer
      .from('cycles')
      .insert({ workspace_id: row.wsW, name: 'nope', starts_on: daysFromToday(30), ends_on: daysFromToday(36) })
    expect(error).not.toBeNull()
  })

  it('a task cannot join a cycle from another workspace', async () => {
    gate()
    const { data: foreign } = await admin
      .from('cycles')
      .insert({ workspace_id: row.wsX, name: 'x', starts_on: todayKey(), ends_on: daysFromToday(6) })
      .select('id')
      .single()
    const { error } = await cli.member.from('tasks').update({ cycle_id: foreign!.id }).eq('id', row.taskW)
    expect(error?.message ?? '').toContain('Cycle belongs to a different workspace')
  })

  it('clients cannot run the rollover', async () => {
    gate()
    const { error } = await cli.member.rpc('rollover_ended_cycles')
    expect(error).not.toBeNull()
  })
})

describe('notifications', () => {
  async function inbox(user: string, type: string) {
    const { data } = await admin
      .from('notifications')
      .select('id, actor_id')
      .eq('user_id', ids[user])
      .eq('task_id', row.taskW)
      .eq('type', type)
    return data ?? []
  }

  it('assigning a task notifies the assignee, not the actor', async () => {
    gate()
    await cli.owner.from('tasks').update({ owner_id: ids.member }).eq('id', row.taskW)
    expect(await inbox('member', 'assigned')).toHaveLength(1)
    expect(await inbox('owner', 'assigned')).toHaveLength(0)
  })

  it('a comment notifies the owner and creator, never the commenter', async () => {
    gate()
    await cli.member
      .from('task_comments')
      .insert({ task_id: row.taskW, user_id: ids.member, content: 'on it', workspace_id: row.wsW, project_id: row.projectW })
    expect(await inbox('owner', 'comment')).toHaveLength(1)
    expect(await inbox('member', 'comment')).toHaveLength(0)
  })

  it('marking blocked notifies the owner and creator except the actor', async () => {
    gate()
    await cli.owner.from('tasks').update({ status: 'blocked', blocked_reason: 'waiting on API' }).eq('id', row.taskW)
    expect(await inbox('member', 'blocked')).toHaveLength(1)
    expect(await inbox('owner', 'blocked')).toHaveLength(0)
  })

  it('users only see their own notifications', async () => {
    gate()
    const { data } = await cli.owner.from('notifications').select('id').eq('user_id', ids.member)
    expect(data ?? []).toHaveLength(0)
  })

  it('clients cannot forge notifications', async () => {
    gate()
    const { error } = await cli.member
      .from('notifications')
      .insert({ user_id: ids.owner, workspace_id: row.wsW, type: 'assigned', body: 'fake' })
    expect(error).not.toBeNull()
  })
})
