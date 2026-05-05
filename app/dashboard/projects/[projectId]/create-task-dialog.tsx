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
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createTask } from '@/app/actions/tasks'
import { addToSyncQueue } from '@/lib/offline/sync-queue'

export function CreateTaskDialog({ projectId, trigger }: { projectId: string; trigger?: React.ReactElement }) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<{ message: string; details?: any; } | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const priority = formData.get('priority') as string
    const deadline = formData.get('deadline') as string
    const estimate_pomodoros = parseInt(formData.get('estimate_pomodoros') as string, 10) || 0

    if (!title || title.trim().length < 2) {
      setError({ message: 'Title requires at least 2 characters.', details: 'Please enter a title with at least 2 characters.' })
      setIsLoading(false)
      return
    }

    const payload = {
      project_id: projectId,
      title,
      description,
      priority: priority || 'medium',
      deadline: deadline || undefined,
      estimate_pomodoros
    }

    try {
      if (!navigator.onLine) {
        await addToSyncQueue('create_task', 'task', crypto.randomUUID(), payload, undefined, projectId)
        setOpen(false)
        return
      }

      const res = await createTask(payload)
      if (res?.error) {
        setError(res.error)
      } else {
        setOpen(false)
      }
    } catch (err: any) {
      setError({ message: 'Something went wrong.', details: err.message || 'An unknown error occurred.' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) setError(null); }}>
      <DialogTrigger 
        render={trigger || (
          <Button variant="outline" className="rounded-xl shadow-sm h-10 px-4">
             New Task
          </Button>
        )} 
      />
      <DialogContent className="sm:max-w-[480px] rounded-2xl p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl">New Task</DialogTitle>
          <DialogDescription>
            Add a new task to your project backlog. You can refine details later.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5 border-b border-border/50 pb-4">
            <Label htmlFor="title" className="font-semibold text-foreground/80">Title</Label>
            <Input 
              id="title" 
              name="title" 
              placeholder="What needs to be done?"
              disabled={isLoading}
              className="h-11 text-base rounded-xl border-border/80 outline-none focus-visible:ring-primary/20 shadow-none border-t-0 border-x-0 rounded-none bg-transparent px-0"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="font-semibold text-foreground/80">Description</Label>
            <Textarea 
              id="description" 
              name="description" 
              placeholder="Additional context or links..."
              disabled={isLoading}
              className="resize-none rounded-xl shadow-sm border-border/80 focus-visible:ring-primary/20 min-h-[80px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="priority" className="font-semibold text-foreground/80">Priority</Label>
              <Select name="priority" defaultValue="medium" disabled={isLoading}>
                <SelectTrigger className="h-10 rounded-xl shadow-sm border-border/80 focus-visible:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="estimate_pomodoros" className="font-semibold text-foreground/80">Pomodoros</Label>
              <Input 
                id="estimate_pomodoros" 
                name="estimate_pomodoros" 
                type="number"
                min="0"
                placeholder="0"
                disabled={isLoading}
                className="h-10 rounded-xl shadow-sm border-border/80 focus-visible:ring-primary/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="space-y-1.5">
              <Label htmlFor="deadline" className="font-semibold text-foreground/80">Deadline</Label>
              <Input 
                id="deadline" 
                name="deadline" 
                type="date"
                disabled={isLoading}
                className="h-10 rounded-xl shadow-sm border-border/80 focus-visible:ring-primary/20"
              />
            </div>
            {/* Keeping it aligned, we could add owner select but simpler to leave for detail view */}
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
              {error.message}{error.details && ` (Details: ${typeof error.details === 'string' ? error.details : JSON.stringify(error.details)})`}
            </div>
          )}

          <DialogFooter className="pt-4 mt-2 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isLoading} className="rounded-xl h-10 w-full sm:w-auto font-semibold text-slate-600">
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="rounded-xl h-10 w-full sm:w-auto shadow-sm">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : 'Create task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
