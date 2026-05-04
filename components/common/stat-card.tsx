import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"

interface StatCardProps {
  icon: React.ElementType
  label: string
  value: string | number
  helper?: string
  tone?: 'neutral' | 'positive' | 'negative' | 'warning'
  className?: string
}

const toneConfig = {
  neutral: { 
    bg: 'bg-slate-50', 
    iconBg: 'bg-slate-100', 
    iconText: 'text-slate-600',
    valueText: 'text-foreground'
  },
  positive: { 
    bg: 'bg-emerald-50/50', 
    iconBg: 'bg-emerald-100', 
    iconText: 'text-emerald-600',
    valueText: 'text-emerald-700'
  },
  negative: { 
    bg: 'bg-red-50/50', 
    iconBg: 'bg-red-100', 
    iconText: 'text-red-600',
    valueText: 'text-red-700'
  },
  warning: { 
    bg: 'bg-amber-50/50', 
    iconBg: 'bg-amber-100', 
    iconText: 'text-amber-600',
    valueText: 'text-amber-700'
  }
}

export function StatCard({ icon: Icon, label, value, helper, tone = 'neutral', className }: StatCardProps) {
  const config = toneConfig[tone]

  return (
    <Card className={cn("glass-card shadow-sm border border-border p-5 rounded-2xl flex flex-col", config.bg, className)}>
      <div className="flex items-center gap-3 mb-4">
        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", config.iconBg, config.iconText)}>
          <Icon className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{label}</h3>
      </div>
      
      <div className="flex items-baseline gap-2 mt-auto">
        <span className={cn("text-3xl font-bold tracking-tight", config.valueText)}>{value}</span>
        {helper && (
          <span className="text-xs font-medium text-muted-foreground">{helper}</span>
        )}
      </div>
    </Card>
  )
}
