'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Scheduled Focus Sessions

export async function scheduleFocusSession(taskId: string | null, projectId: string | null, workspaceId: string | null, startTime: string, durationMinutes: number = 25) {
  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()

  if (userError || !userData?.user) {
    return { success: false, error: 'User not authenticated' }
  }

  const { error } = await supabase.from('focus_schedules').insert({
    user_id: userData.user.id,
    task_id: taskId,
    project_id: projectId,
    workspace_id: workspaceId,
    start_time: startTime,
    duration_minutes: durationMinutes,
    status: 'pending'
  })

  if (error) {
    console.error('Error creating scheduled session:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/focus')
  return { success: true }
}

export async function cancelFocusSchedule(scheduleId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('focus_schedules').update({
    status: 'cancelled'
  }).eq('id', scheduleId)

  if (error) {
    console.error('Error cancelling schedule:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/focus')
  return { success: true }
}

// Recurring Tasks

export async function createRecurringTaskRule(data: {
  projectId: string | null,
  templateTitle: string,
  templateDescription: string,
  frequency: 'daily' | 'weekly' | 'monthly',
  nextRunAt: string,
  targetStatus?: string
}) {
  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()

  if (userError || !userData?.user) {
    return { success: false, error: 'User not authenticated' }
  }

  const { error } = await supabase.from('task_recurrence_rules').insert({
    user_id: userData.user.id,
    project_id: data.projectId,
    template_title: data.templateTitle,
    template_description: data.templateDescription,
    frequency: data.frequency,
    next_run_at: data.nextRunAt,
    target_status: data.targetStatus || 'backlog'
  })

  if (error) {
    console.error('Error creating recurring task rule:', error)
    return { success: false, error: error.message }
  }

  if (data.projectId) {
    revalidatePath(`/dashboard/projects/${data.projectId}`)
  }
  revalidatePath('/dashboard/settings')
  return { success: true }
}

export async function toggleRecurringTaskRule(ruleId: string, isActive: boolean) {
  const supabase = await createClient()
  const { error } = await supabase.from('task_recurrence_rules').update({
    is_active: isActive
  }).eq('id', ruleId)

  if (error) {
    console.error('Error toggling rule:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/settings')
  return { success: true }
}

export async function deleteRecurringTaskRule(ruleId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('task_recurrence_rules').delete().eq('id', ruleId)

  if (error) {
    console.error('Error deleting rule:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/settings')
  return { success: true }
}