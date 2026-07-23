'use client'

import { useCallback, useEffect } from 'react'
import { useNetworkStatus } from '@/hooks/use-network-status'
import { CORE_APP_ROUTES, isWarmDue, warmRoutes } from '@/lib/offline/route-warmer'
import { getDB } from '@/lib/offline/db'

/**
 * Every project the user has cached, not only the handful the layout knows
 * about, so each board is reachable offline once /dashboard/projects has been
 * opened at least once.
 */
async function cachedProjectIds(): Promise<string[]> {
  try {
    const db = await getDB()
    if (!db) return []
    return (await db.getAllKeys('cached_projects')) as string[]
  } catch {
    return []
  }
}

function scheduleIdle(callback: () => void) {
  if (typeof window === 'undefined') return () => {}

  const ric = (window as any).requestIdleCallback

  if (typeof ric === 'function') {
    const handle = ric(callback, { timeout: 8000 })
    return () => (window as any).cancelIdleCallback?.(handle)
  }

  const handle = window.setTimeout(callback, 3000)
  return () => window.clearTimeout(handle)
}

/**
 * Pre-caches the app's routes into the service worker while online so the whole
 * app — not only the pages already visited — renders after the network drops.
 *
 * Mounted in the dashboard layout, which is the first authenticated render, so
 * warming happens with the session cookie attached.
 */
export function RouteWarmer({ projectIds = [] }: { projectIds?: string[] }) {
  const { isOnline } = useNetworkStatus()
  // Depend on the contents, not the array identity: the layout re-creates this
  // prop on every render and an unstable callback would re-schedule the warm.
  const projectIdKey = projectIds.join(',')

  const run = useCallback(
    (force = false) => {
      if (!navigator.onLine) return
      if (!force && !isWarmDue()) return

      const ownIds = projectIdKey ? projectIdKey.split(',') : []

      cachedProjectIds()
        .then((cachedIds) => {
          const paths = [
            ...CORE_APP_ROUTES,
            ...[...ownIds, ...cachedIds].map((id) => `/dashboard/projects/${id}`),
          ]

          return warmRoutes(paths)
        })
        .catch(() => {
          // Best-effort: a failed warm just means fewer routes are available offline.
        })
    },
    [projectIdKey],
  )

  // Warm once the page is idle after load, so it never competes with the
  // first paint or the user's own navigation.
  useEffect(() => {
    if (!isOnline) return
    return scheduleIdle(() => run())
  }, [isOnline, run])

  // Re-warm when the connection comes back: the cached payloads are now stale
  // and this is the moment we know the network is healthy.
  useEffect(() => {
    if (!isOnline) return

    const onOnline = () => run(true)
    window.addEventListener('online', onOnline)

    return () => window.removeEventListener('online', onOnline)
  }, [isOnline, run])

  return null
}
