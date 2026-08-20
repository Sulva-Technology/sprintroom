/**
 * Multi-tenant boundary harness.
 *
 * Threat model: `memberA` is a legitimate member of workspace A and has NO
 * membership in workspace B. Every test below asserts a DENIAL.
 *
 * Requires a local stack: `supabase start` (Docker). Set SUPABASE_TEST_URL /
 * SUPABASE_TEST_ANON_KEY / SUPABASE_TEST_SERVICE_KEY, or let it default to the
 * standard local ports. FAILS LOUDLY (never silently skips) when the stack is
 * unreachable, so CI without Docker cannot report a false green.
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

const ws: Record<string, string> = {}
const ids: Record<string, string> = {}
const cli: Record<string, SupabaseClient> = {}
const row: Record<string, string> = {}

const USERS: Array<[string, string]> = [
  ['ownerA', 'owner'],
  ['adminA', 'admin'],
  ['memberA', 'member'],
  ['viewerA', 'viewer'],
  ['ownerB', 'owner'],
]

async function signIn(email: string): Promise<SupabaseClient> {
  const c = createClient(URL, ANON, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw error
  return c
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
    const email = name.toLowerCase() + '@rls.test'
    const created = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
    })
    if (created.data.user) ids[name] = created.data.user.id
  }

  for (const w of ['A', 'B']) {
    const { data } = await admin
      .from('workspaces')
      .insert({ name: 'ws-' + w, owner_id: ids['owner' + w] })
      .select('id')
      .single()
    ws[w] = data!.id
  }

  // A gets owner/admin/member/viewer. B gets its owner only.
  for (const [name, role] of USERS) {
    const w = name.endsWith('A') ? 'A' : 'B'
    await admin
      .from('workspace_members')
      .upsert(
        { workspace_id: ws[w], user_id: ids[name], role },
        { onConflict: 'workspace_id,user_id' },
      )
  }

  for (const w of ['A', 'B']) {
    const { data: p } = await admin
      .from('projects')
      .insert({ workspace_id: ws[w], name: 'proj-' + w, created_by: ids['owner' + w] })
      .select('id')
      .single()
    row['project' + w] = p!.id

    const { data: t } = await admin
      .from('tasks')
      .insert({
        project_id: p!.id,
        workspace_id: ws[w],
        title: 'secret-task-' + w,
        created_by: ids['owner' + w],
      })
      .select('id')
      .single()
    row['task' + w] = t!.id

    const { data: s } = await admin
      .from('focus_sessions')
      .insert({
        user_id: ids['owner' + w],
        workspace_id: ws[w],
        status: 'active',
        duration_minutes: 25,
      })
      .select('id')
      .single()
    row['session' + w] = s!.id
  }

  for (const [name] of USERS) cli[name] = await signIn(name.toLowerCase() + '@rls.test')
}, 180_000)

afterAll(async () => {
  if (!reachable) return
  for (const w of ['A', 'B']) await admin.from('workspaces').delete().eq('id', ws[w])
  for (const name of Object.keys(ids)) await admin.auth.admin.deleteUser(ids[name])
})

/** Never let an unreachable stack read as a pass. */
function gate() {
  if (!reachable) {
    throw new Error(
      'local Supabase unreachable, so this denial is UNPROVEN: ' + unreachableReason,
    )
  }
}

describe('cross-workspace reads (memberA has no membership in B)', () => {
  it('cannot SELECT B tasks by workspace', async () => {
    gate()
    const { data } = await cli.memberA.from('tasks').select('id,title').eq('workspace_id', ws.B)
    expect(data ?? []).toHaveLength(0)
  })

  it('cannot SELECT a B task by direct id', async () => {
    gate()
    const { data } = await cli.memberA.from('tasks').select('id').eq('id', row.taskB)
    expect(data ?? []).toHaveLength(0)
  })

  it('cannot SELECT B projects, members, or sessions', async () => {
    gate()
    const targets: Array<[string, string]> = [
      ['projects', ws.B],
      ['workspace_members', ws.B],
      ['focus_sessions', ws.B],
    ]
    for (const [table, val] of targets) {
      const { data } = await cli.memberA.from(table).select('*').eq('workspace_id', val)
      expect(data ?? [], table + ' leaked across the boundary').toHaveLength(0)
    }
  })

  it('cannot reach B rows through a PostgREST embed', async () => {
    gate()
    const { data } = await cli.memberA
      .from('projects')
      .select('id, tasks(id,title)')
      .eq('workspace_id', ws.B)
    expect(data ?? []).toHaveLength(0)
  })
})

describe('cross-workspace writes', () => {
  it('cannot UPDATE a B task', async () => {
    gate()
    await cli.memberA.from('tasks').update({ title: 'pwned' }).eq('id', row.taskB)
    const { data } = await admin.from('tasks').select('title').eq('id', row.taskB).single()
    expect(data!.title).toBe('secret-task-B')
  })

  it('cannot DELETE a B task', async () => {
    gate()
    await cli.memberA.from('tasks').delete().eq('id', row.taskB)
    const { count } = await admin
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('id', row.taskB)
    expect(count).toBe(1)
  })

  it('cannot INSERT a task into B', async () => {
    gate()
    const { error } = await cli.memberA
      .from('tasks')
      .insert({ project_id: row.projectB, workspace_id: ws.B, title: 'implant' })
    expect(error, 'insert into a foreign workspace was ALLOWED').toBeTruthy()
  })

  it('cannot relocate an A task into B by writing workspace_id', async () => {
    gate()
    await cli.memberA.from('tasks').update({ workspace_id: ws.B }).eq('id', row.taskA)
    const { data } = await admin.from('tasks').select('workspace_id').eq('id', row.taskA).single()
    expect(data!.workspace_id, 'task was relocated across the tenant boundary').toBe(ws.A)
  })

  it('cannot re-parent an A task onto a B project', async () => {
    gate()
    await cli.memberA.from('tasks').update({ project_id: row.projectB }).eq('id', row.taskA)
    const { data } = await admin.from('tasks').select('project_id').eq('id', row.taskA).single()
    expect(data!.project_id, 'task re-parented into a foreign project').toBe(row.projectA)
  })
})

describe('viewer is read-only inside its own workspace', () => {
  it('viewerA cannot UPDATE a task', async () => {
    gate()
    const before = await admin.from('tasks').select('title').eq('id', row.taskA).single()
    await cli.viewerA.from('tasks').update({ title: 'viewer-write' }).eq('id', row.taskA)
    const after = await admin.from('tasks').select('title').eq('id', row.taskA).single()
    expect(after.data!.title).toBe(before.data!.title)
  })

  it('viewerA cannot UPDATE a project', async () => {
    gate()
    const before = await admin.from('projects').select('name').eq('id', row.projectA).single()
    await cli.viewerA.from('projects').update({ name: 'viewer-write' }).eq('id', row.projectA)
    const after = await admin.from('projects').select('name').eq('id', row.projectA).single()
    expect(after.data!.name).toBe(before.data!.name)
  })

  it('viewerA cannot INSERT a task', async () => {
    gate()
    const { error } = await cli.viewerA
      .from('tasks')
      .insert({ project_id: row.projectA, workspace_id: ws.A, title: 'viewer-insert' })
    expect(error, 'viewer INSERT was allowed').toBeTruthy()
  })

  it('viewerA cannot DELETE a task', async () => {
    gate()
    await cli.viewerA.from('tasks').delete().eq('id', row.taskA)
    const { count } = await admin
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('id', row.taskA)
    expect(count).toBe(1)
  })
})

describe('focus sessions are private to their owner', () => {
  it('memberA cannot increment distractions on another user session', async () => {
    gate()
    const before = await admin
      .from('focus_sessions')
      .select('distractions_count')
      .eq('id', row.sessionA)
      .single()
    await cli.memberA
      .from('focus_sessions')
      .update({ distractions_count: (before.data!.distractions_count ?? 0) + 99 })
      .eq('id', row.sessionA)
    const after = await admin
      .from('focus_sessions')
      .select('distractions_count')
      .eq('id', row.sessionA)
      .single()
    expect(after.data!.distractions_count).toBe(before.data!.distractions_count)
  })

  it('memberA cannot READ a B session', async () => {
    gate()
    const { data } = await cli.memberA.from('focus_sessions').select('id').eq('id', row.sessionB)
    expect(data ?? []).toHaveLength(0)
  })
})

describe('global search is workspace-scoped', () => {
  it('an ilike title search never returns a B task', async () => {
    gate()
    const { data } = await cli.memberA
      .from('tasks')
      .select('id,title,workspace_id')
      .ilike('title', '%secret-task%')
    expect(
      (data ?? []).every((r: any) => r.workspace_id === ws.A),
      'search crossed the tenant boundary',
    ).toBe(true)
  })

  it('a wildcard-only search term cannot widen the result set', async () => {
    gate()
    const { data } = await cli.memberA.from('tasks').select('id,workspace_id').ilike('title', '%%')
    expect((data ?? []).every((r: any) => r.workspace_id === ws.A)).toBe(true)
  })
})
