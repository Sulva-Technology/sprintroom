import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Activity, Plus, Timer, ShieldAlert, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import Link from 'next/link'
import { BoardClient } from './board-client'
import { ErrorBoundary } from '@/components/error-boundary'
import { RecurringTaskDialog } from './recurring-task-dialog'

export default async function ProjectBoardPage({ params }: { params: Promise<{ projectId: string }> }) {
  const supabase = await createClient()

  let user = null;
  try {
    const { data: { user: fetchedUser }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.error('Error fetching user:', userError);
    } else {
      user = fetchedUser;
    }
  } catch (e: any) {
    console.error('Exception fetching user:', e);
  }

  if (!user) return null

  const resolvedParams = await params

  let project = null;
  try {
    // Fetch project details
    const { data: fetchedProject, error: projectError } = await supabase
      .from('projects')
      .select('*, tasks(id, title, description, status, owner_id, priority, deadline, blocked_reason)') // Optimized tasks selection
      .eq('id', resolvedParams.projectId)
      .single();

    if (projectError) {
      console.error('Error fetching project:', projectError);
      return notFound(); // Or a more specific error page
    } else {
      project = fetchedProject;
    }
  } catch (e: any) {
    console.error('Exception fetching project:', e);
    return notFound(); // Or a more specific error page
  }

  if (!project) return notFound()

  let workspaceMembers: any[] = [];
  try {
    // In a real app we fetch workspace_members. We'll simulate team members here for assignment.
    const { data: fetchedMembers, error: membersError } = await supabase
      .from('workspace_members')
      .select('user_id, role')
      .eq('workspace_id', project.workspace_id);

    if (membersError) {
      console.error('Error fetching workspace members:', membersError);
    } else if (fetchedMembers) {
      workspaceMembers = fetchedMembers;
    }
  } catch (e: any) {
    console.error('Exception fetching workspace members:', e);
  }

  const tasks = project.tasks || []
  const totalTasks = tasks.length
  const doneTasks = tasks.filter((t: any) => t.status === 'done').length
  const blockedTasks = tasks.filter((t: any) => t.status === 'blocked').length

  const progress = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100)

  // Aggregate completed sessions for this project. Needs focus_sessions join in reality. We mock it for the UI.
  const completedSessions = 0

  return (
    <div className="h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6 shrink-0 pr-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
             <Link href="/dashboard/projects" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
               Projects
             </Link>
             <span className="text-muted-foreground">/</span>
             <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">{project.name}</h1>
          </div>
          <p className="text-muted-foreground font-medium text-sm md:text-base max-w-2xl">
            {project.description || 'No description provided.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row justify-end items-start md:items-center gap-6 md:gap-8 w-full md:w-auto">
           {/* Mini Stats */}
           <div className="flex gap-6">
              <div className="flex items-center gap-2">
                 <Progress value={progress} className="w-16 h-2" />
                 <span className="text-sm font-bold text-foreground">{progress}%</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                 <Timer className="w-4 h-4 text-primary" />
                 <span className="font-bold text-foreground">{completedSessions} <span className="text-muted-foreground font-medium">sessions</span></span>
              </div>
              {blockedTasks > 0 && (
                <div className="flex items-center gap-1.5 text-sm">
                   <ShieldAlert className="w-4 h-4 text-red-500" />
                   <span className="font-bold text-red-600">{blockedTasks} <span className="text-red-500/80 font-medium">blocked</span></span>
                </div>
              )}
           </div>

           {/* Actions */}
           <div className="flex items-center gap-3">
             <RecurringTaskDialog projectId={project.id} />
             <Button variant="outline" size="sm" render={<Link href="/dashboard/team" />} className="rounded-full shadow-sm bg-white hover:bg-slate-50 border-border h-9">
                 <Activity className="w-4 h-4 mr-2" />
                 View Pulse
             </Button>
             {/* Note: New Task button is implemented inside BoardClient because it uses the dialog state */}
           </div>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4 snap-x">
         <ErrorBoundary>
            <BoardClient project={project} initialTasks={tasks} />
         </ErrorBoundary>
      </div>
    </div>
  )
}