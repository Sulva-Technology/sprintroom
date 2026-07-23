'use client'

import { useState, useEffect } from 'react'

interface UseFocusTimerProps {
  startedAt: string | Date | null
  durationMinutes: number
  status: 'active' | 'completed' | 'abandoned' | 'cancelled' | string
  /** ISO timestamp of the current pause, or null/undefined when running. */
  pausedAt?: string | Date | null
  /** Accumulated paused time (seconds) already banked from earlier pauses. */
  totalPausedSeconds?: number
}

export function useFocusTimer({
  startedAt,
  durationMinutes,
  status,
  pausedAt = null,
  totalPausedSeconds = 0,
}: UseFocusTimerProps) {
  const [now, setNow] = useState(() => (typeof window !== 'undefined' ? Date.now() : 0))

  const isPaused = Boolean(pausedAt) && status === 'active'

  useEffect(() => {
    if (status !== 'active') return
    // While paused the displayed time is frozen, so we don't need to tick.
    if (isPaused) return

    // Refresh every second.
    // By re-fetching Date.now() we prevent standard setInterval drift.
    const intervalId = setInterval(() => setNow(Date.now()), 1000)

    // Recalculate on visibility change (brings it back from background safely)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setNow(Date.now())
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [status, isPaused])

  // Calculations
  const startTimeMs = startedAt ? new Date(startedAt).getTime() : 0
  const durationSeconds = durationMinutes * 60
  const bankedPausedMs = (totalPausedSeconds || 0) * 1000

  let elapsedSeconds = 0
  let remainingSeconds = 0
  let progressPercent = 0
  let isComplete = false

  if (startedAt) {
    if (status === 'active') {
      // Freeze the clock at the moment the pause started.
      const effectiveNow = isPaused ? new Date(pausedAt as string | Date).getTime() : now
      const rawElapsed = Math.floor((effectiveNow - startTimeMs - bankedPausedMs) / 1000)
      elapsedSeconds = Math.max(0, rawElapsed)
      remainingSeconds = Math.max(0, durationSeconds - rawElapsed)
      isComplete = !isPaused && remainingSeconds <= 0
    } else if (status === 'completed') {
      elapsedSeconds = durationSeconds
      remainingSeconds = 0
      isComplete = true
    } else {
      // abandoned / cancelled
      elapsedSeconds = 0
      remainingSeconds = durationSeconds
      isComplete = false
    }

    const rawProgress = (elapsedSeconds / durationSeconds) * 100
    progressPercent = Math.min(100, Math.max(0, rawProgress))
  } else {
    remainingSeconds = durationSeconds
  }

  const hasOneMinuteWarningPassed =
    remainingSeconds <= 60 && remainingSeconds > 0 && status === 'active' && !isPaused

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
    isPaused,
    formattedTime,
    hasOneMinuteWarningPassed,
  }
}
