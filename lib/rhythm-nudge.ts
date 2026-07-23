/**
 * Hourly "clear your rhythm" nudge.
 *
 * Rule: from 06:00 to 18:00 (device local time) fire one notification per hour
 * while the user still has uncompleted rhythm tasks for today. It stops as soon
 * as every task for the day is logged, and never fires after 18:00.
 *
 * Kept as pure functions so the schedule is unit-testable without timers.
 */

export const RHYTHM_NUDGE_START_HOUR = 6
export const RHYTHM_NUDGE_END_HOUR = 18

export interface RhythmNudgeSlot {
  /** Local calendar day, 'yyyy-MM-dd'. */
  dateKey: string
  /** Hour slot 6..18 the nudge belongs to. */
  hour: number
}

export interface OpenRhythmTask {
  id: string
  title: string
}

/** Local (not UTC) 'yyyy-MM-dd' — the nudge window is device-local. */
export function localDateKey(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/**
 * The nudge slot `now` falls into, or null when outside the 06:00–18:00 window.
 * 18:00 itself is the last slot; 18:01+ is outside.
 */
export function getRhythmNudgeSlot(now: Date): RhythmNudgeSlot | null {
  const hour = now.getHours()
  if (hour < RHYTHM_NUDGE_START_HOUR || hour > RHYTHM_NUDGE_END_HOUR) return null
  if (hour === RHYTHM_NUDGE_END_HOUR && now.getMinutes() > 0) return null
  return { dateKey: localDateKey(now), hour }
}

/** localStorage key that makes a slot fire at most once. */
export function rhythmNudgeStorageKey(slot: RhythmNudgeSlot): string {
  return `sprintroom-rhythm-nudge-${slot.dateKey}-${String(slot.hour).padStart(2, '0')}`
}

export function buildRhythmNudgeMessage(openTasks: OpenRhythmTask[]): { title: string; body: string } {
  const count = openTasks.length
  const title = count === 1
    ? '1 rhythm task still open'
    : `${count} rhythm tasks still open`

  const names = openTasks.slice(0, 3).map((task) => task.title).join(', ')
  const rest = count > 3 ? ` +${count - 3} more` : ''

  return {
    title,
    body: `Clear them before the day ends: ${names}${rest}`,
  }
}
