import test from 'node:test'
import assert from 'node:assert/strict'

import {
  calculateWeeklyRhythmSummary,
  groupWeeklyRhythmTasks,
} from './weekly-rhythm.ts'

test('groups an everyday task into one straight line across the week', () => {
  const grouped = groupWeeklyRhythmTasks([
    { id: 'mon', title: 'wake up 3am', day_of_week: 1 },
    { id: 'tue', title: 'wake up 3am', day_of_week: 2 },
    { id: 'wed', title: 'wake up 3am', day_of_week: 3 },
    { id: 'thu', title: 'wake up 3am', day_of_week: 4 },
    { id: 'fri', title: 'wake up 3am', day_of_week: 5 },
    { id: 'sat', title: 'wake up 3am', day_of_week: 6 },
    { id: 'sun', title: 'wake up 3am', day_of_week: 0 },
  ])

  assert.equal(grouped.length, 1)
  assert.deepEqual(grouped[0]?.taskIdsByDay, {
    0: 'sun',
    1: 'mon',
    2: 'tue',
    3: 'wed',
    4: 'thu',
    5: 'fri',
    6: 'sat',
  })
})

test('keeps different task titles on separate rows', () => {
  const grouped = groupWeeklyRhythmTasks([
    { id: '1', title: 'wake up 3am', day_of_week: 1 },
    { id: '2', title: 'journal', day_of_week: 2 },
  ])

  assert.equal(grouped.length, 2)
  assert.equal(grouped[0]?.title, 'wake up 3am')
  assert.equal(grouped[1]?.title, 'journal')
})

test('calculates weekly rhythm completion totals and per-rhythm progress', () => {
  const summary = calculateWeeklyRhythmSummary({
    rhythms: [
      {
        id: 'morning',
        weekly_rhythm_tasks: [
          { id: 'mon', title: 'wake up 3am', day_of_week: 1 },
          { id: 'tue', title: 'wake up 3am', day_of_week: 2 },
        ],
      },
      {
        id: 'review',
        weekly_rhythm_tasks: [
          { id: 'wed', title: 'code review', day_of_week: 3 },
        ],
      },
    ],
    logs: [
      { rhythm_task_id: 'mon', completed_at: '2026-05-11' },
      { rhythm_task_id: 'wed', completed_at: '2026-05-13' },
      { rhythm_task_id: 'other', completed_at: '2026-05-13' },
    ],
    today: '2026-05-13',
  })

  assert.equal(summary.totalScheduled, 3)
  assert.equal(summary.totalCompleted, 2)
  assert.equal(summary.completionRate, 67)
  assert.equal(summary.dueToday, 1)
  assert.equal(summary.completedToday, 1)
  assert.equal(summary.todayCompletionRate, 100)
  assert.deepEqual(summary.byRhythmId, {
    morning: {
      completed: 1,
      completionRate: 50,
      scheduled: 2,
    },
    review: {
      completed: 1,
      completionRate: 100,
      scheduled: 1,
    },
  })
})
