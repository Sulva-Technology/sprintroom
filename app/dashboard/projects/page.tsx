import { createClient } from '@/lib/supabase/server'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CreateProjectDialog } from './create-project-dialog'
import { ProjectsList } from './projects-list'
import { canEditWorkspace } from '@/app/actions/roles'
import { CacheWriter } from '@/components/offline/cache-writer'
import { resolveActiveWorkspaceId } from '@/lib/workspace/active-workspace'

function initialsOf(name?: string | null) {
  if (!name) return '?'
  return name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
}

export default async function ProjectsPage({ searchParams }: { searchParams?: Promise<{ new?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const resolvedSearchParams = await searchParams
  const shouldOpenCreateDialog = resolvedSearchParams?.new === 'true'

  // Scope to the ACTIVE workspace only. Previously this listed projects (and
  // members) from every workspace the user belonged to, so switching the
  // workspace switcher never changed what appeared here.
  const activeWorkspaceId = await resolveActiveWorkspaceId()

  const { data: projectsRaw } = activeWorkspaceId
    ? await supabase
        .from('projects')
        .select('*, tasks(*), focus_sessions(count)')
        .eq('workspace_id', activeWorkspaceId)
        .order('created_at', { ascending: false })
    : { data: [] }

  const projects = projectsRaw || []

  // Viewers can browse projects but not create them.
  const canEdit = await canEditWorkspace()

  // Fetch real workspace members (with profiles) so project cards show who's on
  // each project instead of an empty avatar stack.
  const { data: memberRows } = activeWorkspaceId
    ? await supabase.from('workspace_members').select('workspace_id, user_id').eq('workspace_id', activeWorkspaceId)
    : { data: [] }

  const memberUserIds = Array.from(new Set((memberRows || []).map((m: any) => m.user_id)))
  const { data: memberProfiles } = memberUserIds.length > 0
    ? await supabase.from('profiles').select('id, full_name, avatar_url').in('id', memberUserIds)
    : { data: [] }

  const profileById = new Map((memberProfiles || []).map((p: any) => [p.id, p]))
  const membersByWorkspace = new Map<string, any[]>()
  for (const m of memberRows || []) {
    const arr = membersByWorkspace.get(m.workspace_id) || []
    const p: any = profileById.get(m.user_id)
    arr.push({ init: initialsOf(p?.full_name), full_name: p?.full_name || null, avatar_url: p?.avatar_url || null })
    membersByWorkspace.set(m.workspace_id, arr)
  }

  // Decorate projects with stats
  const enrichedProjects = projects.map(p => {
    const tasks = p.tasks || []
    const totalTasks = tasks.length
    const doneTasks = tasks.filter((t: any) => t.status === 'done').length
    const blockedTasks = tasks.filter((t: any) => t.status === 'blocked').length

    const now = new Date()
    const overdueTasks = tasks.filter((t: any) => {
      if (t.status === 'done' || !t.deadline) return false
      return new Date(t.deadline) < now
    }).length

    // We mock completed sessions based on length since we don't fetch focus_sessions fully here, or we use count
    // The `focus_sessions(count)` might do a left join count, let's treat it safely
    const completedSessions = p.focus_sessions?.[0]?.count || 0

    const lastActivity = p.updated_at
    const members = (membersByWorkspace.get(p.workspace_id) || []).slice(0, 4)

    return {
      ...p,
      stats: { totalTasks, doneTasks, blockedTasks, overdueTasks, completedSessions },
      lastActivity,
      members
    }
  })

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full mx-auto pb-12">
      {/* Caching the full project list here (not just the layout's 5 recents)
          is what lets the route warmer pre-cache every board for offline use. */}
      <CacheWriter projects={projects} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground mb-1">Projects</h1>
          <p className="text-muted-foreground font-medium text-sm md:text-base">
            Track task movement, blockers, and focus effort across your workspace.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          {canEdit && <CreateProjectDialog defaultOpen={shouldOpenCreateDialog} />}
        </div>
      </div>

      {/* Empty state is rendered by ProjectsList: it derives the real list from
          the offline cache + pending sync queue, which the server cannot see. */}
      <ProjectsList
        projects={enrichedProjects}
        canEdit={canEdit}
        shouldOpenCreateDialog={shouldOpenCreateDialog}
      />
    </div>
  )
}