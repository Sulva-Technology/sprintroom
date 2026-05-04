'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function inviteTeamMember(workspaceId: string, email: string, role: 'member' | 'owner' = 'member') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: { message: 'Not authenticated.' } }
  }

  // 1. Verify inviting user is an owner of the workspace
  const { data: ownerMembership, error: ownerError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (ownerError || ownerMembership?.role !== 'owner') {
    console.error('Unauthorized: User not an owner of this workspace', ownerError);
    return { success: false, error: { message: 'Unauthorized to invite members to this workspace.' } }
  }

  // 2. Find the invited user by email
  const { data: invitedProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (profileError || !invitedProfile) {
    console.error('Invited user not found or error fetching profile', profileError);
    // For now, we only support inviting existing users.
    // In a real app, this would trigger an email invitation flow for new users.
    return { success: false, error: { message: 'Invited user not found in the system.' } }
  }

  const invitedUserId = invitedProfile.id

  // 3. Check if user is already a member
  const { data: existingMembership, error: existingMembershipError } = await supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', invitedUserId)
    .single()

  if (existingMembershipError && existingMembershipError.code !== 'PGRST116') { // PGRST116 is 'no rows found'
    console.error('Error checking existing membership', existingMembershipError);
    return { success: false, error: { message: 'Error checking existing membership.' } }
  }

  if (existingMembership) {
    return { success: false, error: { message: 'User is already a member of this workspace.' } }
  }

  // 4. Add the invited user to workspace_members
  const { error: insertError } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspaceId,
      user_id: invitedUserId,
      role: role,
    })

  if (insertError) {
    console.error('Error adding new member to workspace', insertError);
    return { success: false, error: { message: 'Failed to add member to workspace.' } }
  }

  revalidatePath(`/dashboard/team`) // Revalidate team page
  revalidatePath(`/dashboard/projects`) // Might affect project views if members are shown
  revalidatePath(`/dashboard`) // General dashboard revalidation

  return { success: true }
}
