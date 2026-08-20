import { describe, expect, it, vi, beforeEach } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'

/**
 * P0-6 verification test.
 *
 * Unlike __tests__/offline-sync-executor.test.ts — which re-implements a COPY of
 * assertSynced inside the test file — this drives the REAL syncExecutor inside
 * the REAL OfflineProvider, through the REAL processSyncQueue.
 *
 * A server action that REJECTS by returning `{ success: false, error }` (RLS
 * denial) must leave the queue item pending/failed for retry. If the executor
 * ignores the return value, processSyncQueue sees a clean resolve and DELETES
 * the item — the user's offline edit is silently lost.
 */

const store = new Map<string, any>()

vi.mock('@/lib/offline/db', () => ({
  getDB: async () => ({
    getAllFromIndex: async () => Array.from(store.values()),
    put: async (_s: string, item: any) => { store.set(item.id, item) },
    delete: async (_s: string, id: string) => { store.delete(id) },
  }),
}))

vi.mock('@/hooks/use-network-status', () => ({ useNetworkStatus: () => ({ isOnline: true }) }))

// Child components are irrelevant to sync semantics.
vi.mock('@/components/offline/offline-banner', () => ({ OfflineBanner: () => null }))
vi.mock('@/components/offline/sync-status-pill', () => ({ SyncStatusPill: () => null }))
vi.mock('@/components/offline/pending-changes-drawer', () => ({ PendingChangesDrawer: () => null }))

// Every server action REJECTS the way a real RLS denial does: it RETURNS, never throws.
const DENIED = { success: false, error: 'new row violates row-level security policy' }
vi.mock('@/app/actions/tasks', () => ({
  createTask: vi.fn(async () => DENIED),
  updateTaskStatus: vi.fn(async () => DENIED),
  markBlocked: vi.fn(async () => DENIED),
}))
vi.mock('@/app/actions/task-details', () => ({
  updateTask: vi.fn(async () => DENIED),
  addComment: vi.fn(async () => DENIED),
  addChecklistItem: vi.fn(async () => DENIED),
  toggleChecklistItem: vi.fn(async () => DENIED),
  deleteChecklistItem: vi.fn(async () => DENIED),
}))

import { OfflineProvider } from '@/components/offline/offline-provider'

function queueItem(action: string, payload: Record<string, unknown>) {
  return {
    id: `q-${action}`, entity_type: 'task', entity_id: 'task-1', action, payload,
    project_id: 'project-1', client_created_at: new Date().toISOString(),
    retry_count: 0, status: 'pending' as const,
  }
}

const CASES: Array<[string, Record<string, unknown>]> = [
  ['update_task', { description: 'edited while offline' }],
  ['update_task_status', { status: 'doing' }],
  ['mark_task_blocked', { blockedReason: 'waiting on API' }],
  ['create_comment', { content: 'offline comment' }],
  ['create_checklist_item', { content: 'offline item' }],
  ['update_checklist_item', { action: 'toggle', completed: true }],
]

describe('P0-6: a rejected server action must NOT delete the queued offline edit', () => {
  beforeEach(() => { store.clear() })

  for (const [action, payload] of CASES) {
    it(`${action}: item survives an RLS denial`, async () => {
      const id = `q-${action}`
      store.set(id, queueItem(action, payload))

      render(React.createElement(OfflineProvider, null, null))
      // Wait for the sync attempt to settle: the item is either deleted (bug) or
      // marked failed for retry (fixed). Polling 'pending' would pass instantly.
      await vi.waitFor(() => {
        const cur = store.get(id)
        expect(cur === undefined || cur.status === 'failed').toBe(true)
      }, { timeout: 3000, interval: 20 })

      const item = store.get(id)
      expect(item, `queue item was DELETED — the offline edit is silently lost`).toBeDefined()
      expect(item.status).toBe('failed')
      expect(item.retry_count).toBe(1)
    })
  }
})
