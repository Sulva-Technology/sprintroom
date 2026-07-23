'use client'

import { useEffect } from 'react'
import { cacheWorkspaces, cacheProjects, cacheTasks } from '@/lib/offline/cache-utils'

/**
 * Persists server-rendered data into the offline IndexedDB cache so it is
 * available for reads when the network drops. Renders nothing.
 *
 * Mount it inside server components, passing whatever slice of data that page
 * already fetched (workspaces, projects, tasks). Writes are best-effort and
 * silently no-op when IndexedDB is unavailable.
 */
export function CacheWriter({
  workspaces,
  projects,
  tasks,
}: {
  workspaces?: any[]
  projects?: any[]
  tasks?: any[]
}) {
  useEffect(() => {
    if (workspaces?.length) cacheWorkspaces(workspaces).catch(() => {})
  }, [workspaces])

  useEffect(() => {
    if (projects?.length) cacheProjects(projects).catch(() => {})
  }, [projects])

  useEffect(() => {
    if (tasks?.length) cacheTasks(tasks).catch(() => {})
  }, [tasks])

  return null
}
