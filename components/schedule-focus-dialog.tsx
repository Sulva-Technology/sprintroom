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

export function ScheduleFocusDialog({ taskId, projectId, workspaceId }: { taskId?: string, projectId?: string, workspaceId?: string }) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  // Default to +5 minutes from now
  const defaultTime = new Date(Date.now() + 5 * 60000)
  const defaultDateStr = defaultTime.toISOString().slice(0, 16) // "yyyy-MM-ddThh:mm" format

  const [startTime, setStartTime] = useState(defaultDateStr)
  const [duration, setDuration] = useState('25')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    // Parse the local datetime input into ISO string
    const startTimeISO = new Date(startTime).toISOString()

    await scheduleFocusSession(
      taskId || null,
      projectId || null,
      workspaceId || null,
      startTimeISO,
      parseInt(duration)
    )

    setIsLoading(false)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-full border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100" onClick={() => setOpen(true)} type="button">
          <CalendarClock className="w-3.5 h-3.5" />
          Schedule Focus
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle>Schedule Focus Session</DialogTitle>
          <DialogDescription>
            Plan a Pomodoro session in advance. We'll remind you when it's time to start.
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
              className="rounded-xl shadow-sm"
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
              className="rounded-xl shadow-sm"
              disabled={isLoading}
            />
          </div>

          <div className="pt-4 flex justify-end">
            <Button type="submit" disabled={isLoading} className="rounded-xl shadow-md w-full bg-amber-500 hover:bg-amber-600 text-white">
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Schedule Session
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
