'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ShieldAlert, Clock, ArrowRight, FolderKanban } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

export function BlockerBoard({ blockedTasks }: { blockedTasks: any[] }) {
  if (blockedTasks.length === 0) return null

  // Group by owner
  const groups = blockedTasks.reduce((acc, task) => {
    const ownerId = task.owner?.id || 'unassigned'
    if (!acc[ownerId]) {
      acc[ownerId] = {
        owner: task.owner,
        tasks: []
      }
    }
    acc[ownerId].tasks.push(task)
    return acc
  }, {} as Record<string, { owner: any, tasks: any[] }>)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <ShieldAlert className="w-5 h-5 text-red-500" />
        <h3 className="text-lg font-bold">Needs Attention</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.values(groups).map((group: any) => (
          <div key={group.owner?.id || 'unassigned'} className="space-y-4">
             <div className="flex items-center gap-3">
               <Avatar className="h-8 w-8">
                 <AvatarImage src={group.owner?.avatar_url} />
                 <AvatarFallback className="bg-red-100 text-red-700 text-xs font-bold">
                   {group.owner?.initials || '?'}
                 </AvatarFallback>
               </Avatar>
               <span className="font-semibold text-sm">{group.owner?.name || 'Unassigned'}</span>
             </div>

             <div className="space-y-3">
               {group.tasks.map((task: any) => (
                 <Card key={task.id} className="p-4 bg-red-50/50 border-red-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
                    
                    <div className="flex items-start justify-between mb-2">
                       <Badge variant="outline" className="bg-white border-red-200 text-red-700 font-semibold text-[10px] uppercase shadow-sm">
                         Blocked
                       </Badge>
                       <div className="flex items-center text-[11px] text-muted-foreground font-medium bg-white px-2 py-0.5 rounded border shadow-sm">
                         <Clock className="w-3 h-3 mr-1" />
                         {formatDistanceToNow(new Date(task.updated_at))}
                       </div>
                    </div>

                    <h4 className="font-bold text-foreground mb-1 leading-tight">{task.title}</h4>
                    
                    <div className="bg-white rounded-lg p-2.5 border border-red-100 shadow-sm mt-3 mb-4 relative">
                       <div className="absolute -top-2 left-3 bg-white px-1 text-[10px] font-bold text-red-600 uppercase tracking-widest">Reason</div>
                       <p className="text-sm text-red-900/80 font-medium leading-relaxed align-middle">
                         {task.blocked_reason || 'No reason provided.'}
                       </p>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded shadow-sm border">
                        <FolderKanban className="w-3 h-3" />
                        <span className="max-w-[120px] truncate">{task.project?.name}</span>
                      </div>
                      
                      <Button size="sm" variant="outline" className="h-7 text-xs bg-white text-slate-700 hover:text-primary hover:bg-slate-50 transition-colors shadow-sm" render={<Link href={`/dashboard/projects/${task.project_id}`} />}>
                         View <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                 </Card>
               ))}
             </div>
          </div>
        ))}
      </div>
    </div>
  )
}
