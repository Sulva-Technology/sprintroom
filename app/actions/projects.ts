'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { getWorkspaceRole } from './roles'
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

  // 1. Resolve the ACTIVE workspace (falling back to any membership). Previously
  // this always used the user's first workspace, so projects could land in the
  // wrong one when multiple workspaces existed.
  const cookieStore = await cookies()
  let workspaceId = cookieStore.get('active_workspace_id')?.value

  if (!workspaceId) {
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()
    workspaceId = membership?.workspace_id
  }

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

  // RLS handles access control
  const { data, error } = await supabase
    .from('projects')
    .select('*')
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

