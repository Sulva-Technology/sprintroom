'use client'

import { useEffect, useState } from 'react'
import { useNetworkStatus } from '@/hooks/use-network-status'
import { cacheSnapshot, getCachedSnapshot } from '@/lib/offline/cache-utils'

/**
 * Renders server-provided page data online, and the last snapshot of it from
 * IndexedDB when offline.
 *
 * Server components pass their already-fetched data in as `serverData`; while
 * online that value is written to IndexedDB under `key` and returned unchanged.
 * When the network is down — including on a cold start from the service worker's
 * cached HTML, where the server data is whatever was rendered last — the stored
 * snapshot is returned instead.
 *
 * Returns `null` data only when offline with nothing ever cached for `key`.
 */
export function useOfflineSnapshot<T>(key: string, serverData: T) {
  const { isOnline } = useNetworkStatus()
  // Only the cached value lives in state. The online value is derived during
  // render straight from props, so going back online needs no extra render.
  const [cached, setCached] = useState<T | null>(null)

  // Keep the snapshot fresh whenever the server gives us real data.
  useEffect(() => {
    if (!isOnline || serverData == null) return
    cacheSnapshot(key, serverData).catch(() => {})
  }, [isOnline, key, serverData])

  useEffect(() => {
    if (isOnline) return

    let cancelled = false

    getCachedSnapshot<T>(key)
      .then((value) => {
        if (!cancelled && value != null) setCached(value)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [isOnline, key])

  // Offline with nothing stored falls back to whatever the cached shell was
  // rendered with, which is still the freshest data available.
  const useCachedValue = !isOnline && cached != null
  const data = useCachedValue ? cached : serverData ?? null

  return { data, isFromCache: useCachedValue, isOnline }
}
