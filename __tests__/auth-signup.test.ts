import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { signup } from '@/app/actions/auth'

const mocks = vi.hoisted(() => ({
  signUpError: null as { message: string; status?: number; code?: string } | null,
  signUpData: { user: null, session: null } as Record<string, unknown>,
  revalidatePath: vi.fn(),
  origin: 'https://app.example.com',
  fetch: vi.fn(),
  generateLink: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`)
  }),
}))

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: (name: string) => (name === 'origin' ? mocks.origin : null),
  }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      signUp: vi.fn().mockImplementation(() => Promise.resolve({
        data: mocks.signUpData,
        error: mocks.signUpError,
      })),
    },
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    auth: {
      admin: {
        generateLink: mocks.generateLink,
      },
    },
  })),
}))

describe('auth signup action', () => {
  const originalResendApiKey = process.env.RESEND_API_KEY
  const originalAuthEmailFrom = process.env.AUTH_EMAIL_FROM
  const originalInviteEmailFrom = process.env.INVITE_EMAIL_FROM

  beforeEach(() => {
    mocks.signUpError = null
    mocks.signUpData = { user: null, session: null }
    mocks.origin = 'https://app.example.com'
    mocks.revalidatePath.mockClear()
    mocks.fetch.mockClear()
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'email-1' }),
      text: async () => '',
    })
    mocks.generateLink.mockReset()
    mocks.generateLink.mockResolvedValue({
      data: {
        properties: {
          action_link: 'https://supabase.example.com/auth/v1/verify?token=abc',
        },
      },
      error: null,
    })
    vi.stubGlobal('fetch', mocks.fetch)

    process.env.RESEND_API_KEY = 're_test_key'
    process.env.AUTH_EMAIL_FROM = 'SprintRoom <auth@example.com>'
    process.env.INVITE_EMAIL_FROM = 'SprintRoom <invites@example.com>'
  })

  it('falls back to Resend when Supabase cannot send the confirmation email', async () => {
    mocks.signUpError = {
      message: 'Error sending confirmation email',
      status: 500,
      code: 'unexpected_failure',
    }

    const formData = new FormData()
    formData.set('email', 'NewUser@Example.com')
    formData.set('password', 'password-123')
    formData.set('full_name', 'New User')
    formData.set('next', '/dashboard/invites')

    const result = await signup(formData)

    expect(result).toEqual({ success: true })
    expect(mocks.generateLink).toHaveBeenCalledWith({
      type: 'signup',
      email: 'newuser@example.com',
      password: 'password-123',
      options: {
        data: {
          full_name: 'New User',
        },
        redirectTo: 'https://app.example.com/auth/callback?next=%2Fdashboard%2Finvites',
      },
    })
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
    const resendPayload = JSON.parse(mocks.fetch.mock.calls[0][1].body)
    expect(resendPayload.from).toBe('SprintRoom <auth@example.com>')
    expect(resendPayload.to).toBe('newuser@example.com')
    expect(resendPayload.html).toContain('https://supabase.example.com/auth/v1/verify?token=abc')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })

  it('falls back to Resend when Supabase returns an unstructured confirmation email error', async () => {
    mocks.signUpError = {
      message: 'Error sending confirmation email',
    }

    const formData = new FormData()
    formData.set('email', 'NewUser@Example.com')
    formData.set('password', 'password-123')
    formData.set('full_name', 'New User')

    const result = await signup(formData)

    expect(result).toEqual({ success: true })
    expect(mocks.generateLink).toHaveBeenCalledWith(expect.objectContaining({
      type: 'signup',
      email: 'newuser@example.com',
      password: 'password-123',
    }))
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })

  afterEach(() => {
    vi.unstubAllGlobals()

    if (originalResendApiKey === undefined) {
      delete process.env.RESEND_API_KEY
    } else {
      process.env.RESEND_API_KEY = originalResendApiKey
    }

    if (originalAuthEmailFrom === undefined) {
      delete process.env.AUTH_EMAIL_FROM
    } else {
      process.env.AUTH_EMAIL_FROM = originalAuthEmailFrom
    }

    if (originalInviteEmailFrom === undefined) {
      delete process.env.INVITE_EMAIL_FROM
    } else {
      process.env.INVITE_EMAIL_FROM = originalInviteEmailFrom
    }
  })
})
