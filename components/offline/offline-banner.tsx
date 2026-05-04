'use client'

import { WifiOff, RefreshCw, AlertCircle } from 'lucide-react'
import { useNetworkStatus } from '@/hooks/use-network-status'
import { useSyncStatus } from '@/hooks/use-sync-status'

export function OfflineBanner() {
  const { isOnline } = useNetworkStatus()
  const { isSyncing, syncFailed, pendingCount } = useSyncStatus()

  if (isOnline && pendingCount === 0 && !isSyncing && !syncFailed) return null

  if (!isOnline) {
    return (
      <div className="bg-amber-100 text-amber-900 border-b border-amber-200 px-4 py-2 text-sm flex items-center justify-center gap-2 z-50 relative">
        <WifiOff className="w-4 h-4" />
        <span className="font-medium">You are offline.</span> 
        <span className="hidden sm:inline">Changes will be saved on this device and synced when you reconnect.</span>
      </div>
    )
  }

  if (isSyncing) {
    return (
      <div className="bg-blue-50 text-blue-800 border-b border-blue-100 px-4 py-2 text-sm flex items-center justify-center gap-2 z-50 relative animate-pulse">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span className="font-medium">Syncing pending changes...</span>
      </div>
    )
  }

  if (syncFailed && isOnline) {
    return (
      <div className="bg-red-50 text-red-800 border-b border-red-100 px-4 py-2 text-sm flex items-center justify-center gap-2 z-50 relative">
        <AlertCircle className="w-4 h-4" />
        <span className="font-medium">Some changes could not sync.</span>
        <button 
          onClick={() => window.dispatchEvent(new Event('sprintroom-sync-requested'))}
          className="underline font-semibold hover:text-red-900 ml-2"
        >
          Review or retry
        </button>
      </div>
    )
  }

  return null
}
