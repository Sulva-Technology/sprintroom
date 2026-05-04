'use client'

import { formatDistanceToNow } from 'date-fns'
import { Trash2, RefreshCw, AlertCircle } from 'lucide-react'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { useSyncStatus } from '@/hooks/use-sync-status'

interface PendingChangesDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PendingChangesDrawer({ open, onOpenChange }: PendingChangesDrawerProps) {
  const { queue, refreshStatus, removeSyncItem } = useSyncStatus()

  const handleRetry = () => {
    window.dispatchEvent(new Event('sprintroom-sync-requested'))
  }

  const handleDiscard = async (id: string) => {
    await removeSyncItem(id)
    await refreshStatus()
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle>Pending Changes</DrawerTitle>
          <DrawerDescription>Changes waiting to be saved to the server.</DrawerDescription>
        </DrawerHeader>
        <div className="p-4 overflow-y-auto w-full max-w-2xl mx-auto flex flex-col gap-4">
          
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">{queue.length} items to sync</span>
            {queue.length > 0 && (
              <Button size="sm" onClick={handleRetry} className="gap-2">
                <RefreshCw className="w-4 h-4" /> Sync Now
              </Button>
            )}
          </div>

          {queue.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p>Everything is synced up.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {queue.map(item => (
                <div key={item.id} className={`p-4 rounded-xl border ${item.status === 'failed' ? 'border-red-200 bg-red-50/50' : 'border-slate-200'}`}>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between mb-3">
                    <div>
                      <div className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                        {getActionTitle(item.action)}
                        {item.status === 'failed' && <span className="text-xs bg-red-100 text-red-700 px-1.5 rounded">Failed</span>}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatDistanceToNow(new Date(item.client_created_at), { addSuffix: true })}
                      </div>
                    </div>
                    
                    <Button variant="ghost" size="sm" onClick={() => handleDiscard(item.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50 self-start">
                      <Trash2 className="w-4 h-4 mr-1" /> Discard
                    </Button>
                  </div>
                  
                  {item.status === 'failed' && item.last_error && (
                    <div className="bg-white/60 p-2 rounded text-xs text-red-600 border border-red-100 flex items-start gap-1.5 mt-2">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <div>{item.last_error}</div>
                    </div>
                  )}
                  
                  <div className="text-xs text-slate-500 mt-2 bg-slate-50 p-2 rounded">
                     <code>{JSON.stringify(item.payload, null, 2)}</code>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </DrawerContent>
    </Drawer>
  )
}

function getActionTitle(action: string) {
  switch (action) {
    case 'create_task': return 'Create new task'
    case 'update_task': return 'Update task'
    case 'update_task_status': return 'Change task status'
    case 'complete_focus_session': return 'Log focus session'
    case 'create_comment': return 'Post comment'
    case 'create_checklist_item': return 'Add checklist item'
    default: return action.replace(/_/g, ' ')
  }
}
