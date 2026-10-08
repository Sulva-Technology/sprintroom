'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveWorkspaceId } from '@/lib/workspace/active-workspace'
import { canEditWorkspace } from '@/app/actions/roles'
import { dateKeyInTimeZone } from '@/lib/tasks/my-day'
import { currentCycle, cycleName, newCycleDates } from '@/lib/cycles/cycle'

type Result = { success: true } | { success: false; error: string }

export async function startCycle(weeks: number): Promise<Result> {
  if (weeks !== 1 && weeks !== 2) return { success: false, error: 'A cycle is 1 or 2 weeks' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const workspaceId = await resolveActiveWorkspaceId()
  if (!workspaceId) return { success: false, error: 'Create or join a workspace first' }
  if (!(await canEditWorkspace(workspaceId))) return { success: false, error: 'Viewers cannot start cycles' }

  const { data: profile } = await supabase.from('profiles').select('timezone').eq('id', user.id).single()
  const todayKey = dateKeyInTimeZone(new Date(), profile?.timezone)

  const { data: open } = await supabase
    .from('cycles')
    .select('id, starts_on, ends_on, completed_at')
    .eq('workspace_id', workspaceId)
    .is('completed_at', null)
  if (currentCycle(open ?? [], todayKey)) return { success: false, error: 'A cycle is already running' }

  const dates = newCycleDates(todayKey, weeks)
  const { error } = await supabase
    .from('cycles')
    .insert({ workspace_id: workspaceId, name: cycleName(dates.starts_on), ...dates, created_by: user.id })
  if (error) {
    return { success: false, error: error.code === '23505' ? 'A cycle already starts today' : error.message }
  }

  revalidatePath('/dashboard/cycle')
  return { success: true }
}
