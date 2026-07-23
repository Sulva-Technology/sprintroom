'use client'

import { useEffect, useRef } from 'react'
import { getTodaysOpenRhythmTasks, getTodaysReminders } from '@/app/actions/rhythm'
import { useFocusSound } from '@/hooks/use-focus-sound'
import { useFocusNotifications } from '@/hooks/use-focus-notifications'
import {
  buildRhythmNudgeMessage,
  getRhythmNudgeSlot,
  localDateKey,
  rhythmNudgeStorageKey,
  type OpenRhythmTask,
} from '@/lib/rhythm-nudge'

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
 *
 * It also runs the hourly rhythm nudge: between 06:00 and 18:00 local time it
 * notifies once an hour while any of today's rhythm tasks are still unlogged,
 * and goes quiet as soon as the day is cleared (or the window closes).
 */
export function AlarmManager() {
  const { playSound } = useFocusSound()
  const { showNotification } = useFocusNotifications()
  const remindersRef = useRef<Reminder[]>([])
  const openTasksRef = useRef<OpenRhythmTask[]>([])

  useEffect(() => {
    let cancelled = false

    const refresh = async () => {
      try {
        const now = new Date()
        const [reminders, openTasks] = await Promise.all([
          getTodaysReminders(),
          getTodaysOpenRhythmTasks(now.getDay(), localDateKey(now)),
        ])
        if (cancelled) return
        remindersRef.current = reminders as Reminder[]
        openTasksRef.current = openTasks as OpenRhythmTask[]
      } catch (err) {
        console.error('Error fetching reminders:', err)
      }
    }

    const checkHourlyNudge = () => {
      const slot = getRhythmNudgeSlot(new Date())
      if (!slot) return
      // Day already cleared — nothing to nag about.
      if (openTasksRef.current.length === 0) return

      const key = rhythmNudgeStorageKey(slot)
      try {
        if (localStorage.getItem(key)) return
        localStorage.setItem(key, '1')
      } catch {
        // No dedupe storage — skip rather than notify every tick.
        return
      }

      const { title, body } = buildRhythmNudgeMessage(openTasksRef.current)
      playSound('warning')
      showNotification(title, body, { tag: `sprintroom-rhythm-nudge-${slot.dateKey}` })
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

    const tick = () => {
      check()
      checkHourlyNudge()
    }

    refresh().then(() => {
      if (!cancelled) tick()
    })
    check()

    // Re-pull the reminder set periodically (picks up new/edited/completed ones).
    const refreshInterval = setInterval(refresh, 5 * 60 * 1000)
    // Check the clock frequently enough to fire within the target minute.
    const checkInterval = setInterval(tick, 20 * 1000)

    // A phone that was asleep resumes here — re-sync before deciding.
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        refresh().then(() => {
          if (!cancelled) tick()
        })
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      clearInterval(refreshInterval)
      clearInterval(checkInterval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [playSound, showNotification])

  return null
}
