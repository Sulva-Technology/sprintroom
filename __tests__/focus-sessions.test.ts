import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getActiveFocusSession } from '@/app/actions/focus'

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'session-1',
                    task_id: 'task-1',
                    status: 'active',
                    duration_minutes: 25,
                    started_at: new Date().toISOString()
                  },
                  error: null
                })
              })
            })
          })
        })
      })
    })
  })
}))

describe('Focus Sessions Action', () => {
  it('should return the active focus session for the user', async () => {
    const session = await getActiveFocusSession()
    expect(session).toBeDefined()
    expect(session.id).toBe('session-1')
    expect(session.status).toBe('active')
  })
})
