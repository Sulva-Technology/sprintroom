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
    day_of_week: z.number().min(0).max(6)
  }))
})

export async function getRhythms(workspaceId?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  let query = supabase
    .from('weekly_rhythm_templates')
    .select('*, weekly_rhythm_tasks(*)')
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

  const { error: tasksError } = await supabase.from('weekly_rhythm_tasks').insert(tasksToInsert)

  if (tasksError) return { success: false, error: tasksError.message }

  revalidatePath('/dashboard/rhythms')
  return { success: true, template }
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
