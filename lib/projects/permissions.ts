import type { WorkspaceRole } from '@/app/actions/roles'

const isAdmin = (role: WorkspaceRole | null) => role === 'owner' || role === 'admin'

/** Mirrors "Projects updatable by admins or creator". */
export function canEditProject(role: WorkspaceRole | null, createdBy: string | null, userId: string): boolean {
  return isAdmin(role) || (createdBy !== null && createdBy === userId)
}

/** Mirrors "Projects deletable by admins/owners". */
export function canDeleteProject(role: WorkspaceRole | null): boolean {
  return isAdmin(role)
}
