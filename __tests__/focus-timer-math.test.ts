import { describe, expect, it } from 'vitest'
import { computeFocusTimer } from '@/hooks/use-focus-timer'

/**
 * The full-screen ring rendered "distorted": before the client clock existed
 * (now = 0, i.e. the server render and first paint) elapsed time was hugely
 * negative, so remainingSeconds was ~345 million and the ring's
 * strokeDashoffset was -345190884. A device clock running behind the server
 * caused the same overshoot (e.g. 27:30 on a 25-minute session).
 */

const START = '2026-10-08T10:00:00.000Z'
const startMs = Date.parse(START)

describe('computeFocusTimer', () => {
  it('shows a full, sane clock before the client clock is known', () => {
    const t = computeFocusTimer({ now: 0, startedAt: START, durationMinutes: 25, status: 'active' })
    expect(t.remainingSeconds).toBe(1500)
    expect(t.progressPercent).toBe(0)
    expect(t.formattedTime).toBe('--:--')
  })

  it('never shows more than the session length when the device clock is behind', () => {
    const t = computeFocusTimer({ now: startMs - 150_000, startedAt: START, durationMinutes: 25, status: 'active' })
    expect(t.remainingSeconds).toBe(1500)
    expect(t.formattedTime).toBe('25:00')
  })

  it('counts down normally', () => {
    const t = computeFocusTimer({ now: startMs + 197_000, startedAt: START, durationMinutes: 25, status: 'active' })
    expect(t.elapsedSeconds).toBe(197)
    expect(t.remainingSeconds).toBe(1303)
    expect(t.formattedTime).toBe('21:43')
  })

  it('freezes at the pause moment and subtracts banked pauses', () => {
    const t = computeFocusTimer({
      now: startMs + 900_000,
      startedAt: START,
      durationMinutes: 25,
      status: 'active',
      pausedAt: new Date(startMs + 600_000).toISOString(),
      totalPausedSeconds: 60,
    })
    expect(t.isPaused).toBe(true)
    expect(t.elapsedSeconds).toBe(540)
    expect(t.formattedTime).toBe('16:00')
  })

  it('completes at zero', () => {
    const t = computeFocusTimer({ now: startMs + 1_600_000, startedAt: START, durationMinutes: 25, status: 'active' })
    expect(t.remainingSeconds).toBe(0)
    expect(t.isComplete).toBe(true)
  })
})
