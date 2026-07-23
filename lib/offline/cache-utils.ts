import { getDB } from './db'

export async function cacheWorkspaces(workspaces: any[]) {
  const db = await getDB()
  if (!db) return
  const tx = db.transaction('cached_workspaces', 'readwrite')
  await Promise.all([
    ...workspaces.map(ws => tx.store.put(ws)),
    tx.done
  ])
}

export async function cacheProjects(projects: any[]) {
  const db = await getDB()
  if (!db) return
  const tx = db.transaction('cached_projects', 'readwrite')
  await Promise.all([
    ...projects.map(p => tx.store.put(p)),
    tx.done
  ])
}

export async function cacheTasks(tasks: any[]) {
  const db = await getDB()
  if (!db) return
  const tx = db.transaction('cached_tasks', 'readwrite')
  await Promise.all([
    ...tasks.map(t => tx.store.put(t)),
    tx.done
  ])
}

/** Upsert a single project (used for optimistic offline creates). */
export async function upsertCachedProject(project: any) {
  const db = await getDB()
  if (!db || !project?.id) return
  await db.put('cached_projects', project)
}

export async function deleteCachedProject(projectId: string) {
  const db = await getDB()
  if (!db) return
  await db.delete('cached_projects', projectId)
}

export async function getAllCachedProjects() {
  const db = await getDB()
  if (!db) return []
  return db.getAll('cached_projects')
}

export async function upsertCachedWorkspace(workspace: any) {
  const db = await getDB()
  if (!db || !workspace?.id) return
  await db.put('cached_workspaces', workspace)
}

export async function getCachedWorkspaces() {
  const db = await getDB()
  if (!db) return []
  return db.getAll('cached_workspaces')
}

/**
 * Cache complete task details including checklists and comments, so the task
 * drawer opens with real content offline instead of an empty shell.
 */
export async function cacheTaskDetails(taskId: string, details: any) {
  const db = await getDB()
  if (!db || !taskId) return

  if (details?.task) {
    await db.put('cached_tasks', details.task)
  }

  await db.put('cached_task_details', {
    id: taskId,
    task: details?.task ?? null,
    checklist: details?.checklist ?? [],
    comments: details?.comments ?? [],
    cached_at: new Date().toISOString(),
  })
}

export async function getCachedTaskDetails(taskId: string) {
  const db = await getDB()
  if (!db || !taskId) return null
  return (await db.get('cached_task_details', taskId)) ?? null
}

/**
 * Snapshot of a page's server-rendered data, so a client component can re-render
 * that page from IndexedDB when the network is gone.
 */
export async function cacheSnapshot(key: string, data: any) {
  const db = await getDB()
  if (!db || !key) return
  await db.put('cached_snapshots', { key, data, cached_at: new Date().toISOString() })
}

export async function getCachedSnapshot<T = any>(key: string): Promise<T | null> {
  const db = await getDB()
  if (!db || !key) return null
  const row = await db.get('cached_snapshots', key)
  return (row?.data as T) ?? null
}

export async function getCachedTasks(projectId: string) {
  const db = await getDB()
  if (!db) return []
  return db.getAllFromIndex('cached_tasks', 'by-project', projectId)
}

export async function getCachedProjects(workspaceId: string) {
  const db = await getDB()
  if (!db) return []
  return db.getAllFromIndex('cached_projects', 'by-workspace', workspaceId)
}

export async function getCachedTask(taskId: string) {
  const db = await getDB()
  if (!db) return null
  return db.get('cached_tasks', taskId)
}

/**
 * Upsert a single task into the cache (used for optimistic offline mutations).
 */
export async function upsertCachedTask(task: any) {
  const db = await getDB()
  if (!db || !task?.id) return
  await db.put('cached_tasks', task)
}

/**
 * Remove a single task from the cache.
 */
export async function deleteCachedTask(taskId: string) {
  const db = await getDB()
  if (!db) return
  await db.delete('cached_tasks', taskId)
}
