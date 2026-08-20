import { describe, expect, it, vi, beforeEach } from 'vitest'
import { makeFakeSupabase } from './stubs/fake-postgrest'
import * as denoHttp from './stubs/deno-http'
import * as supabaseStub from './stubs/supabase-js'

/**
 * P0-2. Executes the REAL edge function source under a fake PostgREST that
 * rejects unknown columns (PGRST204) and NOT NULL violations (23502) exactly
 * as the live database does. Column set is parsed from supabase/migrations/*.
 *
 * Fails if the function still writes `tasks.user_id`, still sends an int
 * priority for a text column, or still tries to insert a rule with no project.
 */

const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString()

const RULES = [
  {
    id: 'rule-with-project',
    user_id: 'user-1',
    project_id: 'project-1',
    template_title: 'Weekly report',
    template_description: 'desc',
    priority: 1,
    frequency: 'daily',
    is_active: true,
    next_run_at: threeDaysAgo,
  },
  {
    id: 'rule-without-project',
    user_id: 'user-1',
    project_id: null,
    template_title: 'Orphan rule',
    priority: 0,
    frequency: 'daily',
    is_active: true,
    next_run_at: threeDaysAgo,
  },
]

const handlers = new Map<string, any>()

async function run(modulePath: string, rules: any[] = RULES) {

  ;(globalThis as any).Deno = {
    env: {
      get: (key: string) =>
        ({
          CRON_SECRET: 'test-secret',
          SUPABASE_URL: 'http://localhost',
          SUPABASE_SERVICE_ROLE_KEY: 'service-role',
        })[key],
    },
  }

  const supabase = makeFakeSupabase({
    task_recurrence_rules: rules,
    projects: [{ id: 'project-1', workspace_id: 'workspace-1' }],
  })
  supabaseStub.__setClient(supabase)

  if (!handlers.has(modulePath)) {
    denoHttp.__reset()
    await import(modulePath)
    handlers.set(modulePath, denoHttp.__getHandler())
  }

  const response = await handlers.get(modulePath)(
    new Request('http://localhost', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-secret' },
    }),
  )

  return { supabase, response, body: await response.json() }
}

describe('P0-2 recurring tasks materialise against the live schema', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('CURRENT working tree: creates the task', async () => {
    const { supabase, response, body } = await run(
      '../../supabase/functions/process-recurring-tasks/index.ts',
    )

    expect(response.status).toBe(200)
    expect(body.tasksCreated, JSON.stringify(body)).toBe(1)

    const task = supabase.inserted.tasks[0]
    expect(Object.keys(task)).not.toContain('user_id')
    expect(typeof task.priority).toBe('string')
    expect(task.created_by).toBe('user-1')
    expect(task.project_id).toBe('project-1')

    // The project-less rule must be skipped, not attempted.
    expect(body.skipped).toBe(1)

    // next_run_at advanced past now, so the rule cannot retry forever.
    const update = supabase.calls.find((c) => c.table === 'task_recurrence_rules' && c.update)
    expect(update, 'next_run_at was never advanced').toBeTruthy()
    expect(new Date(update!.update.next_run_at).getTime()).toBeGreaterThan(Date.now())
  })

  it('DISCRIMINATOR — the same test against HEAD (pre-fix) must fail', async () => {
    const { supabase, response, body } = await run('./head/recurring.head.ts')
    // Pre-fix: every insert is rejected, so no task exists and the caller sees
    // a failure instead of `tasksCreated`.
    expect(supabase.inserted.tasks, 'HEAD unexpectedly inserted a task').toBeUndefined()
    expect(body.tasksCreated).toBeUndefined()
    console.log('HEAD status', response.status, 'body', JSON.stringify(body))
  })

  it('SIDE FINDING — a rule stale by >500 periods is still left in the past', async () => {
    const { supabase } = await run('../../supabase/functions/process-recurring-tasks/index.ts', [
      { ...RULES[0], id: 'ancient', next_run_at: '2020-01-01T00:00:00.000Z' },
    ])

    const update = supabase.calls.find((c) => c.table === 'task_recurrence_rules' && c.update)
    const next = new Date(update!.update.next_run_at).getTime()
    console.log('ancient rule next_run_at ->', new Date(next).toISOString())
    // computeNextRun gives up after `guard < 500` iterations, so a daily rule
    // more than 500 days stale stays due and re-fires on every tick.
    expect(next).toBeLessThan(Date.now())
  })
})
