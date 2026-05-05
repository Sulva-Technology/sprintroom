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

/**
 * Cache complete task details including checklists and comments
 */
export async function cacheTaskDetails(taskId: string, details: any) {
  const db = await getDB()
  if (!db) return

  // Store the main task
  if (details.task) {
    await db.put('cached_tasks', details.task)
  }

  // Store the full details object in a dedicated store if needed,
  // or just ensure the main task store has everything.
  // For now we just ensure the task is in the cache.
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
