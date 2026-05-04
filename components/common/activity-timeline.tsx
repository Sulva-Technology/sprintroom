import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { MemberAvatarStack } from "./member-avatar-stack"

interface ActivityItem {
  id: string
  user: { id: string, name: string, avatar_url?: string }
  action: string
  target?: string
  notes?: string
  timestamp: string | Date
}

interface ActivityTimelineProps {
  activities: ActivityItem[]
  className?: string
}

export function ActivityTimeline({ activities, className }: ActivityTimelineProps) {
  if (activities.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground italic", className)}>
        No recent activity.
      </div>
    )
  }

  return (
    <div className={cn("space-y-6 relative before:absolute before:inset-0 before:ml-4 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-border before:via-border/50 before:to-transparent", className)}>
      {activities.map((activity, index) => (
        <div key={activity.id} className="relative flex items-start justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
          {/* Icon */}
          <div className="flex items-center justify-center w-8 h-8 rounded-full border-4 border-white bg-slate-100 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 absolute left-0 md:left-1/2">
            <MemberAvatarStack members={[activity.user]} size="sm" className="-ml-1" />
          </div>
          
          {/* Content */}
          <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2rem)] md:w-full ml-12 md:ml-0 bg-white border border-border shadow-sm rounded-2xl p-4 transition-all hover:shadow-md">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-sm text-foreground">{activity.user.name}</span>
              <time className="text-[10px] font-medium text-muted-foreground tracking-wider uppercase">
                {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
              </time>
            </div>
            <p className="text-sm text-foreground/80 mb-2">
              {activity.action} {activity.target && <span className="font-medium text-foreground">{activity.target}</span>}
            </p>
            {activity.notes && (
              <p className="text-sm text-muted-foreground bg-slate-50 p-3 rounded-lg border border-border/50 italic">
                &quot;{activity.notes}&quot;
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
