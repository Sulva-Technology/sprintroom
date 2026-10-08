'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { resolveActiveWorkspaceId } from '@/lib/workspace/active-workspace'
import { pickDefaultProjectId } from '@/lib/tasks/default-project'
import { toDeadlineIso } from '@/lib/tasks/deadline'
import { currentCycle } from '@/lib/cycles/cycle'
import { dateKeyInTimeZone } from '@/lib/tasks/my-day'

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
  ownerId: z.string().uuid().nullable(),
  projectId: z.string().uuid()
})

/** Assign (or, with `null`, unassign) a task, and log it to the activity feed. */
export async function assignOwner(id: string, ownerId: string | null, projectId: string) {
  const validated = assignOwnerSchema.safeParse({ id, ownerId, projectId })
  if (!validated.success) {
    return { success: false, error: { message: 'Invalid input', details: validated.error.format() } }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: { message: 'Not authenticated' } }

  const { data: task, error } = await supabase
    .from('tasks')
    .update({ owner_id: validated.data.ownerId })
    .eq('id', validated.data.id)
    .select('id, project_id, workspace_id')
    .maybeSingle()

  if (error) {
    console.error('Supabase error:', error);
    return { success: false, error: { message: 'A database error occurred', details: error.message } };
  }
  // RLS turns a forbidden update into zero rows, not an error.
  if (!task) return { success: false, error: { message: 'You do not have permission to assign this task' } }

  // Best-effort: the assignment already succeeded; a feed failure must not undo it.
  await supabase.from('task_activity').insert({
    task_id: task.id,
    project_id: task.project_id,
    workspace_id: task.workspace_id,
    user_id: user.id,
    type: validated.data.ownerId ? 'assigned' : 'unassigned',
    body: validated.data.ownerId,
  })

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
  estimate_pomodoros: z.number().int().min(0).optional(),
  cycle_id: z.string().uuid().nullable().optional(),
})

export async function createTask(data: any) {
  const validated = createTaskSchema.safeParse(data)
  if (!validated.success) {
    return { success: false, error: { message: 'Invalid input', details: validated.error.format() } }
  }

  try {
    if (validated.data.deadline) toDeadlineIso(validated.data.deadline)
  } catch {
    return { success: false, error: { message: 'Invalid deadline' } }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: { message: 'Not authenticated' } }

  const { data: inserted, error } = await supabase.from('tasks').insert({
    project_id: validated.data.project_id,
    title: validated.data.title,
    description: validated.data.description,
    status: validated.data.status || 'backlog',
    owner_id: validated.data.owner_id || null,
    priority: validated.data.priority || 'medium',
    deadline: validated.data.deadline ? toDeadlineIso(validated.data.deadline) : null,
    estimate_pomodoros: validated.data.estimate_pomodoros || 0,
    // Only sent when set, so creating tasks keeps working on a DB that has not
    // had the cycles migration pushed yet (an unknown column is a PGRST204).
    ...(validated.data.cycle_id ? { cycle_id: validated.data.cycle_id } : {}),
    // NOTE: `tasks` has no `user_id` column — authorship is `created_by`
    // (`owner_id` is the assignee). Sending user_id made every insert fail with
    // PGRST204 "Could not find the 'user_id' column of 'tasks'".
    // workspace_id is filled by the set_task_workspace_id BEFORE INSERT trigger.
    created_by: user.id
  }).select('id').single()

  if (error) {
    console.error('Supabase error:', error);
    return { success: false, error: { message: 'A database error occurred', details: error.message } };
  }

  revalidatePath(`/dashboard/projects/${validated.data.project_id}`)
  revalidatePath('/dashboard/projects')
  revalidatePath('/dashboard')
  return { success: true, id: inserted?.id as string | undefined }
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

const quickAddSchema = z.object({ title: z.string().trim().min(1, 'Title is required').max(200) })

/**
 * Add a task without choosing a project: it goes to the active workspace's
 * General project (created if the workspace has no projects), assigned to me,
 * status 'today' — so it shows up on Home immediately.
 */
export async function quickAddTask(title: string) {
  const validated = quickAddSchema.safeParse({ title })
  if (!validated.success) {
    return { success: false as const, error: { message: validated.error.issues[0]?.message ?? 'Invalid input' } }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false as const, error: { message: 'Not authenticated' } }

  const workspaceId = await resolveActiveWorkspaceId()
  if (!workspaceId) return { success: false as const, error: { message: 'Create or join a workspace first' } }

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, created_at')
    .eq('workspace_id', workspaceId)

  let projectId = pickDefaultProjectId(projects ?? [])

  if (!projectId) {
    const { data: created, error } = await supabase
      .from('projects')
      .insert({ workspace_id: workspaceId, name: 'General', description: 'Default project for this workspace', created_by: user.id })
      .select('id')
      .single()
    if (error || !created) {
      return { success: false as const, error: { message: error?.message ?? 'Could not create a default project' } }
    }
    projectId = created.id as string
  }

  const { data: profile } = await supabase.from('profiles').select('timezone').eq('id', user.id).single()
  const { data: openCycles } = await supabase
    .from('cycles')
    .select('id, starts_on, ends_on, completed_at')
    .eq('workspace_id', workspaceId)
    .is('completed_at', null)
  const running = currentCycle(openCycles ?? [], dateKeyInTimeZone(new Date(), profile?.timezone))

  return createTask({ project_id: projectId, title: validated.data.title, status: 'today', owner_id: user.id, cycle_id: running?.id ?? null })
}
