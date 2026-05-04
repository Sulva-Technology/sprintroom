'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function inviteMember(workspaceId: string, email: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // 1. Check if already a member
  const { data: existingMember } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (existingMember) {
     const { data: membership } = await supabase
       .from('workspace_members')
       .select('id')
       .eq('workspace_id', workspaceId)
       .eq('user_id', existingMember.id)
       .single()

     if (membership) {
       return { success: false, error: 'User is already a member of this workspace.' }
     }
  }

  // 2. Create Invite
  const { error } = await supabase
    .from('workspace_invites')
    .insert({
      workspace_id: workspaceId,
      email: email.toLowerCase(),
      inviter_id: user.id,
      status: 'pending'
    })

  if (error) {
    if (error.code === '23505') { // Unique constraint
      return { success: false, error: 'An invite for this email already exists in this workspace.' }
    }
    console.error("Error creating invite:", error)
    return { success: false, error: error.message }
  }

  // Record activity
  await supabase.from('task_activity').insert({
    workspace_id: workspaceId,
    user_id: user.id,
    type: 'member_invited',
    body: `Invited ${email} to the workspace`
  })

  revalidatePath('/dashboard/team')
  return { success: true }
}
