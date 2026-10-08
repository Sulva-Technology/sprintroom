import { describe, expect, it } from 'vitest'
import { canChangeRole, canRemoveMember, canLeaveWorkspace } from '@/lib/team/member-permissions'

describe('canChangeRole', () => {
  it('lets owners change anyone else, including granting owner', () => {
    expect(canChangeRole('owner', 'member', 'owner', false)).toBe(true)
    expect(canChangeRole('owner', 'owner', 'admin', false)).toBe(true)
  })
  it('lets admins manage non-owners but never grant or touch owner', () => {
    expect(canChangeRole('admin', 'member', 'viewer', false)).toBe(true)
    expect(canChangeRole('admin', 'member', 'owner', false)).toBe(false)
    expect(canChangeRole('admin', 'owner', 'member', false)).toBe(false)
  })
  it('never lets members, viewers or non-members change roles', () => {
    expect(canChangeRole('member', 'viewer', 'member', false)).toBe(false)
    expect(canChangeRole('viewer', 'viewer', 'member', false)).toBe(false)
    expect(canChangeRole(null, 'viewer', 'member', false)).toBe(false)
  })
  it('never lets you change your own role (prevents self-lockout)', () => {
    expect(canChangeRole('owner', 'owner', 'member', true)).toBe(false)
  })
})

describe('canRemoveMember', () => {
  it('owners remove anyone else; admins remove non-owners', () => {
    expect(canRemoveMember('owner', 'admin', false)).toBe(true)
    expect(canRemoveMember('admin', 'member', false)).toBe(true)
    expect(canRemoveMember('admin', 'owner', false)).toBe(false)
  })
  it('members cannot remove anyone, and nobody "removes" themselves (use leave)', () => {
    expect(canRemoveMember('member', 'viewer', false)).toBe(false)
    expect(canRemoveMember('owner', 'owner', true)).toBe(false)
  })
})

describe('canLeaveWorkspace', () => {
  it('anyone but the last owner can leave', () => {
    expect(canLeaveWorkspace('member', 1)).toBe(true)
    expect(canLeaveWorkspace('owner', 2)).toBe(true)
    expect(canLeaveWorkspace('owner', 1)).toBe(false)
  })
})
