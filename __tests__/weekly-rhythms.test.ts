import { describe, it, expect, vi } from 'vitest'
import { getRhythms } from '@/app/actions/rhythm'

const mocks = vi.hoisted(() => {
  const query = {
    eq: vi.fn(() => query),
    order: vi.fn().mockResolvedValue({
      data: [
        {
          id: 'rhythm-1',
          name: 'Weekly Review',
          active: true,
          weekly_rhythm_tasks: [
            { id: 'task-1', title: 'Review wins', day_of_week: 5 },
          ],
        },
      ],
      error: null,
    }),
  }

  return { query }
})

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue(mocks.query)
    })
  })
}))

describe('Weekly Rhythms Action', () => {
  it('should return weekly rhythms for the user', async () => {
    const rhythms = await getRhythms('workspace-1')
    
    expect(rhythms).toHaveLength(1)
    expect(rhythms[0].name).toBe('Weekly Review')
  })
})
