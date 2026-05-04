'use client'

import { useState, useEffect, useCallback } from 'react'
import { getPendingChangesCount, getSyncQueue, removeSyncItem } from '@/lib/offline/sync-queue'

export function useSyncStatus() {
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncFailed, setSyncFailed] = useState(false)
  const [queue, setQueue] = useState<any[]>([])

  const refreshStatus = useCallback(async () => {
    const count = await getPendingChangesCount()
    const items = await getSyncQueue()
    setPendingCount(count)
    setQueue(items)
    setSyncFailed(items.some(i => i.status === 'failed'))
  }, [])

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => {
      void refreshStatus()
    }, 0)

    const handleSyncStart = () => {
      setIsSyncing(true)
      refreshStatus()
    }
    const handleSyncComplete = () => {
      setIsSyncing(false)
      refreshStatus()
    }

    const interval = setInterval(refreshStatus, 5000)

    window.addEventListener('sprintroom-sync-started', handleSyncStart)
    window.addEventListener('sprintroom-sync-completed', handleSyncComplete)

    return () => {
      window.clearTimeout(initialRefresh)
      clearInterval(interval)
      window.removeEventListener('sprintroom-sync-started', handleSyncStart)
      window.removeEventListener('sprintroom-sync-completed', handleSyncComplete)
    }
  }, [refreshStatus])

  return { pendingCount, isSyncing, syncFailed, queue, refreshStatus, removeSyncItem }
}
