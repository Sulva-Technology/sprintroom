import { describe, expect, it, vi, beforeEach } from 'vitest'
import { GET } from '@/app/auth/callback/route'

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      exchangeCodeForSession: mocks.exchangeCodeForSession,
    },
  }),
}))

describe('auth callback', () => {
  beforeEach(() => {
    mocks.exchangeCodeForSession.mockReset()
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null })
  })

  it('redirects to safe relative next paths after exchanging the auth code', async () => {
    const response = await GET(new Request('https://app.example.com/auth/callback?code=abc&next=%2Fdashboard%2Finvites'))

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith('abc')
    expect(response.headers.get('location')).toBe('https://app.example.com/dashboard/invites')
  })

  it('falls back to dashboard for protocol-relative next paths', async () => {
    const response = await GET(new Request('https://app.example.com/auth/callback?code=abc&next=%2F%2Fevil.example.com'))

    expect(response.headers.get('location')).toBe('https://app.example.com/dashboard')
  })
})
