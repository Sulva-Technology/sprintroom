'use client'

import { useRealtimeSync } from '@/hooks/use-realtime'

export function RealtimePulse({ workspaceId }: { workspaceId?: string }) {
  useRealtimeSync(workspaceId)
  return null
}
