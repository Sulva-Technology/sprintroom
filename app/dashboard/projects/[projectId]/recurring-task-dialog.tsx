'use client'

import { useState } from 'react'
import { Repeat, Loader2, Calendar } from 'lucide-react'
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
import { createRecurringTaskRule } from '@/app/actions/scheduling'

export function RecurringTaskDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<{ message: string; details?: any } | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const frequency = formData.get('frequency') as 'daily' | 'weekly' | 'monthly'
    const next_run_at = formData.get('next_run_at') as string

    const payload = {
      project_id: projectId,
      template_title: title,
      template_description: description,
      frequency,
      next_run_at,
      target_status: 'backlog'
    }

    try {
      const res = await createRecurringTaskRule(payload)
      if (res.success) {
        setOpen(false)
      } else {
        setError(res.error || { message: 'Failed to create recurring task.' })
      }
    } catch (err: any) {
      setError({ message: 'Something went wrong.', details: err.message })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={(
          <Button variant="ghost" size="sm" className="h-9 rounded-xl text-slate-500 hover:text-primary hover:bg-primary/5">
            <Repeat className="w-4 h-4 mr-2" />
            Recurring Rules
          </Button>
        )}
      />
      <DialogContent className="sm:max-w-[480px] rounded-2xl p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl flex items-center gap-2">
            <Repeat className="w-5 h-5 text-primary" />
            New Recurring Task
          </DialogTitle>
          <DialogDescription>
            Create a template that will automatically generate tasks on a schedule.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title" className="font-semibold text-foreground/80">Task Template Title</Label>
            <Input
              id="title"
              name="title"
              placeholder="Daily standup prep..."
              required
              disabled={isLoading}
              className="h-11 rounded-xl shadow-sm border-border/80 focus-visible:ring-primary/20"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="font-semibold text-foreground/80">Description (Optional)</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="What should be included in every instance?"
              disabled={isLoading}
              className="resize-none rounded-xl shadow-sm border-border/80 focus-visible:ring-primary/20 min-h-[80px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="frequency" className="font-semibold text-foreground/80">Frequency</Label>
              <Select name="frequency" defaultValue="daily" disabled={isLoading}>
                <SelectTrigger className="h-10 rounded-xl shadow-sm border-border/80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="next_run_at" className="font-semibold text-foreground/80">First Run Date</Label>
              <Input
                id="next_run_at"
                name="next_run_at"
                type="date"
                required
                disabled={isLoading}
                defaultValue={new Date().toISOString().split('T')[0]}
                className="h-10 rounded-xl shadow-sm border-border/80 focus-visible:ring-primary/20"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
              {error.message}{error.details && ` (Details: ${typeof error.details === 'string' ? error.details : JSON.stringify(error.details)})`}
            </div>
          )}

          <DialogFooter className="pt-4 border-t border-slate-100 mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isLoading} className="rounded-xl h-10">
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="rounded-xl h-10 shadow-sm">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : 'Save Rule'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
