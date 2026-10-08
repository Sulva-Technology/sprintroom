'use client'

import { useRealtimeSync } from '@/hooks/use-realtime'

export function RealtimePulse({ workspaceId, userId }: { workspaceId?: string; userId?: string }) {
  useRealtimeSync(workspaceId, userId)
  return null
}
