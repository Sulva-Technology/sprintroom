import Link from 'next/link'
import { format } from 'date-fns'
import { MailPlus, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveWorkspaceId } from '@/lib/workspace/active-workspace'
import { canEditWorkspace } from '@/app/actions/roles'
import { groupMyDay, dateKeyInTimeZone, type MyDayTask } from '@/lib/tasks/my-day'
import { MyDayList } from '@/components/home/my-day-list'
import { QuickAddTask } from '@/components/home/quick-add-task'
import { StartFocusButton } from '@/components/dashboard/start-focus-button'
import { Button } from '@/components/ui/button'

/** Home = My Day. Only my work; team views live on /dashboard/team. */
export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const now = new Date()
  const workspaceId = await resolveActiveWorkspaceId()

  const { data: profile } = await supabase.from('profiles').select('full_name, timezone').eq('id', user.id).single()
  const todayKey = dateKeyInTimeZone(now, profile?.timezone)

  const tasksQuery: PromiseLike<{ data: any[] | null }> = workspaceId
    ? supabase
        .from('tasks')
        .select('id, title, status, priority, deadline, project_id, owner_id, created_by, projects(name)')
        .eq('workspace_id', workspaceId)
        .neq('status', 'done')
        .or(`owner_id.eq.${user.id},and(owner_id.is.null,created_by.eq.${user.id})`)
    : Promise.resolve({ data: [] })

  const [tasksRes, focusRes, invitesRes, canEdit] = await Promise.all([
    tasksQuery,
    supabase
      .from('focus_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .gte('started_at', `${todayKey}T00:00:00Z`),
    supabase.rpc('get_my_workspace_invites'),
    workspaceId ? canEditWorkspace(workspaceId) : Promise.resolve(false),
  ])

  const tasks: MyDayTask[] = (tasksRes.data ?? []).map((t: any) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    deadline: t.deadline,
    project_id: t.project_id,
    project_name: (Array.isArray(t.projects) ? t.projects[0]?.name : t.projects?.name) ?? null,
    owner_id: t.owner_id,
    created_by: t.created_by,
  }))

  const { overdue, today, upNext } = groupMyDay(tasks, user.id, todayKey)
  const focusToday = focusRes.count ?? 0
  const pendingInvites = ((invitesRes.data as { status: string }[] | null) ?? []).filter((i) => i.status === 'pending').length
  const firstName = profile?.full_name?.split(' ')[0]

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 pb-12">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{firstName ? `Hi ${firstName}` : 'My Day'}</h1>
          <p className="text-sm text-muted-foreground">
            {format(now, 'EEEE, MMMM do')} · {today.length} for today · {focusToday} focus session{focusToday === 1 ? '' : 's'} done
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" render={<Link href="/dashboard/team" />} className="h-9 rounded-full bg-white">
            <Users className="mr-2 h-4 w-4" />
            Team
          </Button>
          <StartFocusButton />
        </div>
      </header>

      {pendingInvites > 0 && (
        <Link
          href="/dashboard/invites"
          className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-medium text-primary"
        >
          <MailPlus className="h-4 w-4" />
          You have {pendingInvites} pending workspace invite{pendingInvites === 1 ? '' : 's'}. Review
        </Link>
      )}

      {canEdit && <QuickAddTask />}

      {overdue.length > 0 && <MyDayList title="Overdue" tasks={overdue} empty="" tone="warning" />}
      <MyDayList title="Today" tasks={today} empty="Nothing planned for today. Add a task above or pull one from a project." />
      <MyDayList title="Up next" tasks={upNext.slice(0, 10)} empty="No other open tasks assigned to you." />
    </div>
  )
}
