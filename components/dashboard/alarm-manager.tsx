'use client'

import { useEffect, useRef } from 'react'
import { getTodaysReminders } from '@/app/actions/rhythm'
import { useFocusSound } from '@/hooks/use-focus-sound'
import { useFocusNotifications } from '@/hooks/use-focus-notifications'

type Reminder = {
  id: string
  rhythmTaskId: string
  time: string // 'HH:MM'
  title: string
  rhythmName: string | null
}

/**
 * Polls the user's rhythm reminders and fires a sound + browser notification
 * when a reminder time is reached. Fires at most once per reminder per day
 * (persisted in localStorage so a reload doesn't re-alarm), and catches up if
 * the app is opened after a reminder time has already passed.
 */
export function AlarmManager() {
  const { playSound } = useFocusSound()
  const { showNotification } = useFocusNotifications()
  const remindersRef = useRef<Reminder[]>([])

  useEffect(() => {
    let cancelled = false

    const refresh = async () => {
      try {
        const reminders = await getTodaysReminders()
        if (!cancelled) remindersRef.current = reminders as Reminder[]
      } catch (err) {
        console.error('Error fetching reminders:', err)
      }
    }

    const check = () => {
      const now = new Date()
      const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const dateKey = now.toISOString().slice(0, 10)

      for (const reminder of remindersRef.current) {
        if (!reminder.time) continue
        // Fire once the reminder time has been reached (with same-day catch-up).
        if (current < reminder.time) continue

        const firedKey = `sprintroom-reminder-fired-${reminder.id}-${dateKey}`
        try {
          if (localStorage.getItem(firedKey)) continue
          localStorage.setItem(firedKey, '1')
        } catch {
          // If localStorage is unavailable we can't dedupe reliably; skip to
          // avoid an alarm loop.
          continue
        }

        playSound('warning')
        showNotification(
          `Rhythm reminder: ${reminder.title}`,
          reminder.rhythmName ? `From "${reminder.rhythmName}"` : 'Time for your scheduled task.'
        )
      }
    }

    refresh()
    check()

    // Re-pull the reminder set periodically (picks up new/edited/completed ones).
    const refreshInterval = setInterval(refresh, 5 * 60 * 1000)
    // Check the clock frequently enough to fire within the target minute.
    const checkInterval = setInterval(check, 20 * 1000)

    return () => {
      cancelled = true
      clearInterval(refreshInterval)
      clearInterval(checkInterval)
    }
  }, [playSound, showNotification])

  return null
}
