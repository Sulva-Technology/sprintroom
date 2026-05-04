import { cn } from "@/lib/utils"

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

interface PriorityBadgeProps {
  priority: TaskPriority
  className?: string
}

const priorityConfig: Record<TaskPriority, { label: string, bg: string, text: string, border: string }> = {
  urgent: { label: 'Urgent', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  high: { label: 'High', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  medium: { label: 'Medium', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  low: { label: 'Low', bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const config = priorityConfig[priority] || priorityConfig.medium
  
  return (
    <div className={cn(
      "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border shadow-sm",
      config.bg, 
      config.text,
      config.border,
      className
    )}>
      {config.label}
    </div>
  )
}
