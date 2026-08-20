import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(__dirname, '..')
const read = (relative: string) => readFileSync(join(root, relative), 'utf8')

const config = read('supabase/config.toml')
const recurring = read('supabase/functions/process-recurring-tasks/index.ts')
const schedules = read('supabase/functions/process-schedules/index.ts')
const nudges = read('supabase/functions/rhythm-nudges/index.ts')

/**
 * These functions are invoked by pg_cron with `Authorization: Bearer <CRON_SECRET>`,
 * which is not a JWT. With verify_jwt = true the gateway rejected every call
 * before the handler's own CRON_SECRET check could run, so recurring tasks and
 * scheduled-session pushes never fired.
 */
describe('cron-invoked edge functions', () => {
  for (const fn of ['process-recurring-tasks', 'process-schedules', 'rhythm-nudges']) {
    it(`${fn} authenticates with CRON_SECRET, so verify_jwt must be off`, () => {
      const block = config.split(`[functions.${fn}]`)[1]
      expect(block, `no [functions.${fn}] block in config.toml`).toBeDefined()
      // Only look at this function's own block.
      const ownBlock = block.split('[functions.')[0]
      expect(ownBlock).toMatch(/verify_jwt\s*=\s*false/)
    })
  }
})

/**
 * Regression: the recurring-task function was written against the legacy
 * supabase/schema.sql (tasks.user_id, priority int) instead of the live schema
 * from migrations 0002 + 0004, so every insert failed with PGRST204.
 */
describe('process-recurring-tasks writes the live tasks schema', () => {
  it('does not write a user_id column onto tasks', () => {
    const insert = recurring.split('.from("tasks").insert(')[1]?.split('});')[0] ?? ''
    expect(insert).not.toMatch(/\buser_id\s*:/)
  })

  it('sets created_by for authorship', () => {
    expect(recurring).toMatch(/created_by:\s*rule\.user_id/)
  })

  it('sets workspace_id explicitly (auth.uid() is null under the service role)', () => {
    expect(recurring).toMatch(/workspace_id:\s*workspaceByProject\.get/)
  })

  it('maps the int priority scale onto the text priority column', () => {
    expect(recurring).toMatch(/function toTaskPriority/)
    for (const value of ['low', 'medium', 'high', 'urgent']) {
      expect(recurring).toContain(`"${value}"`)
    }
  })

  it('skips rules with no project, because tasks.project_id is NOT NULL', () => {
    expect(recurring).toMatch(/if \(!rule\.project_id/)
  })
})

/**
 * Regression: focus_schedules and web_push_subscriptions share only a user_id
 * pointing at auth.users. With no foreign key between them PostgREST cannot
 * embed one in the other, so the select failed and no push was ever sent.
 */
describe('process-schedules does not embed across a missing relationship', () => {
  it('never selects web_push_subscriptions as an embedded resource', () => {
    expect(schedules).not.toMatch(/select\([^)]*web_push_subscriptions\(/)
  })

  it('loads subscriptions with a separate user_id lookup, like rhythm-nudges', () => {
    expect(schedules).toMatch(/\.from\("web_push_subscriptions"\)[\s\S]{0,200}\.in\("user_id"/)
    expect(nudges).toMatch(/\.from\("web_push_subscriptions"\)[\s\S]{0,200}\.in\("user_id"/)
  })
})

/**
 * Regression: a schedule with workspace_id NULL auto-started a session the
 * focus_sessions SELECT policy hid from its own owner.
 */
describe('focus session visibility migration', () => {
  const migration = read('supabase/migrations/20260814090000_fix_scheduled_focus_visibility.sql')

  it('lets a user read their own session regardless of workspace', () => {
    expect(migration).toMatch(/FOR SELECT USING \(is_workspace_member\(workspace_id\) OR user_id = auth\.uid\(\)\)/)
  })

  it('backfills sessions and schedules that were left without a workspace', () => {
    expect(migration).toMatch(/UPDATE public\.focus_sessions[\s\S]*workspace_id IS NULL/)
    expect(migration).toMatch(/UPDATE public\.focus_schedules[\s\S]*workspace_id IS NULL/)
  })

  it('resolves a workspace inside process_due_focus_schedules', () => {
    expect(migration).toMatch(/resolved_workspace_id/)
  })
})
