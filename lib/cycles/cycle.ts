import { addDaysToKey, daysBetweenKeys } from '@/lib/dates'

export type CycleRow = {
  id: string
  name: string
  starts_on: string
  ends_on: string
  completed_at: string | null
  completed_count: number | null
  carried_over_count: number | null
}

const IN_PROGRESS = new Set(['doing', 'review', 'blocked'])

export function currentCycle<T extends { starts_on: string; ends_on: string; completed_at: string | null }>(
  cycles: T[],
  todayKey: string
): T | undefined {
  return cycles.find((c) => !c.completed_at && c.starts_on <= todayKey && todayKey <= c.ends_on)
}

export function newCycleDates(todayKey: string, weeks: 1 | 2) {
  return { starts_on: todayKey, ends_on: addDaysToKey(todayKey, weeks * 7 - 1) }
}

/** Days left including today; 0 once the cycle has ended. */
export function cycleDaysLeft(cycle: { ends_on: string }, todayKey: string): number {
  return Math.max(0, daysBetweenKeys(todayKey, cycle.ends_on) + 1)
}

export function cycleProgress(tasks: { status: string; carry_over_count: number }[]) {
  const total = tasks.length
  const done = tasks.filter((t) => t.status === 'done').length
  const inProgress = tasks.filter((t) => IN_PROGRESS.has(t.status)).length
  const carriedOver = tasks.filter((t) => t.carry_over_count > 0).length
  return {
    total,
    done,
    inProgress,
    notStarted: total - done - inProgress,
    carriedOver,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  }
}

/** Matches the name the SQL rollover gives auto-created cycles. */
export function cycleName(startsOn: string): string {
  const label = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${startsOn}T00:00:00Z`)
  )
  return `Cycle · ${label}`
}
