import { describe, expect, it, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, waitFor } from '@testing-library/react'

/**
 * P0-6. Drives the REAL OfflineProvider through the REAL processSyncQueue with
 * a fake IndexedDB. A server action that rejects the way RLS actually does —
 * by RETURNING `{ success: false, error }`, never throwing — must leave the
 * queue item behind. If the executor ignores the return value the engine sees a
 * clean resolve and DELETES the item: the user's offline edit is gone.
 */

let store = new Map<string, any>()

vi.mock('@/lib/offline/db', () => ({
  getDB: async () => ({
    getAllFromIndex: async () => Array.from(store.values()),
    put: async (_s: string, item: any) => void store.set(item.id, { ...item }),
    delete: async (_s: string, id: string) => void store.delete(id),
  }),
}))
vi.mock('@/hooks/use-network-status', () => ({ useNetworkStatus: () => ({ isOnline: true }) }))
vi.mock('@/components/offline/offline-banner', () => ({ OfflineBanner: () => null }))
vi.mock('@/components/offline/sync-status-pill', () => ({ SyncStatusPill: () => null }))
vi.mock('@/components/offline/pending-changes-drawer', () => ({ PendingChangesDrawer: () => null }))

const DENIED = { success: false, error: 'new row violates row-level security policy for table "tasks"' }

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
import { OfflineProvider as HeadOfflineProvider } from './head/offline-provider.head'

const ACTIONS = [
  ['update_task', { description: 'edited offline' }],
  ['update_task_status', { status: 'done' }],
  ['mark_task_blocked', { blockedReason: 'waiting' }],
  ['create_comment', { content: 'hi' }],
  ['create_checklist_item', { content: 'step' }],
  ['update_checklist_item', { action: 'toggle', completed: true }],
] as const

function seed(action: string, payload: any) {
  store = new Map([
    [
      'item-1',
      {
        id: 'item-1',
        action,
        payload,
        entity_id: 'task-1',
        project_id: 'project-1',
        workspace_id: 'workspace-1',
        status: 'pending',
        retry_count: 0,
        created_at: 1,
      },
    ],
  ])
}

describe('P0-6 a denied offline mutation is not silently dropped', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  for (const [action, payload] of ACTIONS) {
    it(`CURRENT working tree: ${action} stays queued when the server denies it`, async () => {
      seed(action, payload)
      render(<OfflineProvider><div /></OfflineProvider>)

      await waitFor(() => expect(store.get('item-1')?.status).toBe('failed'))

      const item = store.get('item-1')
      expect(item, `${action} was deleted from the queue — the edit is lost`).toBeTruthy()
      expect(item.retry_count).toBe(1)
      expect(item.last_error).toContain('row-level security')
    })
  }

  it('DISCRIMINATOR — HEAD (pre-fix) drops update_task from the queue entirely', async () => {
    seed('update_task', { description: 'edited offline' })
    render(<HeadOfflineProvider><div /></HeadOfflineProvider>)

    await waitFor(() => expect(store.size).toBe(0))
    console.log('HEAD queue after denied sync:', store.size, 'items')
  })
})
