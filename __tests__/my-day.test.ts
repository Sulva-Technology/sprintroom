import { describe, expect, it } from 'vitest'
import { groupMyDay, isMyTask, dateKeyInTimeZone, type MyDayTask } from '@/lib/tasks/my-day'

const ME = 'me'
const OTHER = 'other'

function task(over: Partial<MyDayTask>): MyDayTask {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    title: 't',
    status: 'backlog',
    priority: 'medium',
    deadline: null,
    project_id: 'p1',
    project_name: 'General',
    owner_id: ME,
    created_by: ME,
    ...over,
  }
}

describe('isMyTask', () => {
  it('is mine when assigned to me', () => {
    expect(isMyTask({ owner_id: ME, created_by: OTHER }, ME)).toBe(true)
  })
  it('is mine when I created it and nobody owns it', () => {
    expect(isMyTask({ owner_id: null, created_by: ME }, ME)).toBe(true)
  })
  it('is not mine when someone else owns it, even if I created it', () => {
    expect(isMyTask({ owner_id: OTHER, created_by: ME }, ME)).toBe(false)
  })
})

describe('groupMyDay', () => {
  const today = '2026-10-08'

  it('puts past-due open tasks in overdue, oldest first', () => {
    const a = task({ id: 'a', deadline: '2026-10-06T12:00:00+00:00' })
    const b = task({ id: 'b', deadline: '2026-10-01T12:00:00+00:00' })
    expect(groupMyDay([a, b], ME, today).overdue.map((t) => t.id)).toEqual(['b', 'a'])
  })

  it('puts active statuses and due-today tasks in today, doing first then by priority', () => {
    const due = task({ id: 'due', deadline: '2026-10-08T12:00:00+00:00', priority: 'low' })
    const doing = task({ id: 'doing', status: 'doing', priority: 'low' })
    const urgent = task({ id: 'urgent', status: 'today', priority: 'urgent' })
    const blocked = task({ id: 'blocked', status: 'blocked', priority: 'medium' })
    expect(groupMyDay([due, urgent, blocked, doing], ME, today).today.map((t) => t.id)).toEqual([
      'doing',
      'urgent',
      'blocked',
      'due',
    ])
  })

  it('puts the rest in up next, dated before undated', () => {
    const later = task({ id: 'later', deadline: '2026-10-20T12:00:00+00:00' })
    const soon = task({ id: 'soon', deadline: '2026-10-10T12:00:00+00:00' })
    const undated = task({ id: 'undated', priority: 'high' })
    expect(groupMyDay([undated, later, soon], ME, today).upNext.map((t) => t.id)).toEqual([
      'soon',
      'later',
      'undated',
    ])
  })

  it('drops done tasks and tasks that are not mine', () => {
    const done = task({ status: 'done' })
    const theirs = task({ owner_id: OTHER, created_by: OTHER })
    const g = groupMyDay([done, theirs], ME, today)
    expect(g.overdue.length + g.today.length + g.upNext.length).toBe(0)
  })
})

describe('dateKeyInTimeZone', () => {
  it('formats the calendar date in the given zone', () => {
    const instant = new Date('2026-10-08T02:30:00Z')
    expect(dateKeyInTimeZone(instant, 'UTC')).toBe('2026-10-08')
    expect(dateKeyInTimeZone(instant, 'America/New_York')).toBe('2026-10-07')
  })

  it('falls back to UTC for a missing or unknown zone', () => {
    const instant = new Date('2026-10-08T02:30:00Z')
    expect(dateKeyInTimeZone(instant, null)).toBe('2026-10-08')
    expect(dateKeyInTimeZone(instant, 'Not/AZone')).toBe('2026-10-08')
  })
})
