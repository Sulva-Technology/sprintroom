import { describe, expect, it, vi, beforeEach } from 'vitest'
import { processSyncQueue } from '@/lib/offline/sync-engine'

/**
 * Regression: server actions report failure by RETURNING `{ error }` /
 * `{ success: false }` instead of throwing. The sync executor used to ignore
 * those returns for update_task, update_task_status, mark_task_blocked,
 * create_comment, create_checklist_item and update_checklist_item, so the queue
 * item was deleted as if it had synced — the user's offline edit vanished.
 */

const store = new Map<string, any>()

vi.mock('@/lib/offline/db', () => ({
  getDB: async () => ({
    getAllFromIndex: async () => Array.from(store.values()),
    put: async (_s: string, item: any) => {
      store.set(item.id, item)
    },
    delete: async (_s: string, id: string) => {
      store.delete(id)
    },
  }),
}))

function queueItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'queue-1',
    entity_type: 'task',
    entity_id: 'task-1',
    action: 'update_task_status',
    payload: { status: 'doing' },
    project_id: 'project-1',
    client_created_at: new Date().toISOString(),
    retry_count: 0,
    status: 'pending' as const,
    ...overrides,
  }
}

beforeEach(() => {
  store.clear()
  store.set('queue-1', queueItem())
})

describe('offline sync queue error handling', () => {
  it('keeps the item queued when the executor throws', async () => {
    await processSyncQueue(async () => {
      throw new Error('A database error occurred')
    })

    const item = store.get('queue-1')
    expect(item).toBeDefined()
    expect(item.status).toBe('failed')
    expect(item.retry_count).toBe(1)
    expect(item.last_error).toBe('A database error occurred')
  })

  it('removes the item only when the executor resolves', async () => {
    await processSyncQueue(async () => {})
    expect(store.get('queue-1')).toBeUndefined()
  })

  it('stops retrying an item that has exhausted MAX_RETRIES', async () => {
    store.set('queue-1', queueItem({ status: 'failed', retry_count: 5 }))
    const executor = vi.fn()

    await processSyncQueue(executor)

    expect(executor).not.toHaveBeenCalled()
    expect(store.get('queue-1')).toBeDefined()
  })
})

describe('assertSynced contract', () => {
  // Mirrors components/offline/offline-provider.tsx. Kept as an explicit
  // contract test because the real helper lives inside a 'use client' module.
  function assertSynced(result: any, action: string) {
    if (!result) return result
    if (result.error) {
      const message = typeof result.error === 'string' ? result.error : result.error.message
      throw new Error(message || `${action} failed`)
    }
    if (result.success === false) {
      throw new Error(`${action} failed`)
    }
    return result
  }

  it('throws on a string error return', () => {
    expect(() => assertSynced({ error: 'Not authenticated' }, 'update_task')).toThrow('Not authenticated')
  })

  it('throws on a structured error return', () => {
    expect(() => assertSynced({ success: false, error: { message: 'Invalid input' } }, 'create_task')).toThrow(
      'Invalid input',
    )
  })

  it('throws on success: false with no error payload', () => {
    expect(() => assertSynced({ success: false }, 'mark_task_blocked')).toThrow('mark_task_blocked failed')
  })

  it('passes a successful result through', () => {
    expect(assertSynced({ success: true, id: 'task-9' }, 'create_task')).toEqual({ success: true, id: 'task-9' })
  })

  it('passes a void return through', () => {
    expect(assertSynced(undefined, 'update_task')).toBeUndefined()
  })
})
