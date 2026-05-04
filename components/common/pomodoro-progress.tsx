import { cn } from "@/lib/utils"
import { Timer } from "lucide-react"

interface PomodoroProgressProps {
  completed: number
  estimate: number
  className?: string
}

export function PomodoroProgress({ completed, estimate, className }: PomodoroProgressProps) {
  // Gracefully handle 0 estimate
  const max = Math.max(completed, estimate || 1)
  const percentage = Math.min(100, Math.round((completed / max) * 100))
  
  return (
    <div className={cn("flex flex-col gap-1.5 w-full", className)}>
      <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
        <div className="flex items-center gap-1.5">
          <Timer className="w-3.5 h-3.5" />
          <span>{completed} / {estimate || 0} focus blocks</span>
        </div>
        <span>{percentage}%</span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div 
          className="h-full bg-emerald-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
