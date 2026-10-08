'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { WorkspaceRole } from '@/app/actions/roles'
import {
  ASSIGNABLE_ROLES,
  canChangeRole,
  canLeaveWorkspace,
  canRemoveMember,
} from '@/lib/team/member-permissions'

type Result = { success: true } | { success: false; error: string }

const memberRef = z.object({ workspaceId: z.string().uuid(), userId: z.string().uuid() })

async function loadMembership(workspaceId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('workspace_members')
    .select('user_id, role')
    .eq('workspace_id', workspaceId)
  const roles = new Map((data ?? []).map((r) => [r.user_id as string, r.role as WorkspaceRole]))
  return { supabase, userId: user.id, roles }
}

export async function updateMemberRole(workspaceId: string, userId: string, role: string): Promise<Result> {
  const parsed = memberRef.extend({ role: z.enum(ASSIGNABLE_ROLES) }).safeParse({ workspaceId, userId, role })
  if (!parsed.success) return { success: false, error: 'Invalid input' }

  const ctx = await loadMembership(workspaceId)
  if (!ctx) return { success: false, error: 'Not authenticated' }
  const target = ctx.roles.get(userId)
  if (!target) return { success: false, error: 'That person is not a member of this workspace' }
  if (!canChangeRole(ctx.roles.get(ctx.userId) ?? null, target, parsed.data.role, userId === ctx.userId)) {
    return { success: false, error: 'You do not have permission to change this role' }
  }

  const { data, error } = await ctx.supabase
    .from('workspace_members')
    .update({ role: parsed.data.role })
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .select('user_id')
  // The trigger raises e.g. "A workspace must keep at least one owner".
  if (error) return { success: false, error: error.message }
  if (!data?.length) return { success: false, error: 'You do not have permission to change this role' }

  revalidatePath('/dashboard/team')
  return { success: true }
}

export async function removeMember(workspaceId: string, userId: string): Promise<Result> {
  const parsed = memberRef.safeParse({ workspaceId, userId })
  if (!parsed.success) return { success: false, error: 'Invalid input' }

  const ctx = await loadMembership(workspaceId)
  if (!ctx) return { success: false, error: 'Not authenticated' }
  const target = ctx.roles.get(userId)
  if (!target) return { success: false, error: 'That person is not a member of this workspace' }
  if (!canRemoveMember(ctx.roles.get(ctx.userId) ?? null, target, userId === ctx.userId)) {
    return { success: false, error: 'You do not have permission to remove this member' }
  }

  const { data, error } = await ctx.supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .select('user_id')
  if (error) return { success: false, error: error.message }
  if (!data?.length) return { success: false, error: 'You do not have permission to remove this member' }

  revalidatePath('/dashboard/team')
  return { success: true }
}

export async function leaveWorkspace(workspaceId: string): Promise<Result> {
  if (!z.string().uuid().safeParse(workspaceId).success) return { success: false, error: 'Invalid input' }

  const ctx = await loadMembership(workspaceId)
  if (!ctx) return { success: false, error: 'Not authenticated' }
  const myRole = ctx.roles.get(ctx.userId)
  if (!myRole) return { success: false, error: 'You are not a member of this workspace' }
  const ownerCount = [...ctx.roles.values()].filter((r) => r === 'owner').length
  if (!canLeaveWorkspace(myRole, ownerCount)) {
    return { success: false, error: 'You are the last owner. Make someone else an owner before leaving.' }
  }

  const { data, error } = await ctx.supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', ctx.userId)
    .select('user_id')
  if (error) return { success: false, error: error.message }
  if (!data?.length) return { success: false, error: 'Could not leave this workspace' }

  // The stale active-workspace cookie is ignored by resolveActiveWorkspaceId(),
  // so every page falls back to the next membership automatically.
  revalidatePath('/dashboard', 'layout')
  return { success: true }
}
