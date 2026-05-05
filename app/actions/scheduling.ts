'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// --- Schemas ---

const scheduleFocusSessionSchema = z.object({
  task_id: z.string().uuid().nullable(),
  project_id: z.string().uuid().nullable().optional(),
  workspace_id: z.string().uuid().nullable().optional(),
  start_time: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format",
  }),
  duration_minutes: z.number().int().min(1).max(120).default(25)
})

const createRecurringTaskSchema = z.object({
  project_id: z.string().uuid().nullable(),
  template_title: z.string().min(1, 'Title is required').max(200),
  template_description: z.string().max(1000).optional().nullable(),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  next_run_at: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format",
  }),
  target_status: z.string().optional().default('backlog')
})

// --- Actions ---

/**
 * Schedule a focus session for the future
 */
export async function scheduleFocusSession(data: any) {
  const validated = scheduleFocusSessionSchema.safeParse(data)
  if (!validated.success) {
    return { success: false, error: { message: 'Invalid input', details: validated.error.format() } }
  }

  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return { success: false, error: { message: 'Not authenticated' } }
  }

  const { error } = await supabase.from('focus_schedules').insert({
    user_id: user.id,
    task_id: validated.data.task_id,
    project_id: validated.data.project_id || null,
    workspace_id: validated.data.workspace_id || null,
    start_time: new Date(validated.data.start_time).toISOString(),
    duration_minutes: validated.data.duration_minutes,
    status: 'pending'
  })

  if (error) {
    console.error('Error creating scheduled session:', error)
    return { success: false, error: { message: 'Database error', details: error.message } }
  }

  revalidatePath('/dashboard/focus')
  return { success: true }
}

/**
 * Cancel a scheduled focus session
 */
export async function cancelFocusSchedule(scheduleId: string) {
  if (!scheduleId) return { success: false, error: { message: 'Schedule ID is required' } }

  const supabase = await createClient()
  const { error } = await supabase.from('focus_schedules').update({
    status: 'cancelled'
  }).eq('id', scheduleId)

  if (error) {
    console.error('Error cancelling schedule:', error)
    return { success: false, error: { message: 'Database error', details: error.message } }
  }

  revalidatePath('/dashboard/focus')
  return { success: true }
}

/**
 * Create a new recurring task rule
 */
export async function createRecurringTaskRule(data: any) {
  const validated = createRecurringTaskSchema.safeParse(data)
  if (!validated.success) {
    return { success: false, error: { message: 'Invalid input', details: validated.error.format() } }
  }

  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return { success: false, error: { message: 'Not authenticated' } }
  }

  const { error } = await supabase.from('task_recurrence_rules').insert({
    user_id: user.id,
    project_id: validated.data.project_id,
    template_title: validated.data.template_title,
    template_description: validated.data.template_description || "",
    frequency: validated.data.frequency,
    next_run_at: new Date(validated.data.next_run_at).toISOString(),
    target_status: validated.data.target_status || 'backlog'
  })

  if (error) {
    console.error('Error creating recurring task rule:', error)
    return { success: false, error: { message: 'Database error', details: error.message } }
  }

  if (validated.data.project_id) {
    revalidatePath(`/dashboard/projects/${validated.data.project_id}`)
  }
  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard/projects')
  return { success: true }
}

/**
 * Toggle active status of a recurrence rule
 */
export async function toggleRecurringTaskRule(ruleId: string, isActive: boolean) {
  const supabase = await createClient()
  const { error } = await supabase.from('task_recurrence_rules').update({
    is_active: isActive
  }).eq('id', ruleId)

  if (error) {
    console.error('Error toggling rule:', error)
    return { success: false, error: { message: 'Database error', details: error.message } }
  }

  revalidatePath('/dashboard/settings')
  return { success: true }
}

/**
 * Delete a recurrence rule
 */
export async function deleteRecurringTaskRule(ruleId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('task_recurrence_rules').delete().eq('id', ruleId)

  if (error) {
    console.error('Error deleting rule:', error)
    return { success: false, error: { message: 'Database error', details: error.message } }
  }

  revalidatePath('/dashboard/settings')
  return { success: true }
}

/**
 * Fetch upcoming focus schedules for the current user
 */
export async function getUpcomingSchedules() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from('focus_schedules')
    .select(`
      *,
      task:tasks(title)
    `)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .gte('start_time', new Date().toISOString())
    .order('start_time', { ascending: true })

  if (error) {
    console.error('Error fetching schedules:', error)
    return []
  }

  return data
}
