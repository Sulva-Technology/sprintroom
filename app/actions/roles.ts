'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer'

/**
 * The current user's role in the given workspace (or the active one from the
 * cookie). Returns null when not a member. RLS is the real enforcement — these
 * helpers exist so the UI can hide controls the user can't use, and so server
 * actions can fail with a clear message instead of a silent RLS rejection.
 */
export async function getWorkspaceRole(workspaceId?: string): Promise<WorkspaceRole | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  let wsId = workspaceId
  if (!wsId) {
    const cookieStore = await cookies()
    wsId = cookieStore.get('active_workspace_id')?.value
  }

  if (!wsId) {
    const { data } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()
    return (data?.role as WorkspaceRole) ?? null
  }

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
