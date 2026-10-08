import { describe, expect, it, beforeEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { tickTone, readTickPreference } from '@/lib/focus/tick'
import { useTicking } from '@/hooks/use-ticking'

/**
 * "The pomodoro has no ticking clock": the old per-second tick (a 246KB
 * tick.mp3 restarted every second) was removed, so a running session made no
 * sound at all. useTicking synthesises one short click per elapsed second via
 * Web Audio. Before this change neither module existed.
 */

const started: number[] = []

class FakeAudioContext {
  state = 'running'
  currentTime = 0
  destination = {}
  resume = vi.fn(async () => {})
  close = vi.fn(async () => {})
  createOscillator() {
    return {
      type: 'sine',
      frequency: { setValueAtTime: vi.fn() },
      connect: (node: unknown) => node,
      start: () => started.push(1),
      stop: vi.fn(),
    }
  }
  createGain() {
    return {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: (node: unknown) => node,
    }
  }
}

beforeEach(() => {
  started.length = 0
  localStorage.clear()
  ;(window as any).AudioContext = FakeAudioContext
})

describe('tick helpers', () => {
  it('alternates tick and tock pitch each second', () => {
    expect(tickTone(0).frequency).not.toBe(tickTone(1).frequency)
    expect(tickTone(2).frequency).toBe(tickTone(0).frequency)
  })

  it('keeps each tick short and quiet', () => {
    const tone = tickTone(5)
    expect(tone.durationMs).toBeLessThanOrEqual(60)
    expect(tone.gain).toBeLessThanOrEqual(0.2)
  })

  it('defaults ticking on, and honours an explicit "false"', () => {
    expect(readTickPreference(null)).toBe(true)
    expect(readTickPreference('true')).toBe(true)
    expect(readTickPreference('false')).toBe(false)
  })
})

describe('useTicking', () => {
  it('plays exactly one tick per elapsed second while running', () => {
    const { rerender } = renderHook((props: { elapsedSeconds: number; running: boolean }) => useTicking(props), {
      initialProps: { elapsedSeconds: 10, running: true },
    })
    rerender({ elapsedSeconds: 11, running: true })
    rerender({ elapsedSeconds: 11, running: true }) // same second: no extra tick
    rerender({ elapsedSeconds: 12, running: true })
    expect(started).toHaveLength(3)
  })

  it('is silent while paused or finished', () => {
    const { rerender } = renderHook((props: { elapsedSeconds: number; running: boolean }) => useTicking(props), {
      initialProps: { elapsedSeconds: 10, running: false },
    })
    rerender({ elapsedSeconds: 11, running: false })
    expect(started).toHaveLength(0)
  })

  it('can be switched off and remembers the choice', () => {
    const { result, rerender } = renderHook((props: { elapsedSeconds: number; running: boolean }) => useTicking(props), {
      initialProps: { elapsedSeconds: 1, running: true },
    })
    act(() => result.current.toggleTick())
    expect(result.current.tickEnabled).toBe(false)
    expect(localStorage.getItem('sprintroom-tick-enabled')).toBe('false')
    const before = started.length
    rerender({ elapsedSeconds: 2, running: true })
    expect(started).toHaveLength(before)
  })
})
