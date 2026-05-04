'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface BoardColumnProps {
  status: string
  config: { label: string, color: string, emptyMsg: string }
  count: number
  children: ReactNode
}

export function BoardColumn({ status, config, count, children }: BoardColumnProps) {
  return (
    <div className="flex flex-col w-[280px] shrink-0 snap-start h-full">
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <span className={cn("text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md", config.color)}>
            {config.label}
          </span>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
            {count}
          </span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto pb-4 scrollbar-hide">
        {children}
      </div>
    </div>
  )
}
