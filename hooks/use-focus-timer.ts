'use client'

import { useState, useEffect, useCallback } from 'react'

interface UseFocusTimerProps {
  startedAt: string | Date | null
  durationMinutes: number
  status: 'active' | 'completed' | 'abandoned' | 'cancelled' | string
}

export function useFocusTimer({ startedAt, durationMinutes, status }: UseFocusTimerProps) {
    const [now, setNow] = useState(0)

  useEffect(() => {
    setNow(Date.now());
  }, []);

  useEffect(() => {
    if (status !== 'active') return

    // Refresh every second.
    // By re-fetching Date.now() we prevent standard setInterval drift.
    const intervalId = setInterval(() => setNow(Date.now()), 1000)

    // Recalculate on visibility change (brings it back from background safely)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setNow(Date.now());
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [status])

  // Calculations
  const startTimeMs = startedAt ? new Date(startedAt).getTime() : 0
  const durationMs = durationMinutes * 60 * 1000
  const endTimeMs = startTimeMs + durationMs

  let elapsedSeconds = 0
  let remainingSeconds = 0
  let progressPercent = 0
  let isComplete = false

  if (startedAt) {
    if (status === 'active') {
      elapsedSeconds = Math.max(0, Math.floor((now - startTimeMs) / 1000))
      remainingSeconds = Math.max(0, Math.floor((endTimeMs - now) / 1000))
      isComplete = now >= endTimeMs
    } else if (status === 'completed') {
      elapsedSeconds = durationMinutes * 60
      remainingSeconds = 0
      isComplete = true
    } else {
      // abandoned / cancelled
      elapsedSeconds = 0
      remainingSeconds = durationMinutes * 60
      isComplete = false
    }

    const rawProgress = (elapsedSeconds / (durationMinutes * 60)) * 100
    progressPercent = Math.min(100, Math.max(0, rawProgress))
  } else {
     remainingSeconds = durationMinutes * 60
  }

  const hasOneMinuteWarningPassed = remainingSeconds <= 60 && remainingSeconds > 0 && status === 'active'

  const m = Math.floor(remainingSeconds / 60)
  const s = remainingSeconds % 60
  const formattedTime = now > 0
    ? `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : '--:--'

  return {
    remainingSeconds,
    elapsedSeconds,
    progressPercent,
    isComplete,
    formattedTime,
    hasOneMinuteWarningPassed
  }
}
