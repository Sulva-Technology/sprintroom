import { describe, expect, it } from 'vitest'
import {
  pickUpdatableTaskFields,
  TASK_UPDATABLE_FIELDS,
} from '@/lib/tasks/updatable-fields'

/**
 * P1-2 regression.
 *
 * `updateTask(id, data: any, projectId)` passed the client object straight to
 * `.update(data)`. `workspace_id` and `project_id` carry tenancy on `tasks`, so
 * a writable tenancy column is a tenant-boundary hole: an authenticated caller
 * could POST columns the UI never sends and move a row between workspaces.
 *
 * Before the fix there was no allowlist at all — this whole module did not
 * exist, so every assertion below failed at import.
 */
describe('pickUpdatableTaskFields', () => {
  it('strips the tenancy columns', () => {
    const result = pickUpdatableTaskFields({
      description: 'legit edit',
      workspace_id: '11111111-1111-1111-1111-111111111111',
      project_id: '22222222-2222-2222-2222-222222222222',
      created_by: '33333333-3333-3333-3333-333333333333',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toEqual({ description: 'legit edit' })
    expect(result.data).not.toHaveProperty('workspace_id')
    expect(result.data).not.toHaveProperty('project_id')
    expect(result.data).not.toHaveProperty('created_by')
  })

  it('never lets workspace_id through on its own', () => {
    const result = pickUpdatableTaskFields({
      workspace_id: '11111111-1111-1111-1111-111111111111',
    })
    // Nothing writable survived the allowlist, so there is no update to make.
    expect(result).toEqual({ ok: false, error: 'No updatable fields supplied' })
  })

  it('keeps id and owner_id out (owner_id has its own action)', () => {
    const result = pickUpdatableTaskFields({
      title: 'ok',
      id: 'aaaa',
      owner_id: 'bbbb',
      created_at: '2020-01-01T00:00:00Z',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Object.keys(result.data)).toEqual(['title'])
  })

  it('passes the fields the UI actually sends', () => {
    const result = pickUpdatableTaskFields({
      title: 'Ship it',
      description: 'body',
      status: 'doing',
      priority: 'high',
      estimate_pomodoros: 3,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toEqual({
      title: 'Ship it',
      description: 'body',
      status: 'doing',
      priority: 'high',
      estimate_pomodoros: 3,
    })
  })

  it('rejects a bad value for an allowed field', () => {
    expect(pickUpdatableTaskFields({ status: 'not-a-status' }).ok).toBe(false)
    expect(pickUpdatableTaskFields({ priority: 7 }).ok).toBe(false)
    expect(pickUpdatableTaskFields({ title: '' }).ok).toBe(false)
    expect(pickUpdatableTaskFields({ estimate_pomodoros: -1 }).ok).toBe(false)
  })

  it('rejects non-object payloads', () => {
    for (const bad of [null, undefined, 'string', 42, ['a']]) {
      expect(pickUpdatableTaskFields(bad).ok, String(bad)).toBe(false)
    }
  })

  it('the allowlist contains no tenancy or identity column', () => {
    for (const forbidden of ['id', 'workspace_id', 'project_id', 'created_by', 'created_at']) {
      expect(TASK_UPDATABLE_FIELDS as readonly string[]).not.toContain(forbidden)
    }
  })
})
