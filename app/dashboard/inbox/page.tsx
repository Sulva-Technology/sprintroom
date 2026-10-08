import { createClient } from '@/lib/supabase/server'
import { describeNotification } from '@/lib/notifications'
import { InboxList, type InboxItem } from '@/components/inbox/inbox-list'

export default async function InboxPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: rows } = await supabase
    .from('notifications')
    .select('id, type, body, read_at, created_at, actor_id, tasks(title, project_id)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const actorIds = Array.from(new Set((rows ?? []).map((r: any) => r.actor_id).filter(Boolean)))
  const { data: actors } = actorIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', actorIds)
    : { data: [] }
  const nameById = new Map((actors ?? []).map((a: any) => [a.id, a.full_name as string | null]))

  const items: InboxItem[] = (rows ?? []).map((r: any) => {
    const task = Array.isArray(r.tasks) ? r.tasks[0] : r.tasks
    return {
      id: r.id,
      text: describeNotification({
        type: r.type,
        actorName: nameById.get(r.actor_id) ?? null,
        taskTitle: task?.title ?? null,
        body: r.body,
      }),
      href: task?.project_id ? `/dashboard/projects/${task.project_id}` : '/dashboard',
      unread: !r.read_at,
      createdAt: r.created_at,
    }
  })

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-12">
      <h1 className="text-3xl font-bold tracking-tight">Inbox</h1>
      <InboxList items={items} />
    </div>
  )
}
