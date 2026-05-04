'use client'

import { Cloud, CloudOff, RefreshCw, AlertTriangle } from 'lucide-react'
import { useNetworkStatus } from '@/hooks/use-network-status'
import { useSyncStatus } from '@/hooks/use-sync-status'
import { Button } from '@/components/ui/button'

interface SyncStatusPillProps {
  onClick?: () => void
}

export function SyncStatusPill({ onClick }: SyncStatusPillProps) {
  const { isOnline } = useNetworkStatus()
  const { pendingCount, isSyncing, syncFailed } = useSyncStatus()

  if (!isOnline) {
    return (
      <Button variant="ghost" size="sm" onClick={onClick} className="h-8 gap-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50">
        <CloudOff className="w-4 h-4" />
        <span className="text-xs font-medium">{pendingCount > 0 ? `${pendingCount} pending` : 'Offline'}</span>
      </Button>
    )
  }

  if (isSyncing) {
    return (
      <Button variant="ghost" size="sm" onClick={onClick} className="h-8 gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span className="text-xs font-medium">Syncing...</span>
      </Button>
    )
  }

  if (syncFailed) {
    return (
      <Button variant="ghost" size="sm" onClick={onClick} className="h-8 gap-2 text-red-600 hover:text-red-700 hover:bg-red-50">
        <AlertTriangle className="w-4 h-4" />
        <span className="text-xs font-medium">Sync Failed</span>
      </Button>
    )
  }

  if (pendingCount > 0) {
    return (
      <Button variant="ghost" size="sm" onClick={onClick} className="h-8 gap-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50">
        <AlertTriangle className="w-4 h-4" />
        <span className="text-xs font-medium">{pendingCount} pending</span>
      </Button>
    )
  }

  return (
    <Button variant="ghost" size="sm" onClick={onClick} className="h-8 gap-2 text-slate-400 hover:text-slate-600">
      <Cloud className="w-4 h-4" />
      <span className="text-xs font-medium">Synced</span>
    </Button>
  )
}
