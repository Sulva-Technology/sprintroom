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

  const { data: memberRows } = await supabase
    .from('workspace_members')
    .select('user_id, role')
    .eq('workspace_id', (task.projects as any)?.workspace_id)

  // Resolve real names/avatars for everyone referenced (owner, members, comment
  // authors, activity actors) in one query. Previously these were never joined,
  // so the UI showed generic "Assigned"/"Member" placeholders.
  const ids = new Set<string>()
  if (task.owner_id) ids.add(task.owner_id)
  ;(memberRows || []).forEach((m: any) => m.user_id && ids.add(m.user_id))
  ;(comments || []).forEach((c: any) => c.user_id && ids.add(c.user_id))
  ;(activityLogs || []).forEach((a: any) => a.user_id && ids.add(a.user_id))

  const { data: profiles } = ids.size > 0
    ? await supabase.from('profiles').select('id, full_name, avatar_url, email').in('id', Array.from(ids))
    : { data: [] }

  const profileById = new Map((profiles || []).map((p: any) => [p.id, p]))

  return {
    task,
    owner: task.owner_id ? profileById.get(task.owner_id) || null : null,
    checklists: checklists || [],
    comments: (comments || []).map((c: any) => ({ ...c, author: profileById.get(c.user_id) || null })),
    focusSessions: focusSessions || [],
    activityLogs: (activityLogs || []).map((a: any) => ({ ...a, actor: profileById.get(a.user_id) || null })),
    members: (memberRows || []).map((m: any) => {
      const p = profileById.get(m.user_id)
      return {
        id: m.user_id,
        role: m.role,
        full_name: p?.full_name || 'Unknown member',
        avatar_url: p?.avatar_url || null,
        email: p?.email || null,
      }
    }),
  }
}
