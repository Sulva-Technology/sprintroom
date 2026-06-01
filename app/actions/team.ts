'use server'

import { createClient } from '@/lib/supabase/server'
import { sendWorkspaceInviteEmail } from '@/lib/email/resend'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'

const inviteMemberSchema = z.object({
  workspaceId: z.string().uuid(),
  email: z.string().email()
})

function getEmailRedirectBaseUrl(requestOrigin: string) {
  return (process.env.NEXT_PUBLIC_SITE_URL || requestOrigin).replace(/\/+$/, '')
}

function buildInviteUrl(requestOrigin: string, token: string) {
  return new URL(`/invite/${encodeURIComponent(token)}`, getEmailRedirectBaseUrl(requestOrigin)).toString()
}

export async function inviteMember(workspaceId: string, email: string) {
  const validated = inviteMemberSchema.safeParse({ workspaceId, email })
  if (!validated.success) {
    return { success: false, error: { message: 'Invalid input', details: validated.error.format() } }
  }

  const supabase = await createClient()
  const requestHeaders = await headers()
  const origin = requestHeaders.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const normalizedEmail = validated.data.email.toLowerCase()
  const inviteToken = crypto.randomUUID()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: { message: 'Not authenticated' } }

  const { data: inviterMembership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', validated.data.workspaceId)
    .eq('user_id', user.id)
    .single()

  if (!inviterMembership || !['admin', 'owner'].includes(inviterMembership.role)) {
    return { success: false, error: { message: 'Only workspace admins can invite members.' } }
  }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name')
    .eq('id', validated.data.workspaceId)
    .single()

  // 1. Check if already a member
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', normalizedEmail)
    .limit(1)

  const existingMember = profiles && profiles.length > 0 ? profiles[0] : null

  if (existingMember) {
     const { data: memberships } = await supabase
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', validated.data.workspaceId)
        .eq('user_id', existingMember.id)
        .limit(1)

     const membership = memberships && memberships.length > 0 ? memberships[0] : null

     if (membership) {
       return { success: false, error: { message: 'User is already a member of this workspace.' } }
     }
  }

  // 2. Create Invite
  const { error } = await supabase
    .from('workspace_invites')
    .insert({
      workspace_id: validated.data.workspaceId,
      email: normalizedEmail,
      inviter_id: user.id,
      created_by: user.id,
      token: inviteToken,
    })

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: { message: 'An invite for this email already exists in this workspace.' } }
    }

    console.error("Error creating invite:", error)
    return {
      success: false,
      error: {
        message: 'Database error',
        details: error.message,
      },
    }
  }

  const inviteUrl = buildInviteUrl(origin, inviteToken)
  const emailResult = await sendWorkspaceInviteEmail({
    to: normalizedEmail,
    inviteUrl,
    workspaceName: workspace?.name,
  })
  const emailSent = emailResult.sent
  const emailError = emailResult.error

  // Record activity (wrap in try/catch so invite still succeeds even if log fails)
  try {
    // Attempt to find a project in this workspace to satisfy any hidden constraints/RLS
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('workspace_id', validated.data.workspaceId)
      .limit(1)
      .single()

    await supabase.from('task_activity').insert({
      workspace_id: validated.data.workspaceId,
      project_id: project?.id || null,
      user_id: user.id,
      type: 'member_invited',
      body: `Invited ${normalizedEmail}`
    })
  } catch (logError) {
    console.warn("Failed to log activity, but invite was created:", logError)
  }

  revalidatePath('/dashboard/team', 'layout')
  return { success: true, emailSent, emailError, inviteUrl }
}
