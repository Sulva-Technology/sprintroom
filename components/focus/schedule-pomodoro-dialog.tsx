'use client'

import { useState } from 'react'
import { Calendar as CalendarIcon, Clock, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { scheduleFocusSession } from '@/app/actions/scheduling'
import { usePushNotifications } from '@/hooks/use-push-notifications'

export function SchedulePomodoroDialog({
  open,
  onOpenChange,
  taskId,
  projectId
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId?: string;
  projectId?: string;
}) {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [time, setTime] = useState(format(new Date(Date.now() + 30 * 60 * 1000), 'HH:mm'))
  const [duration, setDuration] = useState(25)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<{ message: string; details?: any } | null>(null)

  const { isSubscribed, subscribeToPush } = usePushNotifications()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      // Attempt to subscribe to push notifications if not already subscribed
      if (!isSubscribed) {
        await subscribeToPush()
      }

      // Combine date and time
      const start_time = `${date}T${time}`

      const res = await scheduleFocusSession({
        task_id: taskId || null,
        project_id: projectId || null,
        start_time,
        duration_minutes: duration
      })

      if (res.success) {
        onOpenChange(false)
      } else {
        setError(res.error || { message: 'Failed to schedule.' })
      }
    } catch (err: any) {
      setError({ message: 'Something went wrong.', details: err.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-2xl p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl">Schedule Focus Session</DialogTitle>
          <DialogDescription>
            Set a time for your next Pomodoro. We'll notify you before it starts.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="date" className="font-semibold text-foreground/80">Date</Label>
              <div className="relative">
                <Input
                  id="date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={isSubmitting}
                  className="rounded-xl shadow-sm border-border/80 focus-visible:ring-primary/20 h-10 pl-3"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="time" className="font-semibold text-foreground/80">Time</Label>
              <div className="relative">
                <Input
                  id="time"
                  type="time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  disabled={isSubmitting}
                  className="rounded-xl shadow-sm border-border/80 focus-visible:ring-primary/20 h-10 pl-3"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="duration" className="font-semibold text-foreground/80">Duration (Minutes)</Label>
            <Input
              id="duration"
              type="number"
              min="1"
              max="120"
              required
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              disabled={isSubmitting}
              className="rounded-xl shadow-sm border-border/80 focus-visible:ring-primary/20 h-10"
            />
          </div>

          {!isSubscribed && (
            <div className="bg-amber-50 text-amber-800 text-[11px] leading-relaxed p-3 rounded-xl border border-amber-200/50">
              <p className="font-semibold mb-0.5">Push Notifications Recommended</p>
              Allow notifications when prompted to receive your 5-minute session warning.
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
              {error.message}{error.details && ` (Details: ${typeof error.details === 'string' ? error.details : JSON.stringify(error.details)})`}
            </div>
          )}

          <DialogFooter className="pt-4 border-t border-slate-100 mt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="rounded-xl h-10">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="rounded-xl h-10 shadow-sm">
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scheduling...
                </>
              ) : 'Schedule Session'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
