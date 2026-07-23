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
  /**
   * Full task drawer payload (task + checklist + comments), keyed by task id.
   * Stored separately from cached_tasks so a board refresh cannot clobber the
   * richer detail record.
   */
  cached_task_details: {
    key: string
    value: {
      id: string
      task: any
      checklist: any[]
      comments: any[]
      cached_at: string
    }
  }
  /**
   * Generic key/value snapshots of server-rendered page data (dashboard stats,
   * enriched project list, team roster, ...). Lets a client component re-render
   * a page offline without every page growing its own object store.
   */
  cached_snapshots: {
    key: string
    value: {
      key: string
      data: any
      cached_at: string
    }
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

const DB_NAME = 'sprintroom-offline-db'
const DB_VERSION = 2

let dbPromise: Promise<IDBPDatabase<SprintRoomDB>> | null = null

export function getDB() {
  if (typeof window === 'undefined') return null

  if (!dbPromise) {
    dbPromise = openDB<SprintRoomDB>(DB_NAME, DB_VERSION, {
      // Upgrades run cumulatively from the installed version, so an existing v1
      // database only gets the stores it is missing and keeps its cached rows.
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('cached_workspaces', { keyPath: 'id' })

          const projectStore = db.createObjectStore('cached_projects', { keyPath: 'id' })
          projectStore.createIndex('by-workspace', 'workspace_id')

          const taskStore = db.createObjectStore('cached_tasks', { keyPath: 'id' })
          taskStore.createIndex('by-project', 'project_id')

          db.createObjectStore('cached_focus_sessions', { keyPath: 'id' })

          const queueStore = db.createObjectStore('sync_queue', { keyPath: 'id' })
          queueStore.createIndex('by-status', 'status')
          queueStore.createIndex('by-created', 'client_created_at')
        }

        if (oldVersion < 2) {
          db.createObjectStore('cached_task_details', { keyPath: 'id' })
          db.createObjectStore('cached_snapshots', { keyPath: 'key' })
        }
      },
    })
  }
  return dbPromise
}

/**
 * Wipe every cached row. The sync queue is included, so only call this when the
 * queue is empty or the pending work is deliberately being discarded (sign-out).
 */
export async function clearOfflineData() {
  const db = await getDB()
  if (!db) return
  await Promise.all([
    db.clear('cached_workspaces'),
    db.clear('cached_projects'),
    db.clear('cached_tasks'),
    db.clear('cached_focus_sessions'),
    db.clear('cached_task_details'),
    db.clear('cached_snapshots'),
    db.clear('sync_queue'),
  ])
}

/** Clear cached reads but keep unsynced local mutations. */
export async function clearCachedReads() {
  const db = await getDB()
  if (!db) return
  await Promise.all([
    db.clear('cached_workspaces'),
    db.clear('cached_projects'),
    db.clear('cached_tasks'),
    db.clear('cached_focus_sessions'),
    db.clear('cached_task_details'),
    db.clear('cached_snapshots'),
  ])
}
