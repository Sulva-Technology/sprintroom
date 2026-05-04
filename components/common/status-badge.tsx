import { cn } from "@/lib/utils"

export type TaskStatus = 'backlog' | 'today' | 'doing' | 'blocked' | 'review' | 'done'

interface StatusBadgeProps {
  status: TaskStatus
  className?: string
}

const statusConfig: Record<TaskStatus, { label: string, dot: string, bg: string, text: string }> = {
  backlog: { label: 'Backlog', dot: 'bg-slate-400', bg: 'bg-slate-100', text: 'text-slate-700' },
  today: { label: 'Today', dot: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700' },
  doing: { label: 'Doing', dot: 'bg-purple-500', bg: 'bg-purple-50', text: 'text-purple-700' },
  blocked: { label: 'Blocked. Needs attention.', dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700' },
  review: { label: 'Review', dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700' },
  done: { label: 'Done', dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.backlog
  
  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase transition-colors shadow-sm border",
      config.bg, 
      config.text,
      `border-${config.text.split('-')[1]}-200`,
      className
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full", config.dot)} aria-hidden="true" />
      {config.label}
    </div>
  )
}
