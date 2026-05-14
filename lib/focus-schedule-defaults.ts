import { format } from 'date-fns'

export function getDefaultPomodoroScheduleValues(now: Date = new Date()) {
  const thirtyMinutesAhead = new Date(now.getTime() + 30 * 60 * 1000)

  return {
    date: format(now, 'yyyy-MM-dd'),
    time: format(thirtyMinutesAhead, 'HH:mm'),
  }
}

export function getDefaultFocusSessionStartTime(now: Date = new Date()) {
  const fiveMinutesAhead = new Date(now.getTime() + 5 * 60 * 1000)
  const localInputTime = new Date(
    fiveMinutesAhead.getTime() - fiveMinutesAhead.getTimezoneOffset() * 60000
  )

  return localInputTime.toISOString().slice(0, 16)
}
