import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Timer } from "lucide-react"

export function ActiveNow({ activeSessions }: { activeSessions: any[] }) {
  if (!activeSessions || activeSessions.length === 0) {
    return (
      <div className="bg-white border border-border/50 rounded-2xl p-6 text-center shadow-sm h-full flex flex-col justify-center items-center">
        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mb-3">
          <Timer className="w-5 h-5 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">Nobody is focusing right now.</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-border/50 rounded-2xl shadow-sm p-5 space-y-4">
      <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
        </span>
        Active Now
      </h3>
      <div className="space-y-3">
        {activeSessions.map((session, i) => {
          const userInitial = session.user?.full_name?.[0]?.toUpperCase() || 'U'
          return (
            <div key={i} className="flex items-center gap-3">
              <Avatar className="h-8 w-8 border border-border mt-0.5 self-start">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{userInitial}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate leading-tight">
                  {session.user?.full_name || 'Teammate'} <span className="text-muted-foreground font-normal">is focusing on</span> {session.task?.title || 'a task'}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                     <div className="h-full bg-emerald-500 rounded-full w-2/3" />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground tracking-wider">18:42 left</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
