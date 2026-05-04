import { Activity, ShieldAlert, Timer, Users, LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  trend?: string
  trendUp?: boolean
  accentClass?: string
  bgAccentClass?: string
}

export function StatCard({ title, value, icon: Icon, trend, trendUp, accentClass = "text-primary", bgAccentClass = "bg-primary/10" }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-border/50 shadow-sm flex flex-col transition-shadow hover:shadow-md">
      <div className="flex justify-between items-start mb-4">
        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", bgAccentClass, accentClass)}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border", 
            trendUp ? "text-emerald-700 bg-emerald-50 border-emerald-100" : "text-amber-700 bg-amber-50 border-amber-100"
          )}>
            {trend}
          </span>
        )}
      </div>
      <div>
        <h3 className="text-3xl font-bold tracking-tight text-foreground">{value}</h3>
        <p className="text-sm font-medium text-muted-foreground mt-1">{title}</p>
      </div>
    </div>
  )
}
