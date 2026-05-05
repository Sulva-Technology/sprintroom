import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TeamHealthCard } from '@/components/team/team-health-card'
import { MemberPulseTable } from '@/components/team/member-pulse-table'
import { BlockerBoard } from '@/components/team/blocker-board'
import { SilentWork } from '@/components/team/silent-work'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { Activity } from 'lucide-react'
import { TeamPulseHeader } from '@/components/team/team-pulse-header'

// Data Helpers
function getInitials(name: string) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
}

export default async function TeamPulsePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 1. Fetch workspaces the user is part of
  const { data: userWorkspaces } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)

  const workspaceIds = userWorkspaces?.map(w => w.workspace_id) || []
  if (workspaceIds.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">You are not part of any workspaces.</p>
      </div>
    )
  }

  const primaryWorkspaceId = workspaceIds[0]
  const userRoleInPrimaryWorkspace = userWorkspaces?.find(w => w.workspace_id === primaryWorkspaceId)?.role || 'member'
  const canInvite = userRoleInPrimaryWorkspace === 'owner' || userRoleInPrimaryWorkspace === 'admin'

  // 2. Fetch all members in these workspaces
  const { data: workspaceMembersRaw } = await supabase
    .from('workspace_members')
    .select('user_id, profiles(full_name, avatar_url, email)')
    .in('workspace_id', workspaceIds)

  // Deduplicate members
  const memberMap = new Map()
  workspaceMembersRaw?.forEach(wm => {
    if (!memberMap.has(wm.user_id)) {
      const profile = Array.isArray(wm.profiles) ? wm.profiles[0] : wm.profiles
      memberMap.set(wm.user_id, {
        id: wm.user_id,
        name: profile?.full_name || 'Anonymous',
        email: profile?.email || '',
        avatar_url: profile?.avatar_url,
        initials: getInitials(profile?.full_name),
      })
    }
  })
  const teamMembers = Array.from(memberMap.values())

  // 3. Fetch projects to scope tasks
  const { data: projectsRaw } = await supabase
    .from('projects')
    .select('id, name')
    .in('workspace_id', workspaceIds)

  const projectIds = projectsRaw?.map(p => p.id) || []
  const projectsMap = new Map(projectsRaw?.map(p => [p.id, p]) || [])

  // 4. Fetch Tasks
  const { data: tasksRaw } = await supabase
    .from('tasks')
    .select('*')
    .in('project_id', projectIds)

  const tasks = tasksRaw || []

  // 5. Fetch Focus Sessions
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const userIds = teamMembers.map(m => m.id)

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const { data: recentSessions } = await supabase
    .from('focus_sessions')
    .select('*')
    .in('user_id', userIds)
    .gte('started_at', sevenDaysAgo.toISOString()) // last 7 days

  const activeSessions = recentSessions?.filter(s => s.status === 'active') || []
  const todayCompletedSessions = recentSessions?.filter(s => s.status === 'completed' && new Date(s.started_at) >= todayStart) || []

  // 6. Compute Team Health Stats
  const activeNowCount = activeSessions.length
  const focusSessionsTodayCount = todayCompletedSessions.length
  const blockedTasksList = tasks.filter(t => t.status === 'blocked').map(t => ({
    ...t,
    owner: memberMap.get(t.owner_id),
    project: projectsMap.get(t.project_id)
  }))
  
  const overdueTasksCount = tasks.filter(t => t.status !== 'done' && t.deadline && new Date(t.deadline) < now).length

  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const silentTasksList = tasks.filter(t => {
    if (t.status !== 'doing') return false
    const updatedAt = new Date(t.updated_at)
    return updatedAt < oneDayAgo
  }).map(t => ({
    ...t,
    owner: memberMap.get(t.owner_id),
    project: projectsMap.get(t.project_id)
  }))

  const focusScoreRaw = (focusSessionsTodayCount * 10) + (tasks.filter(t => t.status === 'done' && new Date(t.updated_at) >= todayStart).length * 8) - (blockedTasksList.length * 7) - (overdueTasksCount * 10)
  const focusScore = Math.max(0, Math.min(100, isNaN(focusScoreRaw) ? 0 : focusScoreRaw))

  let insightMsg = "Your team is moving silently, no blockers found."
  if (blockedTasksList.length > 0) {
    insightMsg = `Your team is moving, but ${blockedTasksList.length} blocker${blockedTasksList.length === 1 ? ' needs' : 's need'} attention.`
  } else if (focusSessionsTodayCount > 0) {
    insightMsg = "Solid focus rhythm today, keep the momentum going."
  }

  const teamStats = {
    focusScore,
    focusSessionsToday: focusSessionsTodayCount,
    activeNow: activeNowCount,
    blockedTasks: blockedTasksList.length,
    silentTasks: silentTasksList.length,
    overdueTasks: overdueTasksCount
  }

  // 7. Compute Member Stats
  const memberPulseData = teamMembers.map(member => {
    const memberTasks = tasks.filter(t => t.owner_id === member.id)
    const assignedTasks = memberTasks.filter(t => t.status !== 'done')
    const blockedTasksCount = assignedTasks.filter(t => t.status === 'blocked').length
    
    // Check if active right now
    const isFocusingNow = activeSessions.some(s => s.user_id === member.id)
    
    // Focus today
    const focusTodayCount = todayCompletedSessions.filter(s => s.user_id === member.id).length
    
    // Done this week
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const doneThisWeekCount = memberTasks.filter(t => t.status === 'done' && new Date(t.updated_at) >= oneWeekAgo).length
    
    // Last activity
    // To simplify without an activity_logs join for now, we use the newest updated_at from their tasks or focus sessions
    const lastSession = recentSessions?.filter(s => s.user_id === member.id).sort((a,b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0]
    const lastTaskUpdate = memberTasks.sort((a,b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0]
    
    let lastActivityStr = ''
    let lastActivityDate = new Date(0)
    if (lastSession && new Date(lastSession.started_at) > lastActivityDate) {
      lastActivityDate = new Date(lastSession.started_at)
    }
    if (lastTaskUpdate && new Date(lastTaskUpdate.updated_at) > lastActivityDate) {
      lastActivityDate = new Date(lastTaskUpdate.updated_at)
    }
    if (lastActivityDate.getTime() > 0) {
      lastActivityStr = lastActivityDate.toISOString()
    }

    const isActiveToday = lastActivityDate > todayStart
    const overloadedCount = assignedTasks.filter(t => ['doing', 'today'].includes(t.status)).length

    let status = 'Moving'
    let insightStr = 'Working steadily on assigned tasks.'

    if (isFocusingNow) {
      status = 'Focusing now'
      insightStr = 'Currently deep in a focus session.'
    } else if (blockedTasksCount > 0) {
      status = 'Blocked'
      insightStr = `Blocked on ${blockedTasksCount} task${blockedTasksCount > 1 ? 's' : ''}. Needs unblocking.`
    } else if (overloadedCount >= 4) {
      status = 'Overloaded'
      insightStr = `Has ${overloadedCount} active tasks. At risk of context switching.`
    } else if (!isActiveToday && !isFocusingNow && focusTodayCount === 0) {
      status = 'Silent'
      insightStr = "No logged activity or focus sessions today."
    }

    return {
      ...member,
      status,
      focusToday: focusTodayCount,
      assignedTasks: assignedTasks.length,
      doneThisWeek: doneThisWeekCount,
      blocked: blockedTasksCount,
      lastActivity: lastActivityStr,
      insight: insightStr
    }
  })

  // 8. Fetch Recent Activity
  const { data: activityLogsRaw } = await supabase
    .from('task_activity')
    .select('*, tasks(title)')
    .order('created_at', { ascending: false })
    .limit(20)

  const activityLog = (activityLogsRaw || []).map(log => ({
    user: memberMap.get(log.user_id),
    task: Array.isArray(log.tasks) ? log.tasks[0] : log.tasks,
    action: log.type, // task_activity uses 'type' instead of 'action'
    created_at: log.created_at
  })).filter(log => log.user) // only keep logs for users in our workspace

  return (
    <div className="h-full flex flex-col pb-12 w-full mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <TeamPulseHeader workspaceId={primaryWorkspaceId} canInvite={canInvite} />

      <TeamHealthCard stats={teamStats} insight={insightMsg} />

      <section>
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-bold text-foreground">Member Pulse</h3>
        </div>
        <MemberPulseTable members={memberPulseData} />
      </section>

      <BlockerBoard blockedTasks={blockedTasksList} />

      <SilentWork silentTasks={silentTasksList} />

      {/* Activity Timeline (We could reuse recent activity from dashboard or render the Pulse updates here) */}
      <section>
        <div className="flex items-center gap-2 mb-6">
          <h3 className="text-xl font-bold text-foreground">Workspace Activity</h3>
        </div>
        <div className="bg-white rounded-2xl border border-border shadow-sm p-6 max-w-4xl">
           {activityLog.length === 0 ? (
             <p className="text-muted-foreground text-sm">No recent pulse updates.</p>
           ) : (
             <div className="space-y-6">
               {activityLog.map((log: any, idx) => (
                  <div key={idx} className="flex gap-4">
                     <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                       <span className="text-xs font-bold text-primary">{getInitials(log.user?.full_name)}</span>
                     </div>
                     <div>
                        <div className="flex items-baseline gap-2">
                           <span className="font-semibold text-sm">{log.user?.name || 'Anonymous'}</span>
                           <span className="text-sm font-medium">{log.task?.title ? `on ${log.task.title}` : ''}</span>
                        </div>
                        <p className="mt-1 text-sm text-foreground/80 bg-slate-50 p-2.5 rounded-lg border border-border/50 inline-block text-left">
                          {log.action}
                        </p>
                        <p className="text-[10px] uppercase text-muted-foreground mt-1 font-semibold">
                          {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
                        </p>
                     </div>
                  </div>
               ))}
             </div>
           )}
        </div>
      </section>
    </div>
  )
}
