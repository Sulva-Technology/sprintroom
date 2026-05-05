'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, Plus, Timer, Command } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'

import { SyncStatusPill } from '@/components/offline/sync-status-pill'
import { GlobalSearch } from './global-search'
import { WorkspaceSwitcher } from './workspace-switcher'

export function Topbar({
  user,
  profile,
  activeFocus,
  workspaces,
  activeWorkspaceId
}: {
  user: any,
  profile: any,
  activeFocus: any,
  workspaces: any[],
  activeWorkspaceId?: string
}) {
  const [isScrolled, setIsScrolled] = useState(false)

  return (
    <header className={cn(
      "h-16 px-4 md:px-8 flex items-center justify-between shrink-0 sticky top-0 z-30 transition-shadow",
      isScrolled ? "bg-[#F7F8FA]/80 backdrop-blur-xl border-b border-border/40 shadow-sm" : "bg-transparent"
    )}>
      {/* Mobile left side structure: workspace switcher */}
      <div className="flex items-center md:hidden w-40">
         <WorkspaceSwitcher workspaces={workspaces} activeWorkspaceId={activeWorkspaceId} />
      </div>

      <div className="flex-1 flex max-w-xl items-center relative">
         <GlobalSearch />
      </div>
      
      <div className="flex items-center gap-3">
        <SyncStatusPill onClick={() => document.getElementById('sync-pill-portal-target')?.click()} />
        
        {activeFocus && (
          <Link href={`/focus/${activeFocus.id}`} className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-full border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-amber-500 outline-none">
            <Timer className="w-4 h-4 animate-pulse" />
            <span className="text-xs font-semibold">Focusing now</span>
          </Link>
        )}
        
        <Button size="sm" render={<Link href="/dashboard/projects?new=true" />} className="rounded-full h-9 px-4 shadow-sm bg-primary text-primary-foreground focus-visible:ring-offset-2">
            <Plus className="w-4 h-4 md:mr-1.5" />
            <span className="hidden md:inline">New Project</span>
        </Button>
      </div>
    </header>
  )
}
