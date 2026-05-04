'use client'

import { Card } from '@/components/ui/card'
import { Ghost, Clock, FolderKanban } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatDistanceToNow } from 'date-fns'

export function SilentWork({ silentTasks }: { silentTasks: any[] }) {
  if (silentTasks.length === 0) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Ghost className="w-5 h-5 text-slate-500" />
        <h3 className="text-lg font-bold text-foreground">Silent Work</h3>
      </div>
      <p className="text-sm font-medium text-muted-foreground max-w-2xl bg-white p-4 rounded-xl border border-border shadow-sm mb-6 border-l-[3px] border-l-slate-400">
        These tasks are listed as &quot;Doing&quot;, but no one has logged a focus session or updated them in 24+ hours. They look alive, but nothing has moved recently.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
         {silentTasks.map(task => (
           <Card key={task.id} className="p-4 bg-slate-50/50 border-border group hover:bg-white transition-colors shadow-sm">
             <div className="flex items-start justify-between mb-3">
               <Avatar className="h-6 w-6">
                 <AvatarImage src={task.owner?.avatar_url} />
                 <AvatarFallback className="bg-slate-200 text-slate-600 text-[10px] font-bold">
                   {task.owner?.initials || '?'}
                 </AvatarFallback>
               </Avatar>
               <div className="flex items-center text-[10px] uppercase font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded shadow-sm border">
                 <Clock className="w-3 h-3 mr-1" />
                 {formatDistanceToNow(new Date(task.updated_at))}
               </div>
             </div>

             <h4 className="font-semibold text-sm mb-3 min-h-[40px]">{task.title}</h4>

             <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
               <FolderKanban className="w-3 h-3 text-slate-400" />
               <span className="truncate">{task.project?.name}</span>
             </div>
           </Card>
         ))}
      </div>
    </div>
  )
}
