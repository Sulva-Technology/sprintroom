'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, FolderKanban, Activity, Timer, Settings, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WorkspaceSwitcher } from './workspace-switcher'
import { UserMenu } from './user-menu'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/projects', label: 'Projects', icon: FolderKanban },
  { href: '/dashboard/focus', label: 'Focus Sessions', icon: Timer },
  { href: '/dashboard/team', label: 'Team Pulse', icon: Activity },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

export function Sidebar({
  user,
  profile,
  workspaces,
  activeWorkspaceId,
  recentProjects
}: {
  user: any,
  profile: any,
  workspaces: any[],
  activeWorkspaceId?: string,
  recentProjects?: any[]
}) {
  const pathname = usePathname()
  const displayProjects = recentProjects || []

  return (
    <aside className="w-[280px] shrink-0 border-r border-border/40 hidden md:flex flex-col bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 z-20">
      <div className="p-4 flex items-center h-16 shrink-0 border-b border-border/20">
        <WorkspaceSwitcher workspaces={workspaces} activeWorkspaceId={activeWorkspaceId} />
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar py-4 px-3 flex flex-col gap-6">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            // Naive exact match or prefix
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all group outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <Icon className={cn("w-4 h-4 transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {displayProjects.length > 0 && (
          <div className="px-1 text-sm">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
              <span>Recent Projects</span>
              <button className="hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary rounded p-0.5"><Plus className="w-3.5 h-3.5"/></button>
            </div>
            <ul className="space-y-0.5">
              {displayProjects.map((proj: any) => (
                <li key={proj.id}>
                  <Link href={`/dashboard/projects/${proj.id}`} className="flex items-center gap-3 px-2 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    <div className={cn("w-2 h-2 rounded-full", proj.color || "bg-primary")} />
                    <span className="truncate">{proj.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="p-3 shrink-0 border-t border-border/20 mt-auto bg-white/50 backdrop-blur-md">
         <UserMenu user={user} profile={profile} />
      </div>
    </aside>
  )
}
