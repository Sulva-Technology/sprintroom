'use client'

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { TICK_STORAGE_KEY, readTickPreference, tickTone, type TickTone } from '@/lib/focus/tick'

const CHANGE_EVENT = 'sprintroom-tick-change'

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

function getSnapshot() {
  try {
    return readTickPreference(localStorage.getItem(TICK_STORAGE_KEY))
  } catch {
    return true
  }
}

type AudioContextCtor = new () => AudioContext

function playTick(ctx: AudioContext, tone: TickTone) {
  const t = ctx.currentTime
  const end = t + tone.durationMs / 1000
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(tone.frequency, t)
  // Fast attack, exponential decay: a clean click with no pop at either end.
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(tone.gain, t + 0.002)
  gain.gain.exponentialRampToValueAtTime(0.0001, end)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t)
  osc.stop(end + 0.01)
}

/**
 * One synthesised "tick" per elapsed second while `running`. Web Audio (not an
 * <audio> element restarted every second, which clipped and garbled) keeps each
 * click identical and sample-accurate. Browsers only allow audio after a user
 * gesture, so the context is unlocked on the first pointer/key press.
 */
export function useTicking({ elapsedSeconds, running }: { elapsedSeconds: number; running: boolean }) {
  const tickEnabled = useSyncExternalStore(subscribe, getSnapshot, () => true)
  const ctxRef = useRef<AudioContext | null>(null)
  const lastSecondRef = useRef<number | null>(null)

  const ensureContext = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null
    if (!ctxRef.current) {
      const Ctor =
        (window as unknown as { AudioContext?: AudioContextCtor }).AudioContext ??
        (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext
      if (!Ctor) return null
      ctxRef.current = new Ctor()
    }
    if (ctxRef.current.state === 'suspended') void ctxRef.current.resume()
    return ctxRef.current
  }, [])

  useEffect(() => {
    const unlock = () => {
      ensureContext()
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [ensureContext])

  useEffect(() => {
    if (!running || !tickEnabled) {
      lastSecondRef.current = null
      return
    }
    if (lastSecondRef.current === elapsedSeconds) return
    lastSecondRef.current = elapsedSeconds
    const ctx = ensureContext()
    if (!ctx || ctx.state !== 'running') return
    playTick(ctx, tickTone(elapsedSeconds))
  }, [elapsedSeconds, running, tickEnabled, ensureContext])

  useEffect(() => {
    return () => {
      void ctxRef.current?.close()
      ctxRef.current = null
    }
  }, [])

  const toggleTick = useCallback(() => {
    const next = !getSnapshot()
    try {
      localStorage.setItem(TICK_STORAGE_KEY, String(next))
    } catch {
      // Storage unavailable: the toggle still applies for this page view.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT))
    // The click is a user gesture, so this is a safe moment to unlock audio.
    if (next) ensureContext()
  }, [ensureContext])

  return { tickEnabled, toggleTick }
}
