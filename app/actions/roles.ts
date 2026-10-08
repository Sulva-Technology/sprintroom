'use server'

import { createClient } from '@/lib/supabase/server'
import { resolveActiveWorkspaceId } from '@/lib/workspace/active-workspace'

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer'

/**
 * The current user's role in the given workspace (or the active one, resolved
 * through the shared cookie-then-stable-order resolver). Returns null when not a
 * member. RLS is the real enforcement — these helpers exist so the UI can hide
 * controls the user can't use, and so server actions can fail with a clear
 * message instead of a silent RLS rejection.
 */
export async function getWorkspaceRole(workspaceId?: string): Promise<WorkspaceRole | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const wsId = workspaceId ?? (await resolveActiveWorkspaceId())
  if (!wsId) return null

  const { data } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('workspace_id', wsId)
    .maybeSingle()

  return (data?.role as WorkspaceRole) ?? null
}

/** Can write content (not a viewer). */
export async function canEditWorkspace(workspaceId?: string) {
  const role = await getWorkspaceRole(workspaceId)
  return role === 'owner' || role === 'admin' || role === 'member'
}

/** Can manage members, invites, projects. */
export async function isWorkspaceAdmin(workspaceId?: string) {
  const role = await getWorkspaceRole(workspaceId)
  return role === 'owner' || role === 'admin'
}
