'use client'

import { useState, useEffect } from 'react'
import { FocusTube } from './focus-tube'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { getUserFocusSessionSubscription } from '@/lib/realtime-subscriptions'

interface FocusTubeProviderProps {
  initialSession: any
  userId: string
}

export function FocusTubeProvider({ initialSession, userId }: FocusTubeProviderProps) {
  const [activeSession, setActiveSession] = useState(
    initialSession?.status === 'active' ? initialSession : null
  )
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  useEffect(() => {
    setActiveSession(initialSession?.status === 'active' ? initialSession : null)
  }, [initialSession])

  useEffect(() => {
    const subscription = getUserFocusSessionSubscription(userId)

    const channel = supabase
      .channel('focus_sessions_changes')
      .on(
        'postgres_changes',
        subscription,
        async (payload) => {
          const nextSession = payload.new as { id?: string; status?: string } | null

          // Verify it's an active session
          if (nextSession?.status === 'active' && nextSession.id) {
             // We need to fetch the full details including relations if needed by FocusTube
             const { data: fullSession } = await supabase
                .from('focus_sessions')
                .select('*, tasks(*, projects(*))')
                .eq('id', nextSession.id)
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
  }, [router, supabase, userId])

  if (!activeSession) return null

  // Pass a key so that when a new session starts, it completely remounts FocusTube
  return <FocusTube key={activeSession.id} initialSession={activeSession} />
}
