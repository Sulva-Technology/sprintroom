export function RecentActivity({ activities }: { activities: any[] }) {
  if (!activities || activities.length === 0) {
    return (
      <div className="bg-white border border-border/50 rounded-2xl p-6 text-center shadow-sm">
        <p className="text-sm text-muted-foreground">No recent activity found.</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-border/50 rounded-2xl shadow-sm p-5 space-y-6">
      <h3 className="font-semibold text-foreground text-sm">Recent Activity</h3>
      <div className="relative border-l border-slate-200 ml-3 space-y-6">
        {activities.map((act, i) => (
          <div key={i} className="relative pl-6">
            {/* Timeline dot */}
            <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white bg-slate-300" />
            
            <p className="text-sm text-foreground">
              <span className="font-semibold">{act.user?.full_name}</span> completed a focus session on <span className="font-medium">{act.task?.title}</span>
            </p>
            {act.notes && (
              <div className="mt-2 text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border/50">
                &quot;{act.notes}&quot;
              </div>
            )}
            <span className="text-[10px] text-muted-foreground block mt-1">2 hours ago</span>
          </div>
        ))}
      </div>
    </div>
  )
}
