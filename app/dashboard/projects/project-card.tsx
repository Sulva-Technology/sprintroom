'use client'

import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ArrowRight, ShieldAlert, Timer, CheckCircle2, Clock } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

export function ProjectCard({ project }: { project: any }) {
  const { stats, members, lastActivity } = project
  const { totalTasks, doneTasks, blockedTasks, overdueTasks, completedSessions } = stats

  const progress = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100)
  
  // Health computation
  const daysSinceActivity = (new Date().getTime() - new Date(lastActivity).getTime()) / (1000 * 3600 * 24)
  let health: 'on_track' | 'blocked' | 'quiet' | 'finishing' = 'on_track'
  
  if (blockedTasks > 0) health = 'blocked'
  else if (daysSinceActivity > 3) health = 'quiet'
  else if (progress >= 80) health = 'finishing'

  const healthConfig = {
    on_track: { label: 'On track', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    blocked: { label: 'Blocked', class: 'bg-red-50 text-red-700 border-red-200' },
    quiet: { label: 'Quiet', class: 'bg-slate-100 text-slate-600 border-slate-200' },
    finishing: { label: 'Finishing', class: 'bg-indigo-50 text-indigo-700 border-indigo-200' }
  }

  const h = healthConfig[health]

  return (
    <div className="bg-white border border-border/50 rounded-3xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col h-full group">
      {/* Top */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1 pr-4">
          <Link href={`/dashboard/projects/${project.id}`}>
            <h3 className="text-xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors inline-block">{project.name}</h3>
          </Link>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{project.description || 'No description provided.'}</p>
        </div>
        <div className={cn("shrink-0 text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border", h.class)}>
          {h.label}
        </div>
      </div>

      {/* Middle */}
      <div className="flex-1 space-y-5">
        <div className="space-y-2">
          <div className="flex justify-between text-sm font-semibold">
            <span className="text-slate-600">Progress</span>
            <span className="text-slate-900">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="grid grid-cols-2 gap-y-3 gap-x-4">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="font-medium text-slate-700">{doneTasks} <span className="text-slate-400">/ {totalTasks} done</span></span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Timer className="w-4 h-4 text-primary" />
            <span className="font-medium text-slate-700">{completedSessions} <span className="text-slate-400">sessions</span></span>
          </div>
          {blockedTasks > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <ShieldAlert className="w-4 h-4 text-red-500" />
              <span className="font-medium text-red-700">{blockedTasks} <span className="text-red-400/80">blocked</span></span>
            </div>
          )}
          {overdueTasks > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="font-medium text-amber-700">{overdueTasks} <span className="text-amber-500/80">overdue</span></span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom */}
      <div className="flex items-center justify-between mt-8 pt-4 border-t border-slate-100">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {members.map((m: any, i: number) => (
              <Avatar key={i} className="w-7 h-7 border-2 border-white">
                <AvatarFallback className="text-[10px] bg-slate-100 text-slate-600 font-bold">{m.init}</AvatarFallback>
              </Avatar>
            ))}
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            Active {formatDistanceToNow(new Date(lastActivity), { addSuffix: true })}
          </span>
        </div>
        <Button size="sm" variant="ghost" render={<Link href={`/dashboard/projects/${project.id}`} />} className="rounded-full hover:bg-slate-50 text-slate-600 font-semibold px-3 h-8">
            Open <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
        </Button>
      </div>
    </div>
  )
}
