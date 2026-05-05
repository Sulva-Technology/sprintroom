'use client'

import { format } from 'date-fns'
import { CalendarClock, X, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cancelFocusSchedule } from '@/app/actions/scheduling'
import { useState } from 'react'

export function UpcomingSchedulesList({ schedules }: { schedules: any[] }) {
  const [isUpdating, setIsUpdating] = useState(false)

  const handleCancel = async (scheduleId: string) => {
    setIsUpdating(true)
    await cancelFocusSchedule(scheduleId)
    setIsUpdating(false)
  }

  if (schedules.length === 0) {
    return null
  }

  return (
    <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6 mb-8">
      <div className="flex items-center gap-2 mb-4 text-amber-800">
        <CalendarClock className="w-5 h-5" />
        <h2 className="text-lg font-bold">Upcoming Scheduled Sessions</h2>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {schedules.map((schedule) => (
          <div key={schedule.id} className="bg-white border rounded-2xl p-4 shadow-sm flex items-start justify-between">
            <div>
              <div className="font-bold text-sm mb-1">{schedule.tasks?.title || 'General Focus Session'}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
                <Timer className="w-3.5 h-3.5" />
                {schedule.duration_minutes} minutes
              </div>
              <div className="text-xs font-semibold text-amber-600 bg-amber-100/50 inline-block px-2 py-0.5 rounded border border-amber-100">
                {format(new Date(schedule.start_time), 'MMM d, h:mm a')}
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => handleCancel(schedule.id)}
              disabled={isUpdating}
              className="text-slate-400 hover:text-red-500 hover:bg-red-50 h-8 w-8 -mr-2 -mt-2"
              title="Cancel session"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
