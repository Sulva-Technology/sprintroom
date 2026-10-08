export const TICK_STORAGE_KEY = 'sprintroom-tick-enabled'

export type TickTone = { frequency: number; durationMs: number; gain: number }

/**
 * A mechanical-clock "tick… tock": alternate two pitches each second. Short
 * and quiet so it sits under the user's work rather than on top of it.
 */
export function tickTone(elapsedSeconds: number): TickTone {
  return {
    frequency: elapsedSeconds % 2 === 0 ? 1600 : 1250,
    durationMs: 40,
    gain: 0.12,
  }
}

/** Ticking is on unless the user explicitly turned it off. */
export function readTickPreference(stored: string | null): boolean {
  return stored !== 'false'
}
