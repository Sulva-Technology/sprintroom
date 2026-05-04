import { openDB, DBSchema, IDBPDatabase } from 'idb'

export interface SprintRoomDB extends DBSchema {
  cached_workspaces: {
    key: string
    value: any
  }
  cached_projects: {
    key: string
    value: any
    indexes: { 'by-workspace': string }
  }
  cached_tasks: {
    key: string
    value: any
    indexes: { 'by-project': string }
  }
  cached_focus_sessions: {
    key: string
    value: any
  }
  sync_queue: {
    key: string
    value: {
      id: string
      entity_type: string
      entity_id: string
      action: string
      payload: any
      workspace_id?: string
      project_id?: string
      client_created_at: string
      retry_count: number
      status: 'pending' | 'syncing' | 'failed'
      last_error?: string
    }
    indexes: { 'by-status': string, 'by-created': string }
  }
}

let dbPromise: Promise<IDBPDatabase<SprintRoomDB>> | null = null

export function getDB() {
  if (typeof window === 'undefined') return null
  
  if (!dbPromise) {
    dbPromise = openDB<SprintRoomDB>('sprintroom-offline-db', 1, {
      upgrade(db) {
        db.createObjectStore('cached_workspaces', { keyPath: 'id' })
        
        const projectStore = db.createObjectStore('cached_projects', { keyPath: 'id' })
        projectStore.createIndex('by-workspace', 'workspace_id')
        
        const taskStore = db.createObjectStore('cached_tasks', { keyPath: 'id' })
        taskStore.createIndex('by-project', 'project_id')
        
        db.createObjectStore('cached_focus_sessions', { keyPath: 'id' })
        
        const queueStore = db.createObjectStore('sync_queue', { keyPath: 'id' })
        queueStore.createIndex('by-status', 'status')
        queueStore.createIndex('by-created', 'client_created_at')
      },
    })
  }
  return dbPromise
}

export async function clearOfflineData() {
  const db = await getDB()
  if (!db) return
  await Promise.all([
    db.clear('cached_workspaces'),
    db.clear('cached_projects'),
    db.clear('cached_tasks'),
    db.clear('cached_focus_sessions'),
    db.clear('sync_queue'),
  ])
}
