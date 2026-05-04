'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createWorkspace(name: string, initial: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // 1. Create Workspace
  // The trigger 'on_workspace_created' will automatically add the user to workspace_members
  const { data: workspaceData, error: workspaceError } = await supabase
    .from('workspaces')
    .insert({
      name,
      initial,
      created_by: user.id
    })
    .select()
    .single()

  if (workspaceError) {
    console.error("Error creating workspace:", workspaceError)
    return { success: false, error: workspaceError.message }
  }

  if (!workspaceData) {
    return { success: false, error: "Failed to retrieve new workspace data." }
  }

  // 2. Create default project
  const { error: projectError } = await supabase.from('projects').insert({
    workspace_id: workspaceData.id,
    name: 'General',
    description: 'Default project for this workspace',
    created_by: user.id
  })

  if (projectError) {
     console.error("Error creating default project:", projectError)
     // We don't fail the whole workspace creation if just the project failed
  }

  revalidatePath('/dashboard', 'layout')
  return { success: true, workspace: workspaceData }
}

export async function getWorkspaces() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // RLS (is_workspace_member) handles filtering
  const { data } = await supabase
    .from('workspaces')
    .select('*')
    .order('created_at', { ascending: true })

  return data || []
}
