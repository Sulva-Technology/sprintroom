'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getWorkspaceRealtimeSubscriptions } from '@/lib/realtime-subscriptions'

export function useRealtimeSync(workspaceId?: string) {
  const router = useRouter()
  const pathname = usePathname()
  const [supabase] = useState(() => createClient())

  useEffect(() => {
    const workspaceSubscriptions = getWorkspaceRealtimeSubscriptions(workspaceId)
    const shouldWatchRhythmLogs = pathname.startsWith('/dashboard/rhythms')

    if (workspaceSubscriptions.length === 0 && !shouldWatchRhythmLogs) {
      return
    }

    let channel = supabase.channel(`workspace_pulse_${workspaceId ?? 'global'}`)

    for (const subscription of workspaceSubscriptions) {
      channel = channel.on('postgres_changes', subscription, () => {
        router.refresh()
      })
    }

    if (shouldWatchRhythmLogs) {
      channel = channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'weekly_rhythm_logs',
        },
        () => {
          router.refresh()
        }
      )
    }

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [pathname, router, supabase, workspaceId])
}
