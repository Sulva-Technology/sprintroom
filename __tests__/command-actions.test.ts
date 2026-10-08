import { describe, expect, it } from 'vitest'
import { buildCommandActions } from '@/lib/command-actions'

describe('buildCommandActions', () => {
  it('lists navigation and focus when the query is empty', () => {
    const actions = buildCommandActions('', { canEdit: true })
    expect(actions.some((a) => a.kind === 'start-focus')).toBe(true)
    expect(actions.some((a) => a.kind === 'navigate' && a.href === '/dashboard/team')).toBe(true)
    expect(actions.some((a) => a.kind === 'create-task')).toBe(false)
  })

  it('offers "create task" first for any typed text', () => {
    const [first] = buildCommandActions('Write launch email', { canEdit: true })
    expect(first).toMatchObject({ kind: 'create-task', title: 'Write launch email' })
  })

  it('filters other actions by the query', () => {
    const actions = buildCommandActions('team', { canEdit: true })
    expect(actions.filter((a) => a.kind === 'navigate').map((a) => a.kind === 'navigate' && a.href)).toEqual(['/dashboard/team'])
  })

  it('hides write actions from viewers', () => {
    const actions = buildCommandActions('anything', { canEdit: false })
    expect(actions.some((a) => a.kind === 'create-task' || a.kind === 'start-focus')).toBe(false)
  })

  it('create mode shows only the create action', () => {
    expect(buildCommandActions('Fix login', { canEdit: true, createOnly: true }).map((a) => a.kind)).toEqual(['create-task'])
    expect(buildCommandActions('', { canEdit: true, createOnly: true })).toEqual([])
  })
})
