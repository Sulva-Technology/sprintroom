'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const createRhythmSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  workspace_id: z.string().uuid().optional().nullable(),
  tasks: z.array(z.object({
    title: z.string().min(1),
    day_of_week: z.number().min(0).max(6),
    // Optional daily reminder time, 'HH:MM'.
    reminder_time: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable()
  }))
})

export async function getRhythms(workspaceId?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  let query = supabase
    .from('weekly_rhythm_templates')
    .select('*, weekly_rhythm_tasks(*, task_reminders(reminder_time, is_enabled))')
    .eq('user_id', user.id)

  if (workspaceId) {
    query = query.eq('workspace_id', workspaceId)
  }

  const { data, error } = await query.order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching rhythms:', error)
    return []
  }

  return data
}

export async function saveRhythmTemplate(data: any) {
  const validated = createRhythmSchema.safeParse(data)
  if (!validated.success) {
    return { success: false, error: 'Invalid input' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // 1. Upsert template
  const { data: template, error: tError } = await supabase
    .from('weekly_rhythm_templates')
    .upsert({
      id: data.id || undefined, // Allow update
      user_id: user.id,
      workspace_id: validated.data.workspace_id,
      name: validated.data.name,
      description: validated.data.description
    })
    .select()
    .single()

  if (tError) return { success: false, error: tError.message }

  // 2. Refresh tasks (delete old, insert new for simplicity in this version)
  if (data.id) {
    await supabase.from('weekly_rhythm_tasks').delete().eq('template_id', template.id)
  }

  const tasksToInsert = validated.data.tasks.map(t => ({
    template_id: template.id,
    title: t.title,
    day_of_week: t.day_of_week
  }))

  const { data: insertedTasks, error: tasksError } = await supabase
    .from('weekly_rhythm_tasks')
    .insert(tasksToInsert)
    .select('id, title, day_of_week')

  if (tasksError) return { success: false, error: tasksError.message }

  // Persist per-task reminders. weekly_rhythm_tasks are deleted+reinserted on
  // every save, and task_reminders cascade on rhythm_task_id, so we simply
  // recreate them here against the freshly inserted task ids.
  const idByKey = new Map((insertedTasks || []).map((t: any) => [`${t.title}::${t.day_of_week}`, t.id]))
  const remindersToInsert = validated.data.tasks
    .filter(t => t.reminder_time)
    .map(t => ({
      user_id: user.id,
      rhythm_task_id: idByKey.get(`${t.title}::${t.day_of_week}`),
      type: 'alarm',
      reminder_time: t.reminder_time,
      is_enabled: true
    }))
    .filter(r => r.rhythm_task_id)

  if (remindersToInsert.length > 0) {
    const { error: remindersError } = await supabase.from('task_reminders').insert(remindersToInsert)
    // Don't fail the whole save if reminders can't be written.
    if (remindersError) console.error('Error saving rhythm reminders:', remindersError)
  }

  revalidatePath('/dashboard/rhythms')
  return { success: true, template }
}

/**
 * Reminders due today for the current user: rhythm tasks scheduled for today's
 * weekday that have an enabled reminder and haven't been completed yet.
 */
export async function getTodaysReminders() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const dayOfWeek = new Date().getDay() // 0=Sun..6=Sat

  const { data, error } = await supabase
    .from('task_reminders')
    .select('id, reminder_time, rhythm_task_id, weekly_rhythm_tasks!inner(title, day_of_week, weekly_rhythm_templates!inner(name))')
    .eq('user_id', user.id)
    .eq('is_enabled', true)
    .eq('weekly_rhythm_tasks.day_of_week', dayOfWeek)

  if (error) {
    console.error('Error fetching reminders:', error)
    return []
  }

  const reminders = data || []
  if (reminders.length === 0) return []

  // Drop reminders for tasks already completed today.
  const todayStr = new Date().toISOString().slice(0, 10)
  const taskIds = reminders.map((r: any) => r.rhythm_task_id)
  const { data: logs } = await supabase
    .from('weekly_rhythm_logs')
    .select('rhythm_task_id')
    .eq('user_id', user.id)
    .eq('completed_at', todayStr)
    .in('rhythm_task_id', taskIds)

  const completed = new Set((logs || []).map((l: any) => l.rhythm_task_id))

  return reminders
    .filter((r: any) => !completed.has(r.rhythm_task_id))
    .map((r: any) => ({
      id: r.id,
      rhythmTaskId: r.rhythm_task_id,
      time: (r.reminder_time || '').slice(0, 5), // 'HH:MM'
      title: r.weekly_rhythm_tasks?.title || 'Rhythm task',
      rhythmName: r.weekly_rhythm_tasks?.weekly_rhythm_templates?.name || null,
    }))
}

export async function toggleRhythmCompletion(rhythmTaskId: string, date: string, note?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // Check if log exists
  const { data: existing } = await supabase
    .from('weekly_rhythm_logs')
    .select('id')
    .eq('rhythm_task_id', rhythmTaskId)
    .eq('completed_at', date)
    .single()

  if (existing) {
    // Uncheck
    const { error } = await supabase.from('weekly_rhythm_logs').delete().eq('id', existing.id)
    if (error) return { success: false, error: error.message }
  } else {
    // Check
    const { error } = await supabase.from('weekly_rhythm_logs').insert({
      user_id: user.id,
      rhythm_task_id: rhythmTaskId,
      completed_at: date,
      proof_note: note
    })
    if (error) return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/rhythms')
  return { success: true }
}

export async function getWeeklyRhythmLogs(startDate: string, endDate: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('weekly_rhythm_logs')
    .select('*')
    .eq('user_id', user.id)
    .gte('completed_at', startDate)
    .lte('completed_at', endDate)

  if (error) {
    console.error('Error fetching rhythm logs:', error)
    return []
  }

  return data
}

export async function deleteRhythmTemplate(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase
    .from('weekly_rhythm_templates')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/rhythms')
  return { success: true }
}
