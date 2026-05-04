'use client'

import { useState } from 'react'
import { formatDistanceToNow, isPast } from 'date-fns'
import { Timer, MessageSquare, AlertCircle } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { StatusMenu } from './status-menu'
import { TaskDetailDrawer } from '@/components/tasks/task-detail-drawer'

export function TaskCard({ task, projectId }: { task: any, projectId: string }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const isOverdue = task.deadline && isPast(new Date(task.deadline)) && task.status !== 'done'
  
  // Fake owner profile for now
  const ownerInitials = task.owner_id ? 'U' : '?'
  
  const completedPomodoros = task.completed_pomodoros || 0

  return (
    <>
      <div 
        onClick={() => setDrawerOpen(true)}
        className={cn(
          "bg-white rounded-2xl p-4 shadow-sm border transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 group cursor-pointer",
          task.status === 'blocked' ? "border-l-4 border-l-red-500 border-y-border border-r-border" : "border-border/60",
          task.status === 'done' && "opacity-60 hover:opacity-100 bg-slate-50 border-transparent shadow-none"
        )}
      >
        
        {/* Top Labels */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex gap-1.5 flex-wrap">
            {task.priority === 'high' && <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">High</span>}
            {isOverdue && <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-md"><AlertCircle className="w-3 h-3"/> Overdue</span>}
          </div>
          <div onClick={e => e.stopPropagation()}>
            <StatusMenu task={task} projectId={projectId} />
          </div>
        </div>

        {/* Content */}
        <h4 className={cn("font-medium text-sm text-foreground mb-1 leading-snug", task.status === 'done' && "line-through text-slate-500")}>
          {task.title}
        </h4>
        
        {task.status === 'blocked' && task.blocked_reason && (
          <div className="mt-2 text-xs font-medium text-red-700 bg-red-50 border border-red-100 p-2 rounded-lg line-clamp-2 leading-relaxed">
            {task.blocked_reason}
          </div>
        )}

        {/* Progress Footer */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-3">
            <Avatar className="w-6 h-6 border bg-slate-100 text-slate-600 font-bold outline-1 outline-offset-1 outline-transparent group-hover:outline-slate-200 transition-all">
              {task.owner_id ? <AvatarFallback className="text-[9px]">{ownerInitials}</AvatarFallback> : <AvatarFallback className="text-[9px] bg-dashed border border-slate-300 bg-slate-50 text-slate-400">?</AvatarFallback>}
            </Avatar>
            
            {task.estimate_pomodoros > 0 && (
              <div className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                <span className={cn("w-1.5 h-1.5 rounded-full", completedPomodoros >= task.estimate_pomodoros ? "bg-emerald-500" : "bg-slate-300")} />
                {completedPomodoros} / {task.estimate_pomodoros}
              </div>
            )}
          </div>

          {task.status !== 'done' && task.status !== 'blocked' && (
             <Button size="sm" variant="ghost" className="h-7 px-2 text-xs font-semibold text-primary hover:bg-primary/5 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity">
              <Timer className="w-3.5 h-3.5 mr-1" /> Focus
             </Button>
          )}
        </div>

      </div>

      <TaskDetailDrawer 
        taskId={task.id} 
        projectId={projectId} 
        open={drawerOpen} 
        onOpenChange={setDrawerOpen} 
      />
    </>
  )
}

