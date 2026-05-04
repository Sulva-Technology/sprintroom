import { Button } from "@/components/ui/button"
import { Timer, CheckCircle2 } from "lucide-react"

export function MyFocusQueue({ tasks }: { tasks: any[] }) {
  if (!tasks || tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-white border border-border/50 rounded-2xl text-center shadow-sm">
        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-6 h-6 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-lg">Your execution room is quiet.</h3>
        <p className="text-muted-foreground text-sm mt-1 mb-4">No active tasks assigned to you right now.</p>
        <Button className="rounded-xl shadow-sm">Create first task</Button>
      </div>
    )
  }

  return (
    <div className="bg-white border border-border/50 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-4 border-b border-border/50 bg-slate-50/50">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
           <Timer className="w-4 h-4 text-primary" />
           My Focus Queue
        </h3>
      </div>
      <div className="divide-y divide-border/50">
        {tasks.map(task => (
          <div key={task.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4 group">
             <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                   <h4 className="font-medium text-sm text-foreground truncate">{task.title}</h4>
                   <span className="text-[10px] uppercase font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-sm border border-amber-200 shrink-0">doing</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{task.description || 'No description provided.'}</p>
             </div>
             <Button size="sm" variant="outline" className="shrink-0 rounded-lg shadow-sm border-border bg-white text-xs opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100">
               Start Focus
             </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
