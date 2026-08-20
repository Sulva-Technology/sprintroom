'use client'

import { useEffect, useState, useCallback } from 'react'
import { OfflineBanner } from '@/components/offline/offline-banner'
import { SyncStatusPill } from '@/components/offline/sync-status-pill'
import { PendingChangesDrawer } from '@/components/offline/pending-changes-drawer'
import { processSyncQueue } from '@/lib/offline/sync-engine'
import { useNetworkStatus } from '@/hooks/use-network-status'

// We need an executor to translate the offline action to an actual server call
import { createTask, updateTaskStatus, markBlocked } from '@/app/actions/tasks'
import { updateTask, addComment, addChecklistItem, toggleChecklistItem, deleteChecklistItem } from '@/app/actions/task-details'

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const { isOnline } = useNetworkStatus()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const syncExecutor = useCallback(async (item: any): Promise<{ newId?: string } | void> => {
    // Map item.action to actual server requests
    const { action, payload, entity_id, workspace_id, project_id } = item

    switch (action) {
      case 'create_task': {
        if (!project_id) throw new Error('Missing project_id')
        const res = await createTask(payload)
        if (res && (res as any).error) throw new Error((res as any).error.message || 'Create failed')
        // Return the real server id so follow-up queued items on this task remap.
        return { newId: (res as any)?.id }
      }
      case 'create_project': {
        const { createProject } = await import('@/app/actions/projects')
        const res = await createProject(payload)
        if (!res?.success) throw new Error(res?.error?.message || 'Create project failed')

        // Swap the optimistic temp row for the real one so the list stops
        // showing a pending placeholder and later items remap to the server id.
        const { deleteCachedProject, upsertCachedProject } = await import('@/lib/offline/cache-utils')
        await deleteCachedProject(entity_id)
        await upsertCachedProject(res.project)

        return { newId: res.project?.id }
      }
      case 'create_workspace': {
        const { createWorkspace } = await import('@/app/actions/workspaces')
        const res = await createWorkspace(payload.name, payload.initial)
        if (!res?.success) throw new Error(res?.error?.message || 'Create workspace failed')

        const { upsertCachedWorkspace } = await import('@/lib/offline/cache-utils')
        if ((res as any).workspace) await upsertCachedWorkspace((res as any).workspace)

        return { newId: (res as any).workspace?.id }
      }
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
      case 'complete_focus_session': {
        // Use the non-redirecting core so background sync doesn't navigate the
        // user away, and so a retry can't double-count the pomodoro.
        const { completeFocusSessionCore } = await import('@/app/actions/focus')
        const res = await completeFocusSessionCore(entity_id, payload.note, payload.meaningful, payload.distractions)
        if (!res.success) throw new Error(res.error || 'Complete failed')
        break;
      }
      case 'increment_distraction': {
        const { incrementDistraction } = await import('@/app/actions/focus')
        await incrementDistraction(entity_id)
        break;
      }
      case 'cancel_focus_session': {
        const { cancelFocusSessionCore } = await import('@/app/actions/focus')
        const res = await cancelFocusSessionCore(entity_id)
        if (!res.success) throw new Error(res.error || 'Cancel failed')
        break;
      }
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
