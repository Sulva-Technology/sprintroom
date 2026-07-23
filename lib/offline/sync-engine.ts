import { getDB } from './db'

// Give up on an item after this many failed attempts so a permanently-broken
// change (e.g. a stale entity id) can't retry forever on every online/focus event.
const MAX_RETRIES = 5

// Guard against overlapping runs. processSyncQueue is triggered on mount, on the
// `online` event, on window focus and on `sprintroom-sync-requested`, so without
// a lock two runs can read the same 'pending' item and execute it twice.
let isProcessing = false

type SyncResult = { newId?: string } | void

export async function processSyncQueue(executor: (item: any) => Promise<SyncResult>) {
  if (isProcessing) return
  const db = await getDB()
  if (!db) return

  isProcessing = true
  // Maps a temp client id (used for entities created offline) to the real server
  // id returned on insert, so later queued mutations hit the right row.
  const idMap = new Map<string, string>()
  try {
    const items = await db.getAllFromIndex('sync_queue', 'by-created')
    const pending = items.filter(
      (i) => (i.status === 'pending' || i.status === 'failed') && i.retry_count < MAX_RETRIES
    )

    if (pending.length === 0) return

    window.dispatchEvent(new Event('sprintroom-sync-started'))

    for (const item of pending) {
      // Rewrite a stale temp id to the real one minted earlier in this run.
      if (idMap.has(item.entity_id)) {
        item.entity_id = idMap.get(item.entity_id)!
      }

      item.status = 'syncing'
      await db.put('sync_queue', item)

      try {
        const result = await executor(item)
        // A create returns the new server id; record it for follow-up items.
        if (result && result.newId) {
          idMap.set(item.entity_id, result.newId)
        }
        // Success, remove from queue
        await db.delete('sync_queue', item.id)
      } catch (e: any) {
        console.error('Sync failed for item', item, e)
        item.status = 'failed'
        item.retry_count += 1
        item.last_error = e.message || 'Unknown error'
        await db.put('sync_queue', item)
      }
    }

    window.dispatchEvent(new Event('sprintroom-sync-completed'))
  } finally {
    isProcessing = false
  }
}
