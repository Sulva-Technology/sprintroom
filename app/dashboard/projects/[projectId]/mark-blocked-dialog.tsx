'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { markBlocked } from '@/app/actions/tasks'

export function MarkBlockedDialog({
  taskId,
  projectId,
  open,
  onOpenChange
}: {
  taskId: string
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<{ message: string; details?: any; } | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const reason = formData.get('reason') as string

    if (!reason || reason.trim().length < 5) {
      setError({ message: 'Validation Error', details: 'Please provide a clearer reason.' })
      setIsLoading(false)
      return
    }

    if (!navigator.onLine) {
      const { addToSyncQueue } = await import('@/lib/offline/sync-queue');
      await addToSyncQueue('mark_task_blocked', 'task', taskId, { blockedReason: reason }, undefined, projectId);
      onOpenChange(false)
      setIsLoading(false)
      return
    }

    const res = await markBlocked(taskId, reason, projectId)
    if (res?.error) {
      setError(res.error)
    } else {
      onOpenChange(false)
    }
    setIsLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-2xl p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl text-red-600">Mark task as blocked</DialogTitle>
          <DialogDescription>
            Document what is preventing progress so the team can help clear the runway.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reason" className="font-semibold text-foreground/80">Blocker description</Label>
            <Textarea 
              id="reason" 
              name="reason" 
              placeholder="Waiting on design assets from..."
              disabled={isLoading}
              className="resize-none rounded-xl shadow-sm border-border/80 focus-visible:ring-red-500/20 min-h-[100px]"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
              {error.message}{error.details && ` (Details: ${typeof error.details === 'string' ? error.details : JSON.stringify(error.details)})`}
            </div>
          )}

          <DialogFooter className="pt-4 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading} className="rounded-xl h-10 w-full sm:w-auto font-semibold">
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="rounded-xl h-10 w-full sm:w-auto shadow-sm bg-red-600 hover:bg-red-700 text-white border-transparent">
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Confirm Blocked'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
