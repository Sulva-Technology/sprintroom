import { describe, expect, it } from 'vitest'
import {
  buildRhythmNudgeMessage,
  getRhythmNudgeSlot,
  localDateKey,
  rhythmNudgeStorageKey,
} from '@/lib/rhythm-nudge'

function at(hour: number, minute = 0) {
  return new Date(2026, 6, 23, hour, minute, 0)
}

describe('getRhythmNudgeSlot', () => {
  it('returns no slot before 06:00', () => {
    expect(getRhythmNudgeSlot(at(5, 59))).toBeNull()
    expect(getRhythmNudgeSlot(at(0))).toBeNull()
  })

  it('fires every hour from 06:00 through 18:00', () => {
    for (let hour = 6; hour <= 18; hour++) {
      expect(getRhythmNudgeSlot(at(hour))).toEqual({ dateKey: '2026-07-23', hour })
    }
  })

  it('keeps the same slot for any minute inside the hour', () => {
    expect(getRhythmNudgeSlot(at(9, 47))?.hour).toBe(9)
  })

  it('stops after 18:00', () => {
    expect(getRhythmNudgeSlot(at(18, 1))).toBeNull()
    expect(getRhythmNudgeSlot(at(19))).toBeNull()
    expect(getRhythmNudgeSlot(at(23, 30))).toBeNull()
  })
})

describe('rhythmNudgeStorageKey', () => {
  it('is unique per day and hour so each slot fires once', () => {
    const nine = rhythmNudgeStorageKey({ dateKey: '2026-07-23', hour: 9 })
    const ten = rhythmNudgeStorageKey({ dateKey: '2026-07-23', hour: 10 })
    const nextDay = rhythmNudgeStorageKey({ dateKey: '2026-07-24', hour: 9 })

    expect(nine).toBe('sprintroom-rhythm-nudge-2026-07-23-09')
    expect(new Set([nine, ten, nextDay]).size).toBe(3)
  })
})

describe('localDateKey', () => {
  it('uses local calendar date, not UTC', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05')
  })
})

describe('buildRhythmNudgeMessage', () => {
  it('singularises a single open task', () => {
    const message = buildRhythmNudgeMessage([{ id: '1', title: 'Standup' }])
    expect(message.title).toBe('1 rhythm task still open')
    expect(message.body).toContain('Standup')
  })

  it('caps the listed titles at three', () => {
    const message = buildRhythmNudgeMessage([
      { id: '1', title: 'A' },
      { id: '2', title: 'B' },
      { id: '3', title: 'C' },
      { id: '4', title: 'D' },
      { id: '5', title: 'E' },
    ])
    expect(message.title).toBe('5 rhythm tasks still open')
    expect(message.body).toBe('Clear them before the day ends: A, B, C +2 more')
  })
})
