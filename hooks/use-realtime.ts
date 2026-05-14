'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function useRealtimeSync(workspaceId?: string) {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (!workspaceId) return

    // Create a channel for this workspace
    const channel = supabase
      .channel(`workspace_pulse_${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
        },
        (payload) => {
          // If the change belongs to our workspace (or is a task related to it)
          // We trigger a server-side refresh. 
          // Next.js will re-fetch the data for the current page.
          console.log('Real-time update received:', payload)
          router.refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [workspaceId, supabase, router])
}
