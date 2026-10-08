import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({}) }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))

import { getSafeRedirectPath } from '@/lib/auth/redirect'
import { ACTIVE_WORKSPACE_COOKIE_OPTIONS } from '@/lib/workspace/active-workspace'

describe('getSafeRedirectPath', () => {
  it('allows same-site paths', () => {
    expect(getSafeRedirectPath('/dashboard/team')).toBe('/dashboard/team')
    expect(getSafeRedirectPath('/invite/abc?x=1')).toBe('/invite/abc?x=1')
  })

  it('rejects protocol-relative and absolute URLs', () => {
    expect(getSafeRedirectPath('//evil.com')).toBe('/dashboard')
    expect(getSafeRedirectPath('https://evil.com')).toBe('/dashboard')
  })

  it('rejects backslash tricks that browsers normalise to //', () => {
    expect(getSafeRedirectPath('/\\evil.com')).toBe('/dashboard')
    expect(getSafeRedirectPath('/\\/evil.com')).toBe('/dashboard')
  })

  it('rejects control characters', () => {
    expect(getSafeRedirectPath('/\tevil')).toBe('/dashboard')
    expect(getSafeRedirectPath('/\nevil')).toBe('/dashboard')
  })
})

describe('active workspace cookie options', () => {
  it('is httpOnly, lax and site-wide', () => {
    expect(ACTIVE_WORKSPACE_COOKIE_OPTIONS).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' })
  })
})
