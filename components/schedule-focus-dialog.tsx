'use client'

import { useState } from 'react'
import { Plus, Loader2, CalendarClock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { scheduleFocusSession } from '@/app/actions/scheduling'
import { getDefaultFocusSessionStartTime } from '@/lib/focus-schedule-defaults'

export function ScheduleFocusDialog({ taskId, projectId, workspaceId }: { taskId?: string, projectId?: string, workspaceId?: string }) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<{ message: string; details?: any } | null>(null)

  const [startTime, setStartTime] = useState(() => getDefaultFocusSessionStartTime())
  const [duration, setDuration] = useState('25')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const res = await scheduleFocusSession({
        task_id: taskId || null,
        project_id: projectId || null,
        workspace_id: workspaceId || null,
        start_time: new Date(startTime).toISOString(),
        duration_minutes: parseInt(duration)
      })

      if (res.success) {
        setOpen(false)
      } else {
        setError(res.error || { message: 'Failed to schedule.' })
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
          <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-full border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100">
            <CalendarClock className="w-3.5 h-3.5" />
            Schedule Focus
          </Button>
        )}
      />
      <DialogContent className="sm:max-w-[425px] rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle>Schedule Focus Session</DialogTitle>
          <DialogDescription>
            Plan a Pomodoro session in advance. We&apos;ll remind you when it&apos;s time to start.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="startTime">Start Time</Label>
            <Input
              id="startTime"
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
              className="rounded-xl shadow-sm h-11"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">Duration (minutes)</Label>
            <Input
              id="duration"
              type="number"
              min="5"
              max="120"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              required
              className="rounded-xl shadow-sm h-11"
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
              {error.message}{error.details && ` (Details: ${typeof error.details === 'string' ? error.details : JSON.stringify(error.details)})`}
            </div>
          )}

          <div className="pt-4 flex justify-end">
            <Button type="submit" disabled={isLoading} className="rounded-xl shadow-md w-full h-11 bg-amber-500 hover:bg-amber-600 text-white font-semibold">
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Schedule Session
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
