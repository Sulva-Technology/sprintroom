import test from 'node:test'
import assert from 'node:assert/strict'

import { groupWeeklyRhythmTasks } from './weekly-rhythm.ts'

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
