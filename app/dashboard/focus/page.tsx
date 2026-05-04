import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Timer, CheckCircle2, XCircle, AlertTriangle, Coffee, ArrowRight, Zap, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/dashboard/stat-card'
import { formatDistanceToNow, format } from 'date-fns'
import Link from 'next/link'

export default async function FocusSessionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch recent focus sessions
  const { data: sessions } = await supabase
    .from('focus_sessions')
    .select('*, tasks(title, project_id, projects(name))')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })
    .limit(20)

  // Compute stats
  const completedSessions = sessions?.filter(s => s.status === 'completed') || []
  const totalMinutes = completedSessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0)
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  
  const focusTimeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`

  const stats = {
    totalSessions: completedSessions.length,
    focusTime: focusTimeStr,
    avgDistractions: completedSessions.length > 0 
      ? (completedSessions.reduce((acc, s) => acc + (s.distractions_count || 0), 0) / completedSessions.length).toFixed(1)
      : '0',
    meaningfulRate: completedSessions.length > 0
      ? Math.round((completedSessions.filter(s => s.is_meaningful).length / completedSessions.length) * 100)
      : 0
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground mb-1">Focus Sessions</h1>
          <p className="text-muted-foreground font-medium text-sm md:text-base">
            Track your deep work intervals and distraction trends.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Sessions" value={stats.totalSessions} icon={History} bgAccentClass="bg-blue-100" accentClass="text-blue-600" />
        <StatCard title="Focus Time" value={stats.focusTime} icon={Timer} bgAccentClass="bg-emerald-100" accentClass="text-emerald-600" />
        <StatCard title="Avg Distractions" value={stats.avgDistractions} icon={Zap} bgAccentClass="bg-amber-100" accentClass="text-amber-600" />
        <StatCard title="Meaningful Work" value={`${stats.meaningfulRate}%`} icon={CheckCircle2} bgAccentClass="bg-purple-100" accentClass="text-purple-600" />
      </div>

      {/* Sessions List */}
      <div className="bg-white border border-border/50 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border/20 flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">Recent Sessions</h2>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Last 20 sessions</span>
        </div>

        {!sessions || sessions.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 border border-dashed border-slate-200">
                <Coffee className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">No focus sessions yet</h3>
            <p className="text-muted-foreground text-sm max-w-sm mb-8">
              Start your first Pomodoro session from any task to see your focus history here.
            </p>
            <Button variant="outline" className="rounded-xl" render={<Link href="/dashboard/projects" />}>
                Go to Projects
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/10">
            {sessions.map((session) => {
              const task = session.tasks as any
              const project = task?.projects as any
              
              return (
                <div key={session.id} className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                      session.status === 'completed' ? "bg-emerald-50 border-emerald-100 text-emerald-600" :
                      session.status === 'cancelled' ? "bg-red-50 border-red-100 text-red-600" :
                      session.status === 'abandoned' ? "bg-amber-50 border-amber-100 text-amber-600" :
                      "bg-blue-50 border-blue-100 text-blue-600"
                    )}>
                      {session.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> :
                       session.status === 'cancelled' ? <XCircle className="w-5 h-5" /> :
                       session.status === 'abandoned' ? <AlertTriangle className="w-5 h-5" /> :
                       <Timer className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground leading-snug">
                        {task?.title || 'Unknown Task'}
                      </h4>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs font-medium text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-slate-200" />
                          {project?.name || 'No Project'}
                        </span>
                        <span>•</span>
                        <span>{formatDistanceToNow(new Date(session.started_at), { addSuffix: true })}</span>
                        <span>•</span>
                        <span>{session.duration_minutes}m duration</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 justify-between md:justify-end">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-0.5">Status</p>
                      <p className={cn(
                        "text-sm font-bold",
                        session.status === 'completed' ? "text-emerald-600" :
                        session.status === 'cancelled' ? "text-red-600" :
                        session.status === 'abandoned' ? "text-amber-600" :
                        "text-blue-600"
                      )}>
                        {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                      </p>
                    </div>

                    <div className="text-right">
                       {session.distractions_count > 0 && (
                         <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-amber-100">
                            <Zap className="w-3 h-3" />
                            {session.distractions_count} distractions
                         </div>
                       )}
                    </div>

                    <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 text-slate-400 hover:text-primary hover:bg-primary/5" render={<Link href={`/dashboard/projects/${task?.project_id}`} />}>
                       <ArrowRight className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ')
}
