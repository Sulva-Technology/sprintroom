'use client'

import { useState, useEffect } from 'react'
import { FocusTube } from './focus-tube'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface FocusTubeProviderProps {
  initialSession: any
}

export function FocusTubeProvider({ initialSession }: FocusTubeProviderProps) {
  const [activeSession, setActiveSession] = useState(
    initialSession?.status === 'active' ? initialSession : null
  )
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Listen for new focus sessions being inserted (e.g., from the background cron job)
    const channel = supabase
      .channel('focus_sessions_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'focus_sessions'
        },
        async (payload) => {
          // Verify it's an active session
          if (payload.new && payload.new.status === 'active') {
             // We need to fetch the full details including relations if needed by FocusTube
             const { data: fullSession } = await supabase
               .from('focus_sessions')
               .select('*, tasks(*, projects(*))')
               .eq('id', payload.new.id)
               .single()
               
             if (fullSession) {
               setActiveSession({
                 ...fullSession,
                 task_title: (fullSession.tasks as any)?.title || 'Scheduled Focus',
                 project_id: (fullSession.tasks as any)?.project_id || null,
                 project_name: (fullSession.tasks as any)?.projects?.name || 'No Project',
                 distractions_count: fullSession.distractions_count || 0
               })
               // Optionally refresh the router to update Server Components
               router.refresh()
             }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, router])

  if (!activeSession) return null

  // Pass a key so that when a new session starts, it completely remounts FocusTube
  return <FocusTube key={activeSession.id} initialSession={activeSession} />
}
