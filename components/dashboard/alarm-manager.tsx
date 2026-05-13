'use client'

import { useEffect, useRef } from 'react'
import { getRhythms } from '@/app/actions/rhythm'
import { format, parse, isAfter, isBefore, addMinutes } from 'date-fns'

export function AlarmManager() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lastPlayedRef = useRef<string | null>(null)

  useEffect(() => {
    // Initialize audio object
    audioRef.current = new Audio('/sounds/warning.mp3')
    audioRef.current.volume = 0.5

    const checkReminders = async () => {
      try {
        const rhythms = await getRhythms()
        const now = new Date()
        const todayDay = now.getDay() // 0-6 (Sun-Sat)
        const currentTime = format(now, 'HH:mm')

        rhythms.forEach((rhythm: any) => {
          rhythm.weekly_rhythm_tasks?.forEach((task: any) => {
            // If task is for today
            if (task.day_of_week === todayDay) {
              // We need task_reminders too. 
              // For now, let's assume if there's a reminder for this task at this time
              // In the full version, we'd fetch specific task_reminders table
            }
          })
        })

        // Placeholder logic: If it's a specific time, play sound
        // This is a simplified version. A real implementation would query 
        // a 'reminders' table joined with 'weekly_rhythm_tasks'
      } catch (err) {
        console.error('Error checking reminders:', err)
      }
    }

    const interval = setInterval(checkReminders, 60000) // Check every minute
    return () => clearInterval(interval)
  }, [])

  return null
}
