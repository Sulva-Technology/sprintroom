import type { WorkspaceRole } from '@/app/actions/roles'

/**
 * UI/UX mirror of the DB rules (workspace_members RLS + the
 * enforce_workspace_role_rules trigger). RLS stays the real enforcement; these
 * decide which controls to show and give clear errors before a round-trip.
 */
export const ASSIGNABLE_ROLES = ['owner', 'admin', 'member', 'viewer'] as const

export function canChangeRole(
  actor: WorkspaceRole | null,
  target: WorkspaceRole,
  next: WorkspaceRole,
  isSelf: boolean
): boolean {
  if (isSelf) return false
  if (actor === 'owner') return true
  if (actor === 'admin') return target !== 'owner' && next !== 'owner'
  return false
}

export function canRemoveMember(actor: WorkspaceRole | null, target: WorkspaceRole, isSelf: boolean): boolean {
  if (isSelf) return false
  if (actor === 'owner') return true
  if (actor === 'admin') return target !== 'owner'
  return false
}

export function canLeaveWorkspace(role: WorkspaceRole, ownerCount: number): boolean {
  return role !== 'owner' || ownerCount > 1
}
