import { describe, expect, it } from 'vitest'

import {
  calculateWeeklyRhythmSummary,
  groupWeeklyRhythmTasks,
} from './weekly-rhythm'

describe('weekly rhythm utilities', () => {
  it('groups an everyday task into one straight line across the week', () => {
    const grouped = groupWeeklyRhythmTasks([
      { id: 'mon', title: 'wake up 3am', day_of_week: 1 },
      { id: 'tue', title: 'wake up 3am', day_of_week: 2 },
      { id: 'wed', title: 'wake up 3am', day_of_week: 3 },
      { id: 'thu', title: 'wake up 3am', day_of_week: 4 },
      { id: 'fri', title: 'wake up 3am', day_of_week: 5 },
      { id: 'sat', title: 'wake up 3am', day_of_week: 6 },
      { id: 'sun', title: 'wake up 3am', day_of_week: 0 },
    ])

    expect(grouped).toHaveLength(1)
    expect(grouped[0]?.taskIdsByDay).toEqual({
      0: 'sun',
      1: 'mon',
      2: 'tue',
      3: 'wed',
      4: 'thu',
      5: 'fri',
      6: 'sat',
    })
  })

  it('keeps different task titles on separate rows', () => {
    const grouped = groupWeeklyRhythmTasks([
      { id: '1', title: 'wake up 3am', day_of_week: 1 },
      { id: '2', title: 'journal', day_of_week: 2 },
    ])

    expect(grouped).toHaveLength(2)
    expect(grouped[0]?.title).toBe('wake up 3am')
    expect(grouped[1]?.title).toBe('journal')
  })

  it('calculates weekly rhythm completion totals and per-rhythm progress', () => {
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

    expect(summary.totalScheduled).toBe(3)
    expect(summary.totalCompleted).toBe(2)
    expect(summary.completionRate).toBe(67)
    expect(summary.dueToday).toBe(1)
    expect(summary.completedToday).toBe(1)
    expect(summary.todayCompletionRate).toBe(100)
    expect(summary.byRhythmId).toEqual({
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
})
