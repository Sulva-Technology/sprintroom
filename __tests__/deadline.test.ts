import { describe, expect, it } from 'vitest'
import { toDeadlineIso, dateInputFromDeadline } from '@/lib/tasks/deadline'

describe('toDeadlineIso', () => {
  it('stores a date-input value at noon UTC so it never shifts a day in any timezone', () => {
    expect(toDeadlineIso('2026-10-08')).toBe('2026-10-08T12:00:00.000Z')
  })
  it('clears the deadline for an empty value', () => {
    expect(toDeadlineIso('')).toBeNull()
  })
  it('passes through a full ISO timestamp', () => {
    expect(toDeadlineIso('2026-10-08T09:30:00.000Z')).toBe('2026-10-08T09:30:00.000Z')
  })
  it('rejects garbage', () => {
    expect(() => toDeadlineIso('next tuesday')).toThrow('Invalid date')
  })
})

describe('dateInputFromDeadline', () => {
  it('returns the calendar date part for an <input type=date>', () => {
    expect(dateInputFromDeadline('2026-10-08T12:00:00+00:00')).toBe('2026-10-08')
    expect(dateInputFromDeadline(null)).toBe('')
  })
})
