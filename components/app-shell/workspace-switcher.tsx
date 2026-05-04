'use client'

import { useState } from 'react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ChevronsUpDown, Check, Plus } from 'lucide-react'
import { CreateWorkspaceDialog } from './create-workspace-dialog'

export function WorkspaceSwitcher({ workspaces }: { workspaces: any[] }) {
  // Use the first workspace as active for now, or fallback if none exist
  const activeWorkspace = workspaces?.[0] || { id: 'default', name: 'No Workspace', initial: '?' }
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="w-full flex items-center justify-between gap-3 rounded-xl p-2 hover:bg-muted/60 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary border border-transparent hover:border-border/50 group text-left">
          <div className="flex items-center gap-3 truncate">
            <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground font-bold flex items-center justify-center shrink-0 shadow-sm text-sm">
              {activeWorkspace?.initial || activeWorkspace?.name?.substring(0, 2).toUpperCase() || 'W'}
            </div>
            <span className="font-semibold text-sm truncate">{activeWorkspace?.name || 'Workspace'}</span>
          </div>
          <ChevronsUpDown className="w-4 h-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors mr-1" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[248px] rounded-xl border border-border/50 shadow-xl glass-card bg-white/95" align="start">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs uppercase text-muted-foreground font-semibold px-3 py-2">Workspaces</DropdownMenuLabel>
          </DropdownMenuGroup>
          <div className="p-1">
            {workspaces?.map(ws => (
              <DropdownMenuItem key={ws.id} className="rounded-lg py-2 px-3 flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded border bg-muted flex items-center justify-center text-[10px] font-bold shrink-0">
                      {ws.initial || ws.name?.substring(0, 2).toUpperCase() || 'W'}
                    </div>
                    <span className="text-sm font-medium">{ws.name}</span>
                  </div>
                  {activeWorkspace.id === ws.id && <Check className="w-4 h-4 text-primary" />}
              </DropdownMenuItem>
            ))}
          </div>
          <DropdownMenuSeparator className="bg-border/50" />
          <div className="p-1">
            <DropdownMenuItem
              className="rounded-lg py-2 px-3 text-sm text-muted-foreground cursor-pointer focus:text-foreground"
              onSelect={() => {
                setShowCreateDialog(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create new workspace
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateWorkspaceDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
    </>
  )
}
