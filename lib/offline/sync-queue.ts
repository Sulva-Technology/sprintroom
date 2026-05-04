import { getDB } from './db'

export async function addToSyncQueue(
  action: string,
  entity_type: string,
  entity_id: string,
  payload: any,
  workspace_id?: string,
  project_id?: string
) {
  const db = await getDB()
  if (!db) return

  const item = {
    id: crypto.randomUUID(),
    entity_type,
    entity_id,
    action,
      payload,
      workspace_id,
      project_id,
      client_created_at: new Date().toISOString(),
    retry_count: 0,
    status: 'pending' as const,
  }

  await db.put('sync_queue', item)

  // Try to register background sync if supported
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const registration = await navigator.serviceWorker.ready
      // @ts-ignore
      await registration.sync.register('sprintroom-sync')
    } catch (e) {
      console.warn('Background Sync registration failed, will rely on online events', e)
    }
  }

  // Trigger manual sync attempt (handled appropriately in sync-engine)
  if (navigator.onLine) {
    window.dispatchEvent(new Event('sprintroom-sync-requested'))
  }
}

export async function getSyncQueue() {
  const db = await getDB()
  if (!db) return []
  return db.getAllFromIndex('sync_queue', 'by-created')
}

export async function getPendingChangesCount() {
  const db = await getDB()
  if (!db) return 0
  const all = await db.getAllFromIndex('sync_queue', 'by-status')
  return all.filter(item => item.status === 'pending' || item.status === 'failed').length
}

export async function removeSyncItem(id: string) {
  const db = await getDB()
  if (!db) return
  await db.delete('sync_queue', id)
}
