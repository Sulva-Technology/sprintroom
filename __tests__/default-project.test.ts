import { describe, expect, it } from 'vitest'
import { pickDefaultProjectId } from '@/lib/tasks/default-project'

describe('pickDefaultProjectId', () => {
  it('prefers the General project, case-insensitively', () => {
    expect(
      pickDefaultProjectId([
        { id: 'a', name: 'Website', created_at: '2026-01-01' },
        { id: 'g', name: ' general ', created_at: '2026-02-01' },
      ])
    ).toBe('g')
  })

  it('otherwise picks the oldest project', () => {
    expect(
      pickDefaultProjectId([
        { id: 'new', name: 'B', created_at: '2026-05-01' },
        { id: 'old', name: 'A', created_at: '2026-01-01' },
      ])
    ).toBe('old')
  })

  it('returns undefined when there are no projects', () => {
    expect(pickDefaultProjectId([])).toBeUndefined()
  })
})
