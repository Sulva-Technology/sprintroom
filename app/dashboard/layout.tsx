import { ReactNode } from 'react'
import { Sidebar } from '@/components/app-shell/sidebar'
import { Topbar } from '@/components/app-shell/topbar'
import { MobileNav } from '@/components/app-shell/mobile-nav'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getActiveFocusSession } from '@/app/actions/focus'
import { getWorkspaces, getActiveWorkspaceId } from '@/app/actions/workspaces'
import { getRecentProjects } from '@/app/actions/projects'
import { FocusTubeProvider } from '@/components/focus/focus-tube-provider'
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata;

import { OfflineProvider } from '@/components/offline/offline-provider'
import { AlarmManager } from '@/components/dashboard/alarm-manager'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  // Fetch basic user profile
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  // Fetch real workspaces and recent projects
  const workspaces = await getWorkspaces()
  const activeWorkspaceId = await getActiveWorkspaceId()
  const recentProjects = await getRecentProjects()

  // Check for active pomodoro session
  const activeFocus = await getActiveFocusSession()

  return (
    <OfflineProvider>
      <div className="flex h-screen overflow-hidden bg-[#F7F8FA] font-sans selection:bg-primary/20">
        <AlarmManager />
        <Sidebar user={user} profile={profile} workspaces={workspaces} activeWorkspaceId={activeWorkspaceId} recentProjects={recentProjects} />

        <div className="flex flex-col flex-1 w-full min-w-0 relative">
          <Topbar user={user} profile={profile} activeFocus={activeFocus} workspaces={workspaces} activeWorkspaceId={activeWorkspaceId} />

          <main className="flex-1 overflow-auto p-4 md:p-8 md:pt-4 outline-none pb-24 md:pb-8" tabIndex={-1}>
            <div className="max-w-6xl mx-auto h-full">
              {children}
            </div>
          </main>
        </div>

        <MobileNav />
        <FocusTubeProvider initialSession={activeFocus} />
      </div>
    </OfflineProvider>
  )
}
