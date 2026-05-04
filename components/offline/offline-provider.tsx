'use client'

import { useEffect, useState, useCallback } from 'react'
import { OfflineBanner } from './offline-banner'
import { SyncStatusPill } from './sync-status-pill'
import { PendingChangesDrawer } from './pending-changes-drawer'
import { processSyncQueue } from '@/lib/offline/sync-engine'
import { useNetworkStatus } from '@/hooks/use-network-status'

// We need an executor to translate the offline action to an actual server call
import { createTask, updateTaskStatus, markBlocked } from '@/app/actions/tasks'
import { updateTask, addComment, addChecklistItem, toggleChecklistItem, deleteChecklistItem } from '@/app/actions/task-details'

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const { isOnline } = useNetworkStatus()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const syncExecutor = useCallback(async (item: any) => {
    // Map item.action to actual server requests
    const { action, payload, entity_id, workspace_id, project_id } = item
    
    switch (action) {
      case 'create_task':
        if (!project_id) throw new Error('Missing project_id')
        await createTask(payload)
        break;
      case 'update_task':
        await updateTask(entity_id, payload, project_id || '')
        break;
      case 'update_task_status':
        await updateTaskStatus(entity_id, payload.status, { projectId: project_id })
        break;
      case 'mark_task_blocked':
        if (!project_id) throw new Error('Missing project_id')
        await markBlocked(entity_id, payload.blockedReason, project_id)
        break;
      case 'create_comment':
        await addComment(entity_id, payload.content, project_id)
        break;
      case 'create_checklist_item':
        await addChecklistItem(entity_id, payload.content, project_id)
        break;
      case 'update_checklist_item':
        if (payload.action === 'toggle') {
          await toggleChecklistItem(entity_id, payload.completed, project_id)
        } else if (payload.action === 'delete') {
          await deleteChecklistItem(entity_id, project_id)
        }
        break;
      case 'complete_focus_session':
        const { completeFocusSession } = await import('@/app/actions/focus')
        await completeFocusSession(entity_id, payload.note, payload.meaningful, payload.distractions)
        break;
      case 'increment_distraction':
        const { incrementDistraction } = await import('@/app/actions/focus')
        await incrementDistraction(entity_id)
        break;
      case 'cancel_focus_session':
        const { cancelFocusSession } = await import('@/app/actions/focus')
        await cancelFocusSession(entity_id)
        break;
      default:
        throw new Error(`Unknown action type: ${action}`)
    }
  }, [])

  // Auto trigger sync on returning online or focus
  useEffect(() => {
    if (!isOnline) return

    const triggerSync = () => {
      processSyncQueue(syncExecutor)
    }

    triggerSync()

    window.addEventListener('sprintroom-sync-requested', triggerSync)
    window.addEventListener('focus', triggerSync)

    return () => {
      window.removeEventListener('sprintroom-sync-requested', triggerSync)
      window.removeEventListener('focus', triggerSync)
    }
  }, [isOnline, syncExecutor])

  // Setup service worker on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.warn('Service Worker registration failed:', err)
      })
    }
  }, [])

  return (
    <>
      <OfflineBanner />
      {/* We can expose pill via a portal or just leave it for mounting in Topbar */}
      {children}
      <PendingChangesDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
      
      {/* Invisible global trigger listener for the pill */}
      <div id="sync-pill-portal-target" className="hidden" onClick={() => setDrawerOpen(true)}></div>
    </>
  )
}
