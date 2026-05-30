import { beforeEach, describe, expect, it, vi } from 'vitest'
import { inviteMember } from '@/app/actions/team'

const mocks = vi.hoisted(() => ({
  insertedInvite: null as Record<string, unknown> | null,
  revalidatePath: vi.fn(),
  otpError: null as { message: string } | null,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: (name: string) => (name === 'origin' ? 'https://app.example.com' : null),
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => null),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
      }),
      signInWithOtp: vi.fn().mockImplementation(() => Promise.resolve({ error: mocks.otpError })),
    },
    from: vi.fn((table: string) => {
      if (table === 'workspace_members') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { role: 'owner' }, error: null }),
              }),
            }),
          }),
        }
      }

      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }
      }

      if (table === 'workspace_invites') {
        return {
          insert: vi.fn().mockImplementation((payload) => {
            mocks.insertedInvite = payload
            return Promise.resolve({ error: null })
          }),
        }
      }

      if (table === 'projects') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        }
      }

      return {
        insert: vi.fn().mockResolvedValue({ error: null }),
      }
    }),
  }),
}))

describe('team invite actions', () => {
  beforeEach(() => {
    mocks.insertedInvite = null
    mocks.otpError = null
    mocks.revalidatePath.mockClear()
  })

  it('records the authenticated user as the invite creator', async () => {
    const result = await inviteMember(
      '00000000-0000-4000-8000-000000000001',
      'COLLEAGUE@example.com',
    )

    expect(result.success).toBe(true)
    expect(mocks.insertedInvite).toMatchObject({
      workspace_id: '00000000-0000-4000-8000-000000000001',
      email: 'colleague@example.com',
      inviter_id: 'user-1',
      created_by: 'user-1',
    })
  })

  it('returns a useful recovery message when Supabase cannot send the email', async () => {
    mocks.otpError = { message: 'Error sending magic link email' }

    const result = await inviteMember(
      '00000000-0000-4000-8000-000000000001',
      'COLLEAGUE@example.com',
    )

    expect(result).toMatchObject({
      success: true,
      emailSent: false,
      emailError:
        'Supabase could not send the invite email. The invite is saved, so ask colleague@example.com to sign in and open Invites. Supabase said: Error sending magic link email',
    })
  })
})
