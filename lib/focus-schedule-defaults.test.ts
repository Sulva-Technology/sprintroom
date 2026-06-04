import { describe, expect, it } from 'vitest'

import {
  getDefaultPomodoroScheduleValues,
  getDefaultFocusSessionStartTime,
} from './focus-schedule-defaults'

describe('focus schedule defaults', () => {
  it('builds default pomodoro schedule values from a base time', () => {
    const values = getDefaultPomodoroScheduleValues(new Date('2026-05-14T10:15:00+01:00'))

    expect(values).toEqual({
      date: '2026-05-14',
      time: '10:45',
    })
  })

  it('builds a default focus-session start time five minutes ahead in local-input format', () => {
    const value = getDefaultFocusSessionStartTime(new Date('2026-05-14T10:15:00+01:00'))

    expect(value).toBe('2026-05-14T10:20')
  })
})
