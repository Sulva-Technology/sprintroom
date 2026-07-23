'use client'

import { useEffect, useState } from 'react'
import { useNetworkStatus } from '@/hooks/use-network-status'
import { cacheTasks, getCachedTasks } from './cache-utils'
import { getSyncQueue } from './sync-queue'

/**
 * Apply the pending offline mutation queue on top of a base task list so the
 * board reflects offline changes (creates, status moves, blocks, edits) before
 * they have synced. Pure and deterministic.
 */
export function deriveOfflineTasks(baseTasks: any[], queueItems: any[], projectId: string) {
  const map = new Map<string, any>(baseTasks.map((t) => [t.id, { ...t }]))

  for (const item of queueItems) {
    const { action, entity_id, payload } = item
    switch (action) {
      case 'create_task':
        if (payload?.project_id === projectId && !map.has(entity_id)) {
          map.set(entity_id, {
            id: entity_id,
            project_id: projectId,
            title: payload.title,
            description: payload.description ?? null,
            status: payload.status || 'backlog',
            priority: payload.priority || 'medium',
            deadline: payload.deadline || null,
            owner_id: null,
            blocked_reason: null,
            __pendingSync: true,
          })
        }
        break
      case 'update_task_status':
        if (map.has(entity_id)) map.get(entity_id).status = payload.status
        break
      case 'mark_task_blocked':
        if (map.has(entity_id)) {
          const t = map.get(entity_id)
          t.status = 'blocked'
          t.blocked_reason = payload.blockedReason
        }
        break
      case 'update_task':
        if (map.has(entity_id)) Object.assign(map.get(entity_id), payload)
        break
      default:
        break
    }
  }

  return Array.from(map.values())
}

/**
 * Board task list that stays correct offline. Online it mirrors the server
 * props (and keeps the cache warm); offline it hydrates from IndexedDB and
 * layers the pending sync queue on top, re-deriving whenever the queue changes.
 */
export function useOfflineBoardTasks(projectId: string, initialTasks: any[]) {
  const { isOnline } = useNetworkStatus()
  const [tasks, setTasks] = useState<any[]>(initialTasks)

  // Keep the cache warm with fresh server data while online.
  useEffect(() => {
    if (isOnline && initialTasks?.length) {
      cacheTasks(initialTasks).catch(() => {})
    }
  }, [isOnline, initialTasks])

  useEffect(() => {
    let cancelled = false

    async function recompute() {
      if (isOnline) {
        if (!cancelled) setTasks(initialTasks)
        return
      }
      const [cached, queue] = await Promise.all([getCachedTasks(projectId), getSyncQueue()])
      const base = cached.length ? cached : initialTasks
      const pending = queue.filter((q: any) => q.status === 'pending' || q.status === 'failed')
      if (!cancelled) setTasks(deriveOfflineTasks(base, pending, projectId))
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
  }, [isOnline, initialTasks, projectId])

  return tasks
}
