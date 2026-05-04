'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, FolderKanban, Activity, Timer } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/dashboard/projects', label: 'Projects', icon: FolderKanban },
  { href: '/dashboard/focus', label: 'Focus', icon: Timer },
  { href: '/dashboard/team', label: 'Team', icon: Activity },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 border-t border-border/40 bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 z-30 pb-safe">
      <nav className="flex items-center justify-around h-full px-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full space-y-1 text-muted-foreground hover:text-foreground transition-colors",
                isActive && "text-primary"
              )}
            >
              <div className={cn(
                "flex items-center justify-center w-12 h-8 rounded-full transition-colors",
                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground"
              )}>
                <Icon className={cn("w-5 h-5", isActive ? "stroke-[2.5px]" : "stroke-[2px]")} />
              </div>
              <span className={cn("text-[10px] font-medium", isActive ? "text-primary font-semibold" : "")}>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
