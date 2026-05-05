'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const updateTaskStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['backlog', 'today', 'doing', 'blocked', 'review', 'done']),
  projectId: z.string().uuid().optional()
})

export async function updateTaskStatus(id: string, status: string, options?: { projectId?: string }) {
  const validated = updateTaskStatusSchema.safeParse({ id, status, projectId: options?.projectId })
  if (!validated.success) {
    return { success: false, error: { message: 'Invalid input', details: validated.error.format() } }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('tasks').update({ status: validated.data.status }).eq('id', validated.data.id)

  if (error) {
    console.error('Supabase error:', error);
    return { success: false, error: { message: 'A database error occurred', details: error.message } };
  }

  if (validated.data.projectId) {
    revalidatePath(`/dashboard/projects/${validated.data.projectId}`)
  }
  revalidatePath('/dashboard/projects')
  revalidatePath('/dashboard')
  return { success: true }
}

const markBlockedSchema = z.object({
  id: z.string().uuid(),
  blockedReason: z.string().min(1, 'Reason is required'),
  projectId: z.string().uuid()
})

export async function markBlocked(id: string, blockedReason: string, projectId: string) {
  const validated = markBlockedSchema.safeParse({ id, blockedReason, projectId })
  if (!validated.success) {
    return { success: false, error: { message: 'Invalid input', details: validated.error.format() } }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('tasks').update({
    status: 'blocked',
    blocked_reason: validated.data.blockedReason
  }).eq('id', validated.data.id)

  if (error) {
    console.error('Supabase error:', error);
    return { success: false, error: { message: 'A database error occurred', details: error.message } };
  }

  revalidatePath(`/dashboard/projects/${validated.data.projectId}`)
  revalidatePath('/dashboard/projects')
  revalidatePath('/dashboard')
  return { success: true }
}

const markDoneSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid()
})

export async function markDone(id: string, projectId: string) {
  const validated = markDoneSchema.safeParse({ id, projectId })
  if (!validated.success) {
    return { success: false, error: { message: 'Invalid input', details: validated.error.format() } }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('tasks').update({
    status: 'done'
  }).eq('id', validated.data.id)

  if (error) {
    console.error('Supabase error:', error);
    return { success: false, error: { message: 'A database error occurred', details: error.message } };
  }

  revalidatePath(`/dashboard/projects/${validated.data.projectId}`)
  revalidatePath('/dashboard/projects')
  revalidatePath('/dashboard')
  return { success: true }
}

const assignOwnerSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  projectId: z.string().uuid()
})

export async function assignOwner(id: string, ownerId: string, projectId: string) {
  const validated = assignOwnerSchema.safeParse({ id, ownerId, projectId })
  if (!validated.success) {
    return { success: false, error: { message: 'Invalid input', details: validated.error.format() } }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('tasks').update({
    owner_id: validated.data.ownerId
  }).eq('id', validated.data.id)

  if (error) {
    console.error('Supabase error:', error);
    return { success: false, error: { message: 'A database error occurred', details: error.message } };
  }

  revalidatePath(`/dashboard/projects/${validated.data.projectId}`)
  revalidatePath('/dashboard/projects')
  revalidatePath('/dashboard')
  return { success: true }
}

const createTaskSchema = z.object({
  project_id: z.string().uuid(),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional(),
  status: z.enum(['backlog', 'today', 'doing', 'blocked', 'review', 'done']).optional(),
  owner_id: z.string().uuid().nullable().optional(),
  priority: z.string().optional(),
  deadline: z.string().optional(),
  estimate_pomodoros: z.number().int().min(0).optional()
})

export async function createTask(data: any) {
  const validated = createTaskSchema.safeParse(data)
  if (!validated.success) {
    return { success: false, error: { message: 'Invalid input', details: validated.error.format() } }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: { message: 'Not authenticated' } }

  const { error } = await supabase.from('tasks').insert({
    project_id: validated.data.project_id,
    title: validated.data.title,
    description: validated.data.description,
    status: validated.data.status || 'backlog',
    owner_id: validated.data.owner_id || null,
    priority: validated.data.priority || 'medium',
    deadline: validated.data.deadline ? new Date(validated.data.deadline).toISOString() : null,
    estimate_pomodoros: validated.data.estimate_pomodoros || 0,
    user_id: user.id
  })

  if (error) {
    console.error('Supabase error:', error);
    return { success: false, error: { message: 'A database error occurred', details: error.message } };
  }

  revalidatePath(`/dashboard/projects/${validated.data.project_id}`)
  revalidatePath('/dashboard/projects')
  revalidatePath('/dashboard')
  return { success: true }
}

const deleteTaskSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid().optional()
})

export async function deleteTask(id: string, projectId?: string) {
  const validated = deleteTaskSchema.safeParse({ id, projectId })
  if (!validated.success) {
    return { success: false, error: { message: 'Invalid input', details: validated.error.format() } }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('tasks').delete().eq('id', validated.data.id)

  if (error) {
    console.error('Supabase error:', error);
    return { success: false, error: { message: 'A database error occurred', details: error.message } };
  }

  if (validated.data.projectId) {
    revalidatePath(`/dashboard/projects/${validated.data.projectId}`)
  }
  revalidatePath('/dashboard/projects')
  revalidatePath('/dashboard')
  return { success: true }
}