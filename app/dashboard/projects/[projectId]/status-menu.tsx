'use client'

import { useState } from 'react'
import { MoreHorizontal, Loader2 } from 'lucide-react'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { updateTaskStatus, deleteTask } from '@/app/actions/tasks'
import { MarkBlockedDialog } from './mark-blocked-dialog'

const STATUSES = ['backlog', 'today', 'doing', 'review', 'done']

export function StatusMenu({ task, projectId }: { task: any, projectId: string }) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [showBlockedDialog, setShowBlockedDialog] = useState(false)

  const handleStatusUpdate = async (status: string) => {
    if (status === 'blocked') {
      setShowBlockedDialog(true)
      return
    }
    setIsUpdating(true)
    
    if (!navigator.onLine) {
       const { addToSyncQueue } = await import('@/lib/offline/sync-queue');
       await addToSyncQueue('update_task_status', 'task', task.id, { status }, task.workspace_id, projectId);
    } else {
       await updateTaskStatus(task.id, status, { projectId })
    }
    
    setIsUpdating(false)
  }

  const handleDelete = async () => {
    if (confirm('Delete this task?')) {
      setIsUpdating(true)
      await deleteTask(task.id, projectId)
      setIsUpdating(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<button className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded-md hover:bg-slate-100" disabled={isUpdating} />}>
            {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreHorizontal className="w-4 h-4" />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40 rounded-xl">
          {STATUSES.map(s => (
            <DropdownMenuItem 
              key={s} 
              disabled={s === task.status}
              onClick={() => handleStatusUpdate(s)}
              className="capitalize text-sm font-medium"
            >
              Move to {s}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            disabled={task.status === 'blocked'}
            onClick={() => handleStatusUpdate('blocked')}
            className="text-red-600 focus:text-red-700 font-medium text-sm"
          >
            Mark Blocked
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={handleDelete}
            className="text-red-600 focus:text-red-700 font-medium text-sm"
          >
            Delete Task
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <MarkBlockedDialog 
        taskId={task.id} 
        projectId={projectId} 
        open={showBlockedDialog} 
        onOpenChange={setShowBlockedDialog} 
      />
    </>
  )
}
