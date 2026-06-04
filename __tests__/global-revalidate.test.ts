import { beforeEach, describe, expect, it, vi } from 'vitest'
import { revalidatePath } from 'next/cache'
import { globalRevalidate } from '@/app/actions/revalidate'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: mocks.getUser,
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: mocks.maybeSingle,
            }),
          }),
        }),
      }),
    }),
  }),
}))

describe('globalRevalidate', () => {
  beforeEach(() => {
    vi.mocked(revalidatePath).mockClear()
    mocks.getUser.mockReset()
    mocks.maybeSingle.mockReset()
  })

  it('does not revalidate for unauthenticated users', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })

    await expect(globalRevalidate()).resolves.toEqual({ success: false, error: 'Not authenticated' })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('only revalidates for workspace owners or admins', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mocks.maybeSingle.mockResolvedValue({ data: { id: 'member-1' }, error: null })

    await expect(globalRevalidate()).resolves.toEqual({ success: true })
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard', 'layout')
  })
})
