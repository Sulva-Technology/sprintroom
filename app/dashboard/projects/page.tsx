import { createClient } from '@/lib/supabase/server'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ProjectCard } from './project-card'
import { CreateProjectDialog } from './create-project-dialog'

export default async function ProjectsPage({ searchParams }: { searchParams?: Promise<{ new?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const resolvedSearchParams = await searchParams
  const shouldOpenCreateDialog = resolvedSearchParams?.new === 'true'

  // Fetch workspace memberships and projects in parallel if possible
  const { data: workspacesRaw } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)

  const workspaceIds = workspacesRaw?.map(w => w.workspace_id) || []

  const { data: projectsRaw } = workspaceIds.length > 0
    ? await supabase
        .from('projects')
        .select('*, tasks(*), focus_sessions(count)')
        .in('workspace_id', workspaceIds)
        .order('created_at', { ascending: false })
    : { data: [] }

  const projects = projectsRaw || []

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

    // Fake last activity and members for the ui demonstration
    const lastActivity = p.updated_at
    const members: any[] = []

    return {
      ...p,
      stats: { totalTasks, doneTasks, blockedTasks, overdueTasks, completedSessions },
      lastActivity,
      members
    }
  })

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground mb-1">Projects</h1>
          <p className="text-muted-foreground font-medium text-sm md:text-base">
            Track task movement, blockers, and focus effort across your workspace.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
             <Input placeholder="Search projects..." className="pl-9 bg-white shadow-sm rounded-xl h-10 w-full focus-visible:ring-primary/20" />
          </div>
          <CreateProjectDialog defaultOpen={shouldOpenCreateDialog} />
        </div>
      </div>

      {enrichedProjects.length === 0 ? (
        <div className="bg-white border border-border/50 rounded-3xl p-12 shadow-sm text-center max-w-2xl mx-auto mt-12 flex flex-col items-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
            <Plus className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground mb-3">Create your first project.</h2>
          <p className="text-muted-foreground font-medium mb-8 max-w-md">
            Projects keep your team’s tasks, focus sessions, blockers, and progress proof in one place.
          </p>
          <CreateProjectDialog defaultOpen={shouldOpenCreateDialog} trigger={<Button className="rounded-xl shadow-sm px-6 h-11 text-base">Create project</Button>} />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {enrichedProjects.map(project => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}