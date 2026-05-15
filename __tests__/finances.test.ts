import { describe, it, expect, vi } from 'vitest'
import { getFinancialMetrics } from '@/app/actions/finances'

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [
            { type: 'income', amount: 1000, project_id: 'p1', entry_date: '2024-01-01' },
            { type: 'expense', amount: 300, project_id: 'p1', entry_date: '2024-01-02' },
            { type: 'expense', amount: 200, project_id: 'p2', entry_date: '2024-01-03' },
          ],
          error: null
        })
      })
    })
  })
}))

describe('Financial Actions', () => {
  it('should calculate correct metrics from financial entries', async () => {
    const metrics = await getFinancialMetrics('workspace-1')
    
    expect(metrics).not.toBeNull()
    expect(metrics?.totalIncome).toBe(1000)
    expect(metrics?.totalExpense).toBe(500)
    expect(metrics?.netBalance).toBe(500)
    expect(metrics?.byProject['p1']).toBe(300)
    expect(metrics?.byProject['p2']).toBe(200)
  })
})
