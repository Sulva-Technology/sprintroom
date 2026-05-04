'use client'

import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Zap, ShieldAlert, Ghost, Calendar, Timer } from 'lucide-react'

export function TeamHealthCard({ stats, insight }: { stats: any, insight: string }) {
  const { focusScore, focusSessionsToday, activeNow, blockedTasks, silentTasks, overdueTasks } = stats

  return (
    <Card className="glass-card border-none overflow-hidden relative">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-primary to-purple-500" />
      <div className="p-6 md:p-8 flex flex-col lg:flex-row gap-8 items-center lg:items-center">
        {/* Score & Insight */}
        <div className="flex-1 text-center lg:text-left flex flex-col items-center lg:items-start w-full">
          <div className="flex items-center gap-4 mb-4 flex-col sm:flex-row">
            <div className="relative w-20 h-20 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle className="text-muted/50 stroke-current" strokeWidth="8" cx="50" cy="50" r="40" fill="transparent" />
                <circle 
                  className="text-primary stroke-current transition-all duration-1000 ease-in-out" 
                  strokeWidth="8" 
                  strokeLinecap="round" 
                  cx="50" 
                  cy="50" 
                  r="40" 
                  fill="transparent" 
                  strokeDasharray={`${251.2 * (focusScore / 100)} 251.2`} 
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-2xl font-bold text-foreground leading-none">{focusScore}</span>
              </div>
            </div>
            <div className="text-center sm:text-left">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Focus Score</h2>
              <p className="text-lg md:text-xl font-medium text-foreground max-w-sm">
                {insight}
              </p>
            </div>
          </div>
        </div>

        {/* Mini stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 lg:gap-8 w-full lg:w-auto">
          <div className="flex flex-col items-center lg:items-start">
             <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
               <Timer className="w-3.5 h-3.5" />
               <span className="text-xs font-semibold uppercase">Focus Today</span>
             </div>
             <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-primary">
               {focusSessionsToday}
             </span>
          </div>

          <div className="flex flex-col items-center lg:items-start">
             <div className="flex items-center gap-1.5 text-emerald-600/80 mb-1">
               <Zap className="w-3.5 h-3.5" />
               <span className="text-xs font-semibold uppercase">Active Now</span>
             </div>
             <span className="text-2xl font-bold text-emerald-600">
               {activeNow}
             </span>
          </div>
          
          <div className="flex flex-col items-center lg:items-start">
             <div className="flex items-center gap-1.5 text-red-600/80 mb-1">
               <ShieldAlert className="w-3.5 h-3.5" />
               <span className="text-xs font-semibold uppercase">Blocked</span>
             </div>
             <span className="text-2xl font-bold text-red-600">
               {blockedTasks}
             </span>
          </div>

          <div className="flex flex-col items-center lg:items-start">
             <div className="flex items-center gap-1.5 text-slate-500 mb-1">
               <Ghost className="w-3.5 h-3.5" />
               <span className="text-xs font-semibold uppercase">Silent</span>
             </div>
             <span className="text-2xl font-bold text-slate-500">
               {silentTasks}
             </span>
          </div>

          <div className="flex flex-col items-center lg:items-start">
             <div className="flex items-center gap-1.5 text-amber-600/80 mb-1">
               <Calendar className="w-3.5 h-3.5" />
               <span className="text-xs font-semibold uppercase">Overdue</span>
             </div>
             <span className="text-2xl font-bold text-amber-600">
               {overdueTasks}
             </span>
          </div>
        </div>
      </div>
    </Card>
  )
}
