import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Plus, Timer, Zap, CheckCircle2, ShieldAlert, ArrowRight, Activity, Calendar } from 'lucide-react'
import Link from 'next/link'
import { StatCard } from '@/components/dashboard/stat-card'
import { FocusScoreRing } from '@/components/dashboard/focus-score-ring'
import { MyFocusQueue } from '@/components/dashboard/my-focus-queue'
import { ActiveNow } from '@/components/dashboard/active-now'
import { BlockersPanel } from '@/components/dashboard/blockers-panel'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { format } from 'date-fns'
import { StartFocusButton } from '@/components/dashboard/start-focus-button'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)

  const [membershipsData, projectsData, tasksData, focusSessionsData, profilesData] = await Promise.all([
    supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id),
    // Project fetching depends on workspaceIds, so we'll fetch it conditionally later
    Promise.resolve({ data: [] }), // Placeholder for projects
    Promise.resolve({ data: [] }), // Placeholder for tasks
    Promise.resolve({ data: [] }), // Placeholder for focusSessions
    Promise.resolve({ data: [] }), // Placeholder for profiles
  ]);

  const memberships = membershipsData?.data || []
  const workspaceIds = memberships.map((membership) => membership.workspace_id) || []

  const { data: projectsRaw } = workspaceIds.length > 0
    ? await supabase.from('projects').select('id').in('workspace_id', workspaceIds)
    : { data: [] }

  const projects = projectsRaw || []
  const projectIds = projects.map((project) => project.id) || []

  const { data: tasksRaw } = projectIds.length > 0
    ? await supabase
        .from('tasks')
        .select('id, title, description, status, owner_id, deadline, updated_at, blocked_reason, project_id')
        .in('project_id', projectIds)
    : { data: [] }

  const tasks = tasksRaw || []
  const taskIds = tasks.map((task) => task.id)

  const [focusSessionsRaw, profilesRaw] = await Promise.all([
    taskIds.length > 0
      ? supabase
          .from('focus_sessions')
          .select('id, user_id, task_id, status, started_at, duration_minutes, progress_note, distractions_count')
          .in('task_id', taskIds)
          .gte('started_at', todayStart.toISOString())
          .then(res => res.data)
      : Promise.resolve([]),
    (() => {
      const memberIds = Array.from(new Set([
        user.id,
        ...tasks.map((task) => task.owner_id).filter(Boolean),
        ...focusSessionsData?.data?.map((session: any) => session.user_id).filter(Boolean),
      ]))
      return memberIds.length > 0
        ? supabase
            .from('profiles')
            .select('id, full_name, avatar_url, email')
            .in('id', memberIds)
            .then(res => res.data)
        : Promise.resolve([]);
    })(),
  ]);

  const focusSessions = focusSessionsRaw || []
  const profilesById = new Map((profilesRaw || []).map((profile: any) => [profile.id, profile]))
  const tasksById = new Map(tasks.map((task) => [task.id, task]))

  const completedSessions = focusSessions.filter((session) => session.status === 'completed').length
  const tasksMoved = tasks.filter((task) => new Date(task.updated_at) >= todayStart).length
  const activeSessions = focusSessions
    .filter((session) => session.status === 'active')
    .map((session) => ({
      ...session,
      user: profilesById.get(session.user_id),
      task: tasksById.get(session.task_id),
    }))

  const blockers = tasks
    .filter((task) => task.status === 'blocked')
    .map((task) => ({
      ...task,
      assignee: task.owner_id ? profilesById.get(task.owner_id) : null,
    }))

  const overdue = tasks.filter((task) => task.status !== 'done' && task.deadline && new Date(task.deadline) < now).length
  const dueToday = tasks.filter((task) => {
    if (task.status === 'done' || !task.deadline) return false
    const deadline = new Date(task.deadline)
    return deadline >= todayStart && deadline < tomorrowStart
  }).length

  const stats = {
    completedSessions,
    tasksMoved,
    activeNow: activeSessions.length,
    blockers: blockers.length,
    overdue,
    dueToday,
  }

  const scoreRaw = (stats.completedSessions * 10) + (stats.tasksMoved * 8) - (stats.blockers * 7) - (stats.overdue * 10)
  const focusScore = Math.max(0, Math.min(100, scoreRaw))

  const myQueue = tasks.filter((task) => task.owner_id === user.id && ['today', 'doing'].includes(task.status))

  const recentActivity = focusSessions
    .filter((session) => session.status === 'completed')
    .slice(0, 6)
    .map((session) => ({
      user: profilesById.get(session.user_id),
      task: tasksById.get(session.task_id),
      notes: session.progress_note,
    }))

  const todayStr = format(new Date(), 'EEEE, MMMM do')

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12 w-full mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground mb-1">Today&apos;s Execution</h1>
          <p className="text-muted-foreground font-medium text-sm md:text-base">{todayStr} · My Workspace</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" render={<Link href="/dashboard/team" />} className="rounded-full shadow-sm bg-white hover:bg-slate-50 border-border h-9">
              <Activity className="w-4 h-4 mr-2" />
              Team Pulse
          </Button>
<StartFocusButton />
        </div>
      </div>

      {/* Hero Dashboard Card */}
      <div className="bg-white border border-border/50 rounded-3xl p-6 lg:p-8 shadow-sm flex flex-col md:flex-row items-center gap-8 md:gap-12 relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="shrink-0 relative z-10">
          <FocusScoreRing score={focusScore} size={140} />
        </div>

        <div className="flex-1 text-center md:text-left relative z-10">
          <h2 className="text-2xl font-bold tracking-tight mb-2 text-foreground">
            Your team completed <span className="text-primary">{stats.completedSessions} focus sessions</span> and moved <span className="text-primary">{stats.tasksMoved} tasks</span> today.
          </h2>
          <p className="text-muted-foreground mb-6 font-medium">Keep the momentum going. Aim for a score above 80 before you sign off.</p>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
             <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                {stats.activeNow} Active now
             </div>
             {stats.blockers > 0 && (
               <div className="flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-full px-3 py-1.5 text-xs font-semibold text-red-700 shadow-sm">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  {stats.blockers} Blocked
               </div>
             )}
             {stats.overdue > 0 && (
               <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-100 rounded-full px-3 py-1.5 text-xs font-semibold text-amber-700 shadow-sm">
                  <Calendar className="w-3.5 h-3.5" />
                  {stats.overdue} Overdue
               </div>
             )}
          </div>
        </div>

        <div className="hidden lg:flex flex-col items-end justify-center shrink-0 border-l border-border/50 pl-8 relative z-10">
             <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Team Target</span>
             <span className="text-4xl font-black text-slate-200">100</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Focus Sessions" value={stats.completedSessions} icon={CheckCircle2} trend="↑ 12%" trendUp={true} bgAccentClass="bg-emerald-100" accentClass="text-emerald-600" />
        <StatCard title="Tasks Moved" value={stats.tasksMoved} icon={ArrowRight} bgAccentClass="bg-blue-100" accentClass="text-blue-600" />
        <StatCard title="Blockers" value={stats.blockers} icon={ShieldAlert} trend={stats.blockers > 0 ? "Needs Review" : ""} trendUp={false} bgAccentClass={stats.blockers > 0 ? "bg-red-100" : "bg-slate-100"} accentClass={stats.blockers > 0 ? "text-red-600" : "text-slate-400"} />
        <StatCard title="Due Today" value={stats.dueToday} icon={Zap} bgAccentClass="bg-amber-100" accentClass="text-amber-600" />
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Left Col (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
           <MyFocusQueue tasks={myQueue} />
           <RecentActivity activities={recentActivity} />
        </div>

        {/* Right Col (1/3 width) */}
        <div className="space-y-6">
           <ActiveNow activeSessions={activeSessions} />
           <BlockersPanel blockers={blockers} />

           {/* Overdue snippet */}
           {stats.overdue === 0 ? (
             <div className="bg-white border border-border/50 rounded-2xl p-5 shadow-sm text-center">
               <p className="text-sm font-medium text-muted-foreground">No overdue tasks. Perfect execution.</p>
             </div>
           ) : (
             <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-5 shadow-sm">
                <h3 className="text-amber-900 font-semibold text-sm mb-2">Overdue Tasks</h3>
                <p className="text-amber-700/80 text-xs">You have {stats.overdue} tasks that missed their mark.</p>
             </div>
           )}
        </div>
      </div>

    </div>
  )
}