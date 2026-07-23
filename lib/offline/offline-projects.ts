'use client'

import { useEffect, useState } from 'react'
import { useNetworkStatus } from '@/hooks/use-network-status'
import { cacheProjects, getAllCachedProjects } from './cache-utils'
import { getSyncQueue } from './sync-queue'

const EMPTY_STATS = { totalTasks: 0, doneTasks: 0, blockedTasks: 0, overdueTasks: 0, completedSessions: 0 }

/**
 * Layer pending offline project creates on top of a base list, so a project
 * created while offline shows up immediately instead of vanishing until sync.
 * Pure and deterministic.
 */
export function deriveOfflineProjects(baseProjects: any[], queueItems: any[]) {
  const map = new Map<string, any>(baseProjects.map((p) => [p.id, { ...p }]))

  for (const item of queueItems) {
    const { action, entity_id, payload } = item

    switch (action) {
      case 'create_project':
        if (!map.has(entity_id)) {
          map.set(entity_id, {
            id: entity_id,
            workspace_id: payload.workspace_id ?? null,
            name: payload.name,
            description: payload.description ?? null,
            created_at: item.client_created_at,
            updated_at: item.client_created_at,
            // Enriched fields the project card expects; a brand new project has
            // no tasks or sessions yet, so zeroes are accurate rather than fake.
            stats: { ...EMPTY_STATS },
            lastActivity: item.client_created_at,
            members: [],
            __pendingSync: true,
          })
        }
        break
      default:
        break
    }
  }

  return Array.from(map.values())
}

/**
 * Project list that stays correct offline. Online it mirrors the server props
 * (and keeps the cache warm); offline it hydrates from IndexedDB and layers the
 * pending sync queue on top, re-deriving whenever the queue changes.
 */
export function useOfflineProjects(initialProjects: any[]) {
  const { isOnline } = useNetworkStatus()
  const [projects, setProjects] = useState<any[]>(initialProjects)

  useEffect(() => {
    if (isOnline && initialProjects?.length) {
      cacheProjects(initialProjects).catch(() => {})
    }
  }, [isOnline, initialProjects])

  useEffect(() => {
    let cancelled = false

    async function recompute() {
      const queue = await getSyncQueue()
      const pending = queue.filter((q: any) => q.status === 'pending' || q.status === 'failed')

      // Online, the server list is authoritative — but a queued create that has
      // not drained yet must still be visible, so the queue is always applied.
      let base = initialProjects
      if (!isOnline) {
        const cached = await getAllCachedProjects()
        if (cached.length) base = cached
      }

      if (!cancelled) setProjects(deriveOfflineProjects(base, pending))
    }

    recompute()

    const onChange = () => recompute()
    window.addEventListener('sprintroom-queue-updated', onChange)
    window.addEventListener('sprintroom-sync-completed', onChange)

    return () => {
      cancelled = true
      window.removeEventListener('sprintroom-queue-updated', onChange)
      window.removeEventListener('sprintroom-sync-completed', onChange)
    }
  }, [isOnline, initialProjects])

  return projects
}
