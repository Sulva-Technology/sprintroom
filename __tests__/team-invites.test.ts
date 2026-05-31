import { beforeEach, describe, expect, it, vi } from 'vitest'
import { inviteMember } from '@/app/actions/team'

const mocks = vi.hoisted(() => ({
  insertedInvite: null as Record<string, unknown> | null,
  revalidatePath: vi.fn(),
  otpError: null as { message: string } | null,
  lastOtpArgs: null as Record<string, unknown> | null,
  origin: 'https://app.example.com',
  fetch: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: (name: string) => (name === 'origin' ? mocks.origin : null),
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
      signInWithOtp: vi.fn().mockImplementation((args) => {
        mocks.lastOtpArgs = args
        return Promise.resolve({ error: mocks.otpError })
      }),
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

      if (table === 'workspaces') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { name: 'Engineering' }, error: null }),
            }),
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
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL
  const originalResendApiKey = process.env.RESEND_API_KEY
  const originalInviteEmailFrom = process.env.INVITE_EMAIL_FROM

  beforeEach(() => {
    mocks.insertedInvite = null
    mocks.otpError = null
    mocks.lastOtpArgs = null
    mocks.origin = 'https://app.example.com'
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'email-1' }),
      text: async () => '',
    })
    vi.stubGlobal('fetch', mocks.fetch)
    mocks.revalidatePath.mockClear()

    if (originalSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl
    }

    process.env.RESEND_API_KEY = 're_test_key'
    process.env.INVITE_EMAIL_FROM = 'SprintRoom <invites@example.com>'
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

  it('sends invite emails through Resend without creating Supabase auth users', async () => {
    const result = await inviteMember(
      '00000000-0000-4000-8000-000000000001',
      'COLLEAGUE@example.com',
    )

    expect(result).toMatchObject({
      success: true,
      emailSent: true,
    })
    expect(mocks.lastOtpArgs).toBeNull()
    expect(mocks.fetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer re_test_key',
          'Content-Type': 'application/json',
        }),
      }),
    )
  })

  it('returns a Resend configuration message when no email provider is configured', async () => {
    delete process.env.RESEND_API_KEY
    delete process.env.INVITE_EMAIL_FROM

    const result = await inviteMember(
      '00000000-0000-4000-8000-000000000001',
      'COLLEAGUE@example.com',
    )

    expect(result).toMatchObject({
      success: true,
      emailSent: false,
      emailError: 'Resend is not configured. Add RESEND_API_KEY and INVITE_EMAIL_FROM to send invite emails.',
    })
    expect(mocks.lastOtpArgs).toBeNull()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('uses the configured site URL for invite email links', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://configured.example.com/'
    mocks.origin = 'http://localhost:3001'

    await inviteMember(
      '00000000-0000-4000-8000-000000000001',
      'COLLEAGUE@example.com',
    )

    const resendPayload = JSON.parse(mocks.fetch.mock.calls[0][1].body)
    expect(resendPayload.html).toContain('https://configured.example.com/dashboard/invites')
    expect(resendPayload.text).toContain('https://configured.example.com/dashboard/invites')
  })

  afterEach(() => {
    vi.unstubAllGlobals()

    if (originalResendApiKey === undefined) {
      delete process.env.RESEND_API_KEY
    } else {
      process.env.RESEND_API_KEY = originalResendApiKey
    }

    if (originalInviteEmailFrom === undefined) {
      delete process.env.INVITE_EMAIL_FROM
    } else {
      process.env.INVITE_EMAIL_FROM = originalInviteEmailFrom
    }
  })
})
