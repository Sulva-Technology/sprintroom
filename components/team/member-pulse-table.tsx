'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { formatDistanceToNow } from 'date-fns'

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'Focusing now':
      return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none px-2 shadow-none font-semibold uppercase text-[10px]">Focusing now</Badge>
    case 'Moving':
      return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none px-2 shadow-none font-semibold uppercase text-[10px]">Moving</Badge>
    case 'Blocked':
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none px-2 shadow-none font-semibold uppercase text-[10px]">Blocked</Badge>
    case 'Silent':
      return <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-100 border-none px-2 shadow-none font-semibold uppercase text-[10px]">Silent</Badge>
    case 'Overloaded':
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none px-2 shadow-none font-semibold uppercase text-[10px]">Overloaded</Badge>
    default:
      return null
  }
}

export function MemberPulseTable({ members }: { members: any[] }) {
  return (
    <div className="w-full">
      <div className="hidden md:block overflow-hidden bg-white rounded-2xl border border-border shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-slate-50 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-semibold tracking-wider">Member</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Status</th>
                <th className="px-6 py-4 font-semibold tracking-wider text-center">Focus Today</th>
                <th className="px-6 py-4 font-semibold tracking-wider text-center">Assigned</th>
                <th className="px-6 py-4 font-semibold tracking-wider text-center">Done this week</th>
                <th className="px-6 py-4 font-semibold tracking-wider text-center">Blocked</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Last Activity</th>
                <th className="px-6 py-4 font-semibold tracking-wider w-1/4">Insight</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3 w-max">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={member.avatar_url} />
                        <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
                           {member.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-foreground leading-none mb-1">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={member.status} />
                  </td>
                  <td className="px-6 py-4 text-center font-medium text-foreground">
                     {member.focusToday}
                  </td>
                  <td className="px-6 py-4 text-center font-medium text-foreground">
                     {member.assignedTasks}
                  </td>
                  <td className="px-6 py-4 text-center font-medium text-foreground">
                     {member.doneThisWeek}
                  </td>
                  <td className="px-6 py-4 text-center font-medium">
                     {member.blocked > 0 ? (
                       <span className="text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-100">{member.blocked}</span>
                     ) : (
                       <span className="text-slate-400">0</span>
                     )}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground text-xs whitespace-nowrap">
                    {member.lastActivity ? formatDistanceToNow(new Date(member.lastActivity), { addSuffix: true }) : 'Never'}
                  </td>
                  <td className="px-6 py-4">
                     <p className="text-xs text-foreground/80 font-medium leading-relaxed">{member.insight}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {members.map((member) => (
          <Card key={member.id} className="p-4 bg-white border-border shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={member.avatar_url} />
                  <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
                     {member.initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold text-foreground leading-none mb-1">{member.name}</p>
                  <StatusBadge status={member.status} />
                </div>
              </div>
            </div>
            
            <p className="text-sm font-medium text-foreground/90 bg-muted/30 p-3 rounded-lg border border-border/50 mb-4">
              {member.insight}
            </p>

            <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-3 rounded-lg border border-border/50">
               <div>
                  <span className="text-muted-foreground block text-xs font-semibold uppercase mb-1">Focus Today</span>
                  <span className="font-bold">{member.focusToday}</span>
               </div>
               <div>
                  <span className="text-muted-foreground block text-xs font-semibold uppercase mb-1">Assigned</span>
                  <span className="font-bold">{member.assignedTasks}</span>
               </div>
               <div>
                  <span className="text-muted-foreground block text-xs font-semibold uppercase mb-1">Blocked</span>
                  <span className="font-bold">{member.blocked > 0 ? <span className="text-red-500">{member.blocked}</span> : '0'}</span>
               </div>
               <div>
                  <span className="text-muted-foreground block text-xs font-semibold uppercase mb-1">Last Activity</span>
                  <span className="font-medium text-xs">{member.lastActivity ? formatDistanceToNow(new Date(member.lastActivity), { addSuffix: true }) : 'Never'}</span>
               </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
