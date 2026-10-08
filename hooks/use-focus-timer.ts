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

/**
 * Pure timer maths. `now` is 0 until the client clock is known (server render
 * and first paint): that must render a full, static clock — computing with
 * now = 0 produced remainingSeconds in the hundreds of millions and a wildly
 * distorted progress ring. Remaining time is clamped to [0, duration] so a
 * device clock that runs behind the server can't show more than the session.
 */
export function computeFocusTimer({
  now,
  startedAt,
  durationMinutes,
  status,
  pausedAt = null,
  totalPausedSeconds = 0,
}: UseFocusTimerProps & { now: number }) {
  const durationSeconds = durationMinutes * 60
  const isPaused = Boolean(pausedAt) && status === 'active'
  const clockKnown = now > 0

  let elapsedSeconds = 0
  let remainingSeconds = durationSeconds
  let isComplete = false

  if (startedAt && status === 'active' && clockKnown) {
    const startTimeMs = new Date(startedAt).getTime()
    // Freeze the clock at the moment the pause started.
    const effectiveNow = isPaused ? new Date(pausedAt as string | Date).getTime() : now
    const rawElapsed = Math.floor((effectiveNow - startTimeMs - (totalPausedSeconds || 0) * 1000) / 1000)
    elapsedSeconds = Math.min(durationSeconds, Math.max(0, rawElapsed))
    remainingSeconds = durationSeconds - elapsedSeconds
    isComplete = !isPaused && remainingSeconds <= 0
  } else if (startedAt && status === 'completed') {
    elapsedSeconds = durationSeconds
    remainingSeconds = 0
    isComplete = true
  }

  const progressPercent = durationSeconds > 0 ? (elapsedSeconds / durationSeconds) * 100 : 0

  const hasOneMinuteWarningPassed =
    remainingSeconds <= 60 && remainingSeconds > 0 && status === 'active' && !isPaused && clockKnown

  const m = Math.floor(remainingSeconds / 60)
  const s = remainingSeconds % 60
  const formattedTime = clockKnown ? `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : '--:--'

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

export function useFocusTimer(props: UseFocusTimerProps) {
  // 0 on the server AND on the client's first (hydrating) render, so both
  // produce identical markup; the real clock starts right after mount.
  const [now, setNow] = useState(0)

  const isPaused = Boolean(props.pausedAt) && props.status === 'active'
  const running = props.status === 'active' && !isPaused

  useEffect(() => {
    // Seed the clock once after mount (also while paused, so the frozen time shows).
    const first = setTimeout(() => setNow(Date.now()), 0)
    if (!running) return () => clearTimeout(first)

    // Refresh every second. Re-reading Date.now() avoids setInterval drift.
    const intervalId = setInterval(() => setNow(Date.now()), 1000)

    // Recalculate on visibility change (brings it back from background safely)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') setNow(Date.now())
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearTimeout(first)
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [running])

  return computeFocusTimer({ ...props, now })
}
