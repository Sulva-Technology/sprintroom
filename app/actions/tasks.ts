'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateTaskStatus(id: string, status: string, options?: { projectId?: string }) {
  const supabase = await createClient()
  const { error } = await supabase.from('tasks').update({ status }).eq('id', id)
  if (error) {
    console.error('Supabase error:', error);
    return { success: false, error: { message: 'A database error occurred', details: error.message } };
  }

  if (options?.projectId) {
    revalidatePath(`/dashboard/projects/${options.projectId}`)
  }
  revalidatePath('/dashboard/projects')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function markBlocked(id: string, blockedReason: string, projectId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('tasks').update({
    status: 'blocked',
    blocked_reason: blockedReason
  }).eq('id', id)

  if (error) {
    console.error('Supabase error:', error);
    return { success: false, error: { message: 'A database error occurred', details: error.message } };
  }

  revalidatePath(`/dashboard/projects/${projectId}`)
  revalidatePath('/dashboard/projects')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function markDone(id: string, projectId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('tasks').update({
    status: 'done'
  }).eq('id', id)

  if (error) {
    console.error('Supabase error:', error);
    return { success: false, error: { message: 'A database error occurred', details: error.message } };
  }

  revalidatePath(`/dashboard/projects/${projectId}`)
  revalidatePath('/dashboard/projects')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function assignOwner(id: string, ownerId: string, projectId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('tasks').update({
    owner_id: ownerId
  }).eq('id', id)

  if (error) {
    console.error('Supabase error:', error);
    return { success: false, error: { message: 'A database error occurred', details: error.message } };
  }

  revalidatePath(`/dashboard/projects/${projectId}`)
  revalidatePath('/dashboard/projects')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function createTask(data: {
  project_id: string;
  title: string;
  description?: string;
  status?: string;
  owner_id?: string;
  priority?: string;
  deadline?: string;
  estimate_pomodoros?: number;
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase.from('tasks').insert({
    project_id: data.project_id,
    title: data.title,
    description: data.description,
    status: data.status || 'backlog',
    owner_id: data.owner_id || null, // null owner means unassigned unless explicitly passed
    priority: data.priority || 'medium',
    deadline: data.deadline ? new Date(data.deadline).toISOString() : null,
    estimate_pomodoros: data.estimate_pomodoros || 0
  })

  if (error) {
    console.error('Supabase error:', error);
    return { success: false, error: { message: 'A database error occurred', details: error.message } };
  }

  revalidatePath(`/dashboard/projects/${data.project_id}`)
  revalidatePath('/dashboard/projects')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteTask(id: string, projectId?: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) {
    console.error('Supabase error:', error);
    return { success: false, error: { message: 'A database error occurred', details: error.message } };
  }
  if (projectId) {
    revalidatePath(`/dashboard/projects/${projectId}`)
  }
  revalidatePath('/dashboard/projects')
  revalidatePath('/dashboard')
  return { success: true }
}