'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateTask(id: string, data: any, projectId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('tasks').update(data).eq('id', id)
  if (error) return { error: error.message }
  
  revalidatePath(`/dashboard/projects/${projectId}`)
  revalidatePath('/dashboard')
  return { success: true }
}

export async function addChecklistItem(taskId: string, title: string, projectId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('task_checklist_items').insert({
    task_id: taskId,
    title,
    is_completed: false
  })
  if (error) return { error: error.message }
  
  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true }
}

export async function toggleChecklistItem(id: string, isCompleted: boolean, projectId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('task_checklist_items').update({ is_completed: isCompleted }).eq('id', id)
  if (error) return { error: error.message }
  
  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true }
}

export async function deleteChecklistItem(id: string, projectId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('task_checklist_items').delete().eq('id', id)
  if (error) return { error: error.message }
  
  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true }
}

export async function addComment(taskId: string, content: string, projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: task } = await supabase
    .from('tasks')
    .select('workspace_id, project_id')
    .eq('id', taskId)
    .single()
  
  const { error } = await supabase.from('task_comments').insert({
    task_id: taskId,
    workspace_id: task?.workspace_id,
    project_id: task?.project_id || projectId,
    user_id: user.id,
    content
  })
  if (error) return { error: error.message }
  
  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true }
}

export async function assignTaskOwner(id: string, ownerId: string | null, projectId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('tasks').update({ owner_id: ownerId }).eq('id', id)
  if (error) return { error: error.message }
  
  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true }
}
