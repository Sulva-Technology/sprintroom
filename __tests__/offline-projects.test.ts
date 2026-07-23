import { describe, it, expect } from 'vitest'
import { deriveOfflineProjects } from '@/lib/offline/offline-projects'

function queueItem(overrides: Record<string, any> = {}) {
  return {
    id: 'queue-1',
    action: 'create_project',
    entity_type: 'project',
    entity_id: 'temp-1',
    payload: { name: 'Offline Project', description: 'Made on a plane' },
    client_created_at: '2026-07-23T10:00:00.000Z',
    retry_count: 0,
    status: 'pending',
    ...overrides,
  }
}

describe('deriveOfflineProjects', () => {
  it('returns the base list untouched when nothing is queued', () => {
    const base = [{ id: 'p1', name: 'Existing' }]

    expect(deriveOfflineProjects(base, [])).toEqual(base)
  })

  it('adds a queued offline create as a pending project', () => {
    const result = deriveOfflineProjects([], [queueItem()])

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'temp-1',
      name: 'Offline Project',
      description: 'Made on a plane',
      __pendingSync: true,
    })
  })

  it('gives a pending project zeroed stats so the card renders', () => {
    const [project] = deriveOfflineProjects([], [queueItem()])

    expect(project.stats).toEqual({
      totalTasks: 0,
      doneTasks: 0,
      blockedTasks: 0,
      overdueTasks: 0,
      completedSessions: 0,
    })
    expect(project.members).toEqual([])
  })

  it('does not duplicate a project that already synced under the same id', () => {
    const base = [{ id: 'temp-1', name: 'Offline Project', stats: { totalTasks: 3 } }]

    const result = deriveOfflineProjects(base, [queueItem()])

    expect(result).toHaveLength(1)
    expect(result[0].stats.totalTasks).toBe(3)
    expect(result[0].__pendingSync).toBeUndefined()
  })

  it('ignores queue entries for other entity types', () => {
    const result = deriveOfflineProjects([], [queueItem({ action: 'create_task' })])

    expect(result).toEqual([])
  })

  it('does not mutate the projects it was given', () => {
    const base = [{ id: 'p1', name: 'Existing' }]
    const snapshot = JSON.parse(JSON.stringify(base))

    deriveOfflineProjects(base, [queueItem()])

    expect(base).toEqual(snapshot)
  })
})
