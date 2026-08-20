'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getWorkspaceRole } from './roles'
import { resolveActiveWorkspaceId } from '@/lib/workspace/active-workspace'
import { z } from 'zod'

const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional()
})

export async function createProject(data: any) {
  const validated = createProjectSchema.safeParse(data)
  if (!validated.success) {
    return { success: false, error: { message: 'Invalid input', details: validated.error.format() } }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: { message: 'Not authenticated', details: 'You must be logged in to create a project.' } }

  // 1. Resolve the ACTIVE workspace through the shared resolver, so a new
  // project lands in exactly the workspace the rest of the UI is showing (and a
  // stale cookie can't drop it into a workspace the user no longer belongs to).
  const workspaceId = await resolveActiveWorkspaceId()

  if (!workspaceId) {
    return { success: false, error: { message: 'No workspace found', details: 'You must be part of a workspace to create a project.' } }
  }

  // 2. Viewers may not create projects.
  const role = await getWorkspaceRole(workspaceId)
  if (!role || role === 'viewer') {
    return { success: false, error: { message: 'Permission denied', details: 'You do not have permission to create projects in this workspace.' } }
  }

  // 3. Create the project
  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      workspace_id: workspaceId,
      name: validated.data.name,
      description: validated.data.description,
      created_by: user.id
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating project:', error)
    return { success: false, error: { message: 'Failed to create project', details: error.message } }
  }

  revalidatePath('/dashboard/projects')
  return { success: true, project }
}

export async function getRecentProjects() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Scope to the active workspace so the sidebar recents (and the offline route
  // warmer fed from them) match the workspace switcher instead of mixing
  // projects from every workspace the user belongs to.
  const activeWorkspaceId = await resolveActiveWorkspaceId()
  if (!activeWorkspaceId) return []

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('workspace_id', activeWorkspaceId)
    .order('updated_at', { ascending: false })
    .limit(5)

  if (error) {
    console.error('Error fetching recent projects:', error)
    return []
  }

  return data || []
}

export async function getWorkspaceProjects(workspaceId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('projects')
    .select('id, name')
    .eq('workspace_id', workspaceId)
    .order('name')

  if (error) {
    console.error('Error fetching workspace projects:', error)
    return []
  }

  return data || []
}

