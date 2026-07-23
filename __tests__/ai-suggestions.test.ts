import { describe, it, expect, vi } from 'vitest'
import { getTaskSuggestions } from '@/app/actions/ai-suggestions'

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null })
    },
    from: vi.fn().mockImplementation(() => {
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        not: vi.fn(() => query),
        order: vi.fn(() => query),
        limit: vi.fn().mockResolvedValue({ data: [] }),
      }
      return query
    })
  })
}))

vi.mock('@google/generative-ai', () => ({
  // Vitest 4 requires constructor mocks to be actual functions/classes.
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return {
        generateContent: async () => ({
          response: {
            text: () =>
              JSON.stringify([
                {
                  title: 'Test AI Task',
                  description: 'A generated task',
                  reason: 'You need this',
                  is_rhythm: false,
                  estimated_pomodoros: 2,
                },
              ]),
          },
        }),
      }
    }
  },
}))

describe('AI Suggestions', () => {
  it('should generate valid suggestions when authenticated', async () => {
    // Set a dummy env var so it doesn't fail
    process.env.GEMINI_API_KEY = 'test_key'
    
    const result = await getTaskSuggestions()
    
    expect(result.success).toBe(true)
    expect(result.suggestions).toHaveLength(1)
    expect(result.suggestions[0].title).toBe('Test AI Task')
  })
})
