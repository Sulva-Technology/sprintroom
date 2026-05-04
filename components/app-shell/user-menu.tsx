'use client'

import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ChevronDown, LogOut, Settings, UserCircle } from 'lucide-react'
import { logout } from '@/app/actions/auth'

export function UserMenu({ user, profile }: { user: any, profile: any }) {
  const name = profile?.full_name || 'Anonymous'
  const initials = name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="w-full rounded-xl flex items-center gap-3 p-2 hover:bg-muted/60 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary group text-left">
        <Avatar className="h-9 w-9 border border-border shadow-sm shrink-0">
          <AvatarImage src={profile?.avatar_url} alt={name} />
          <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xs font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <span className="text-sm font-semibold truncate leading-tight">{name}</span>
          <span className="text-[11px] text-muted-foreground truncate leading-tight">{user?.email}</span>
        </div>
        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors mr-1" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[260px] ml-4 rounded-xl border border-border/50 shadow-xl glass-card bg-white/95" align="end" side="top">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal p-3 bg-muted/30 rounded-t-lg border-b border-border/50">
            <div className="flex items-center gap-3">
               <Avatar className="h-10 w-10 border border-border shadow-sm">
                  <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-sm font-semibold">
                    {initials}
                  </AvatarFallback>
               </Avatar>
               <div className="flex flex-col">
                 <span className="text-sm font-semibold">{name}</span>
                 <span className="text-xs text-muted-foreground">{user?.email}</span>
               </div>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <div className="p-1">
          <DropdownMenuItem className="rounded-lg h-9 px-3 cursor-pointer">
            <UserCircle className="mr-2 h-4 w-4 text-muted-foreground" />
            <span className="text-sm">My Profile</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="rounded-lg h-9 px-3 cursor-pointer">
            <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Account Settings</span>
          </DropdownMenuItem>
        </div>
        <DropdownMenuSeparator className="bg-border/50 my-0"/>
        <div className="p-1">
          <DropdownMenuItem 
            onClick={async () => {
              try {
                const { clearOfflineData } = await import('@/lib/offline/db');
                await clearOfflineData();
              } catch(e) {}
              await logout();
            }} 
            className="rounded-lg h-9 px-3 cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span className="text-sm font-medium">Log out</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
