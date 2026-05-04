import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface EmptyStateProps {
  icon: React.ElementType
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
  className?: string
}

export function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  actionLabel, 
  actionHref, 
  onAction,
  className 
}: EmptyStateProps) {
  const content = (
    <>
      <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 shadow-inner ring-1 ring-slate-200/50">
        <Icon className="w-6 h-6 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1.5">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs">{description}</p>
      
      {actionLabel && (actionHref || onAction) && (
        <div className="mt-6">
          {actionHref ? (
            <Button render={<Link href={actionHref} />} variant="outline" className="rounded-xl shadow-sm bg-white hover:bg-slate-50">
              {actionLabel}
            </Button>
          ) : (
            <Button onClick={onAction} variant="outline" className="rounded-xl shadow-sm bg-white hover:bg-slate-50">
              {actionLabel}
            </Button>
          )}
        </div>
      )}
    </>
  )

  return (
    <div className={cn("w-full flex justify-center", className)}>
      <div className="flex flex-col items-center justify-center text-center p-8 bg-white border border-dashed border-border rounded-3xl max-w-md w-full">
        {content}
      </div>
    </div>
  )
}
