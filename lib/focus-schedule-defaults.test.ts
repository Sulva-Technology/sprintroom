import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getDefaultPomodoroScheduleValues,
  getDefaultFocusSessionStartTime,
} from './focus-schedule-defaults.ts'

test('builds default pomodoro schedule values from a base time', () => {
  const values = getDefaultPomodoroScheduleValues(new Date('2026-05-14T10:15:00+01:00'))

  assert.deepEqual(values, {
    date: '2026-05-14',
    time: '10:45',
  })
})

test('builds a default focus-session start time five minutes ahead in local-input format', () => {
  const value = getDefaultFocusSessionStartTime(new Date('2026-05-14T10:15:00+01:00'))

  assert.equal(value, '2026-05-14T10:20')
})
