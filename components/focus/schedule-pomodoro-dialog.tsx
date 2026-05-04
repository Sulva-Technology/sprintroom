"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { scheduleFocusSession } from "@/app/actions/focus"
import { usePushNotifications } from "@/hooks/use-push-notifications"

export function SchedulePomodoroDialog({ 
  isOpen, 
  onClose, 
  taskId, 
  projectId 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  taskId?: string; 
  projectId?: string;
}) {
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [duration, setDuration] = useState(25)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { isSubscribed, subscribeToPush } = usePushNotifications()

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!date || !time) return;

    setIsSubmitting(true)
    
    // Attempt to subscribe to push notifications if not already subscribed
    if (!isSubscribed) {
      await subscribeToPush()
    }

    // Combine date and time to ISO string in local timezone
    const dateTimeString = `${date}T${time}`
    const startDateTime = new Date(dateTimeString)

    const result = await scheduleFocusSession(
      startDateTime.toISOString(),
      duration,
      taskId,
      projectId
    )

    setIsSubmitting(false)

    if (result.success) {
      onClose()
    } else {
      alert(result.error || "Failed to schedule.")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Schedule Focus Session</h2>
        <p className="text-sm text-slate-500 mb-6">
          Set a time for your next Pomodoro. We'll send you a warning 5 minutes before it auto-starts.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Date</label>
              <input 
                type="date" 
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Time</label>
              <input 
                type="time" 
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Duration (Minutes)</label>
            <input 
              type="number" 
              min="1"
              max="120"
              required
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>
          
          {!isSubscribed && (
            <div className="bg-amber-50 text-amber-800 text-xs p-3 rounded-lg border border-amber-200">
              Note: You will be asked to allow notifications when you save this schedule to ensure you receive the 5-minute warning.
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t mt-6">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Scheduling..." : "Schedule Session"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
