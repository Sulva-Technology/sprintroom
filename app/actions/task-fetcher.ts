'use server'

import { createClient } from '@/lib/supabase/server'

export async function getTaskDetails(taskId: string) {
  const supabase = await createClient()

  const { data: task } = await supabase
    .from('tasks')
    .select('*, projects(name, workspace_id)')
    .eq('id', taskId)
    .single()

  if (!task) return { error: 'Task not found' }

  const [
    { data: checklists },
    { data: comments },
    { data: focusSessions },
    { data: activityLogs },
  ] = await Promise.all([
    supabase.from('task_checklist_items').select('*').eq('task_id', taskId).order('created_at', { ascending: true }),
    supabase.from('task_comments').select('*').eq('task_id', taskId).order('created_at', { ascending: false }),
    supabase.from('focus_sessions').select('*').eq('task_id', taskId).order('created_at', { ascending: false }),
    supabase.from('task_activity').select('*').eq('task_id', taskId).order('created_at', { ascending: false })
  ])

  const { data: members } = await supabase
    .from('workspace_members')
    .select('user_id, role')
    .eq('workspace_id', (task.projects as any)?.workspace_id)

  return {
    task,
    checklists: checklists || [],
    comments: comments || [],
    focusSessions: focusSessions || [],
    activityLogs: activityLogs || [],
    members: members?.map((m: any) => ({
      id: m.user_id,
      email: m.user_id === task.owner_id ? 'Owner' : 'Member'
    })) || []
  }
}
