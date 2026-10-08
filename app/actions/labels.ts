'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { normalizeLabelName, pickLabelColor } from '@/lib/labels'

type Label = { id: string; name: string; color: string }

export async function createLabel(
  workspaceId: string,
  name: string
): Promise<{ success: true; label: Label } | { success: false; error: string }> {
  if (!z.string().uuid().safeParse(workspaceId).success) return { success: false, error: 'Invalid input' }
  const clean = normalizeLabelName(name)
  if (!clean) return { success: false, error: 'Label name is required' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('labels')
    .insert({ workspace_id: workspaceId, name: clean, color: pickLabelColor(clean) })
    .select('id, name, color')
    .single()
  if (error) return { success: false, error: error.code === '23505' ? 'That label already exists' : error.message }
  return { success: true, label: data as Label }
}

export async function setTaskLabel(
  taskId: string,
  labelId: string,
  on: boolean,
  projectId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const ids = z.object({ taskId: z.string().uuid(), labelId: z.string().uuid() }).safeParse({ taskId, labelId })
  if (!ids.success) return { success: false, error: 'Invalid input' }

  const supabase = await createClient()
  if (on) {
    const { error } = await supabase.from('task_labels').insert({ task_id: taskId, label_id: labelId })
    if (error && error.code !== '23505') return { success: false, error: error.message }
  } else {
    const { error } = await supabase.from('task_labels').delete().eq('task_id', taskId).eq('label_id', labelId)
    if (error) return { success: false, error: error.message }
  }

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true }
}
