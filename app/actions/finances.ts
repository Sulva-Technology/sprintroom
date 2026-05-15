'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const financialEntrySchema = z.object({
  workspaceId: z.string().uuid(),
  projectId: z.string().uuid().optional().nullable(),
  taskId: z.string().uuid().optional().nullable(),
  focusSessionId: z.string().uuid().optional().nullable(),
  type: z.enum(['income', 'expense', 'adjustment']),
  amount: z.number().positive(),
  description: z.string().min(1).max(500),
  visibility: z.enum(['workspace', 'personal']),
  entryDate: z.string() // ISO date
})

export async function addFinancialEntry(data: z.infer<typeof financialEntrySchema>) {
  const validated = financialEntrySchema.safeParse(data)
  if (!validated.success) {
    return { success: false, error: { message: 'Invalid input', details: validated.error.format() } }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: { message: 'Not authenticated' } }

  const { error } = await supabase.from('financial_entries').insert({
    workspace_id: validated.data.workspaceId,
    project_id: validated.data.projectId,
    task_id: validated.data.taskId,
    focus_session_id: validated.data.focusSessionId,
    type: validated.data.type,
    amount: validated.data.amount,
    description: validated.data.description,
    visibility: validated.data.visibility,
    entry_date: validated.data.entryDate,
    created_by: user.id
  })

  if (error) {
    console.error('Error adding financial entry:', error)
    return { success: false, error: { message: 'Database error', details: error.message } }
  }

  revalidatePath('/dashboard/finances')
  return { success: true }
}

export async function updateFinancialEntry(id: string, data: Partial<z.infer<typeof financialEntrySchema>>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: { message: 'Not authenticated' } }

  const { error } = await supabase
    .from('financial_entries')
    .update({
      project_id: data.projectId,
      task_id: data.taskId,
      focus_session_id: data.focusSessionId,
      type: data.type,
      amount: data.amount,
      description: data.description,
      visibility: data.visibility,
      entry_date: data.entryDate
    })
    .eq('id', id)

  if (error) {
    console.error('Error updating financial entry:', error)
    return { success: false, error: { message: 'Database error', details: error.message } }
  }

  revalidatePath('/dashboard/finances')
  return { success: true }
}

export async function deleteFinancialEntry(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: { message: 'Not authenticated' } }

  const { error } = await supabase
    .from('financial_entries')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting financial entry:', error)
    return { success: false, error: { message: 'Database error', details: error.message } }
  }

  revalidatePath('/dashboard/finances')
  return { success: true }
}

export async function getFinancialEntries(workspaceId: string, filters?: { projectId?: string; type?: string; visibility?: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  let query = supabase
    .from('financial_entries')
    .select('*, projects(name), tasks(title)')
    .eq('workspace_id', workspaceId)
    .order('entry_date', { ascending: false })

  if (filters?.projectId) query = query.eq('project_id', filters.projectId)
  if (filters?.type) query = query.eq('type', filters.type)
  if (filters?.visibility) query = query.eq('visibility', filters.visibility)

  const { data, error } = await query

  if (error) {
    console.error('Error fetching financial entries:', error)
    return []
  }

  return data || []
}

export async function getFinancialMetrics(workspaceId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // In a real production app, we might use a Postgres view or a more complex RPC for performance.
  // For now, we'll fetch all reachable entries and aggregate in the server action.
  const { data, error } = await supabase
    .from('financial_entries')
    .select('type, amount, project_id, entry_date')
    .eq('workspace_id', workspaceId)

  if (error) {
    console.error('Error fetching financial metrics:', error)
    return null
  }

  const metrics = (data || []).reduce((acc, entry) => {
    if (entry.type === 'income') {
      acc.totalIncome += Number(entry.amount)
    } else if (entry.type === 'expense') {
      acc.totalExpense += Number(entry.amount)
    }
    
    // Aggregation by project
    if (entry.project_id) {
      acc.byProject[entry.project_id] = (acc.byProject[entry.project_id] || 0) + (entry.type === 'expense' ? Number(entry.amount) : 0)
    }

    return acc
  }, { totalIncome: 0, totalExpense: 0, byProject: {} as Record<string, number> })

  return {
    ...metrics,
    netBalance: metrics.totalIncome - metrics.totalExpense
  }
}
