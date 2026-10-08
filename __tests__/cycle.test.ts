import { describe, expect, it } from 'vitest'
import { addDaysToKey, daysBetweenKeys } from '@/lib/dates'
import { currentCycle, newCycleDates, cycleDaysLeft, cycleProgress, cycleName } from '@/lib/cycles/cycle'

describe('date keys', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDaysToKey('2026-10-08', 6)).toBe('2026-10-14')
    expect(addDaysToKey('2026-10-30', 3)).toBe('2026-11-02')
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysToKey('2026-10-08', -8)).toBe('2026-09-30')
  })
  it('counts whole days between keys', () => {
    expect(daysBetweenKeys('2026-10-08', '2026-10-14')).toBe(6)
    expect(daysBetweenKeys('2026-10-14', '2026-10-08')).toBe(-6)
  })
})

describe('cycles', () => {
  const running = { id: 'run', starts_on: '2026-10-05', ends_on: '2026-10-11', completed_at: null }
  const future = { id: 'next', starts_on: '2026-10-12', ends_on: '2026-10-18', completed_at: null }
  const finished = { id: 'old', starts_on: '2026-09-28', ends_on: '2026-10-04', completed_at: '2026-10-05T00:05:00Z' }

  it('finds the running cycle and ignores finished or future ones', () => {
    expect(currentCycle([finished, future, running], '2026-10-08')?.id).toBe('run')
    expect(currentCycle([finished, future], '2026-10-08')).toBeUndefined()
  })

  it('plans 1- and 2-week cycles starting today, inclusive of the last day', () => {
    expect(newCycleDates('2026-10-08', 1)).toEqual({ starts_on: '2026-10-08', ends_on: '2026-10-14' })
    expect(newCycleDates('2026-10-08', 2)).toEqual({ starts_on: '2026-10-08', ends_on: '2026-10-21' })
  })

  it('counts days left including today, never negative', () => {
    expect(cycleDaysLeft({ ends_on: '2026-10-14' }, '2026-10-08')).toBe(7)
    expect(cycleDaysLeft({ ends_on: '2026-10-08' }, '2026-10-08')).toBe(1)
    expect(cycleDaysLeft({ ends_on: '2026-10-01' }, '2026-10-08')).toBe(0)
  })

  it('scores a cycle', () => {
    expect(
      cycleProgress([
        { status: 'done', carry_over_count: 0 },
        { status: 'doing', carry_over_count: 1 },
        { status: 'blocked', carry_over_count: 0 },
        { status: 'backlog', carry_over_count: 2 },
      ])
    ).toEqual({ total: 4, done: 1, inProgress: 2, notStarted: 1, carriedOver: 2, percent: 25 })
    expect(cycleProgress([]).percent).toBe(0)
  })

  it('names a cycle after its start date', () => {
    expect(cycleName('2026-10-08')).toBe('Cycle · Oct 8')
  })
})
