import { getDB } from './db'

// We will map actions to actual server actions/APIs when executed
// A simple way is to build an action map in the provider or engine.
// To keep things clean, the sync engine will emit an event or be passed an executor.

export async function processSyncQueue(executor: (item: any) => Promise<void>) {
  const db = await getDB()
  if (!db) return

  const items = await db.getAllFromIndex('sync_queue', 'by-created')
  const pending = items.filter(i => i.status === 'pending' || i.status === 'failed')

  if (pending.length === 0) return

  for (const item of pending) {
    item.status = 'syncing'
    await db.put('sync_queue', item)
    window.dispatchEvent(new Event('sprintroom-sync-started'))

    try {
      await executor(item)
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
}
