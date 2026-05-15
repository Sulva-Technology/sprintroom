import { describe, it, expect, vi } from 'vitest'
import { getWeeklyRhythms } from '@/app/actions/rhythms'

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'rhythm-1',
                title: 'Weekly Review',
                target_days: [1, 5],
                active: true
              }
            ],
            error: null
          })
        })
      })
    })
  })
}))

describe('Weekly Rhythms Action', () => {
  it('should return weekly rhythms for the user', async () => {
    // getWeeklyRhythms expects a workspace ID
    const rhythms = await getWeeklyRhythms('workspace-1')
    
    expect(rhythms).toHaveLength(1)
    expect(rhythms[0].title).toBe('Weekly Review')
  })
})
