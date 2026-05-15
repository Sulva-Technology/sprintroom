import { describe, it, expect, vi } from 'vitest'
import { getTaskSuggestions } from '@/app/actions/ai-suggestions'

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null })
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [] }),
            not: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [] })
              })
            })
          })
        })
      })
    })
  })
}))

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContent: vi.fn().mockResolvedValue({
        text: JSON.stringify([
          {
            title: "Test AI Task",
            description: "A generated task",
            reason: "You need this",
            is_rhythm: false,
            estimated_pomodoros: 2
          }
        ])
      })
    }
  }))
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
