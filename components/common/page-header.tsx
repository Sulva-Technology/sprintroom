import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8", className)}>
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground mb-1">{title}</h1>
        {subtitle && (
          <p className="text-muted-foreground font-medium text-sm md:text-base">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-3">
          {actions}
        </div>
      )}
    </div>
  )
}
