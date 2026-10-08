import { describe, expect, it } from 'vitest'
import { canEditProject, canDeleteProject } from '@/lib/projects/permissions'

describe('project permissions (mirror of projects RLS)', () => {
  it('admins and owners can edit any project', () => {
    expect(canEditProject('admin', 'someone-else', 'me')).toBe(true)
    expect(canEditProject('owner', null, 'me')).toBe(true)
  })
  it('the creator can edit their own project', () => {
    expect(canEditProject('member', 'me', 'me')).toBe(true)
  })
  it('other members and viewers cannot edit', () => {
    expect(canEditProject('member', 'someone-else', 'me')).toBe(false)
    expect(canEditProject('viewer', 'someone-else', 'me')).toBe(false)
  })
  it('only admins and owners can delete', () => {
    expect(canDeleteProject('owner')).toBe(true)
    expect(canDeleteProject('admin')).toBe(true)
    expect(canDeleteProject('member')).toBe(false)
    expect(canDeleteProject(null)).toBe(false)
  })
})
