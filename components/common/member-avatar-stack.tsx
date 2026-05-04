import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface Member {
  id: string
  name: string
  avatar_url?: string
}

interface MemberAvatarStackProps {
  members: Member[]
  limit?: number
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function MemberAvatarStack({ members, limit = 3, className, size = 'md' }: MemberAvatarStackProps) {
  const visibleMembers = members.slice(0, limit)
  const remainingCount = Math.max(0, members.length - limit)

  const sizeClasses = {
    sm: "w-6 h-6 text-[10px]",
    md: "w-8 h-8 text-[11px]",
    lg: "w-10 h-10 text-xs"
  }

  const offsetClasses = {
    sm: "-ml-2 border-[1.5px]",
    md: "-ml-3 border-2",
    lg: "-ml-4 border-2"
  }

  return (
    <div className={cn("flex items-center", className)}>
      {visibleMembers.map((member, i) => {
        const initials = member.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
        return (
          <Avatar 
            key={member.id} 
            className={cn(
              sizeClasses[size], 
              "border-white shadow-sm ring-1 ring-black/5 hover:z-10 transition-transform hover:scale-110",
              i > 0 && offsetClasses[size]
            )}
          >
            <AvatarImage src={member.avatar_url} alt={member.name} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        )
      })}
      
      {remainingCount > 0 && (
        <div className={cn(
          "flex items-center justify-center bg-slate-100 rounded-full text-slate-600 font-medium border-white shadow-sm ring-1 ring-black/5",
          sizeClasses[size],
          offsetClasses[size]
        )}>
          +{remainingCount}
        </div>
      )}
    </div>
  )
}
