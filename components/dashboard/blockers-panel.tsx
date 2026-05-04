import { ShieldAlert } from "lucide-react"

export function BlockersPanel({ blockers }: { blockers: any[] }) {
  if (!blockers || blockers.length === 0) {
    return (
      <div className="bg-white border border-border/50 rounded-2xl p-6 text-center shadow-sm h-full flex flex-col justify-center items-center">
        <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center mb-3">
          <ShieldAlert className="w-5 h-5 text-emerald-500" />
        </div>
        <p className="text-sm font-medium text-emerald-600">No blockers. Good rhythm.</p>
      </div>
    )
  }

  return (
    <div className="bg-red-50/30 border border-red-100 rounded-2xl shadow-sm p-4 space-y-3">
      <h3 className="font-semibold text-red-900 flex items-center gap-2 text-sm">
        <ShieldAlert className="w-4 h-4 text-red-500" />
        Needs Attention
      </h3>
      <div className="space-y-3">
        {blockers.map((b, i) => (
          <div key={i} className="bg-white border border-red-100 rounded-xl p-3 shadow-sm">
             <div className="flex justify-between items-start mb-1">
                <h4 className="font-medium text-sm text-foreground">{b.title}</h4>
                <span className="text-[10px] uppercase font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-sm border border-red-100">Blocked</span>
             </div>
             <p className="text-xs text-red-700/80 mb-2">Waiting on API spec from design team.</p>
             <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                <span className="text-[10px] text-muted-foreground">{b.assignee?.full_name || 'Unassigned'}</span>
                <button className="text-xs font-semibold text-red-600 hover:text-red-700">Resolve</button>
             </div>
          </div>
        ))}
      </div>
    </div>
  )
}
