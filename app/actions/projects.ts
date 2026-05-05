'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
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

  // 1. Get the user's first workspace (defaulting to the first one they belong to)
  const { data: membership, error: membershipError } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (membershipError || !membership) {
    return { success: false, error: { message: 'No workspace found', details: 'You must be part of a workspace to create a project.' } }
  }

  // 2. Create the project
  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      workspace_id: membership.workspace_id,
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
