const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Convert an <input type="date"> value (or an ISO timestamp from the offline
 * queue) into the value stored in `tasks.deadline`. Date-only values are pinned
 * to 12:00 UTC: midnight UTC rendered a day early for everyone west of UTC.
 */
export function toDeadlineIso(value: string): string | null {
  if (!value) return null
  if (DATE_ONLY.test(value)) return `${value}T12:00:00.000Z`
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) throw new Error('Invalid date')
  return parsed.toISOString()
}

/** The calendar-date part of a stored deadline, for an <input type="date">. */
export function dateInputFromDeadline(deadline: string | null): string {
  return deadline ? deadline.slice(0, 10) : ''
}
