import { describe, it, expect } from 'vitest'
import { pickActiveWorkspaceId } from '@/lib/workspace/active-workspace'

const A = '11111111-1111-1111-1111-111111111111'
const B = '22222222-2222-2222-2222-222222222222'
const C = '33333333-3333-3333-3333-333333333333'

describe('pickActiveWorkspaceId', () => {
  it('honours the cookie when it names a real membership', () => {
    expect(pickActiveWorkspaceId(B, [A, B, C])).toBe(B)
  })

  it('falls back to the first (stably-ordered) membership when the cookie is unset', () => {
    expect(pickActiveWorkspaceId(undefined, [A, B, C])).toBe(A)
    expect(pickActiveWorkspaceId(null, [A, B, C])).toBe(A)
    expect(pickActiveWorkspaceId('', [A, B, C])).toBe(A)
  })

  it('ignores a stale cookie for a workspace the user is not a member of', () => {
    // The old bug: a stale/foreign cookie scoped the UI to a workspace with no
    // visible data. It must be dropped in favour of a real membership.
    expect(pickActiveWorkspaceId(C, [A, B])).toBe(A)
  })

  it('returns undefined when the user has no memberships', () => {
    expect(pickActiveWorkspaceId(undefined, [])).toBeUndefined()
    expect(pickActiveWorkspaceId(A, [])).toBeUndefined()
  })

  it('is deterministic: the same inputs always pick the same workspace', () => {
    const ids = [A, B, C]
    const first = pickActiveWorkspaceId(undefined, ids)
    for (let i = 0; i < 5; i++) {
      expect(pickActiveWorkspaceId(undefined, ids)).toBe(first)
    }
  })
})
