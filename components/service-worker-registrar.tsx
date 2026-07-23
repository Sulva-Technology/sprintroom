'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'

/**
 * Registers the service worker and mediates updates.
 *
 * The worker never calls skipWaiting() on its own, so a new build sits in the
 * `waiting` state until the user accepts. That keeps the current tab on the
 * build whose chunks are still cached, instead of pulling the rug mid-session.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return
    }

    let cancelled = false
    // Set when the user accepts the update, so the reload below only fires for
    // a deliberate upgrade and not for the very first worker taking control.
    let reloadOnControllerChange = false

    const promptForUpdate = (waiting: ServiceWorker) => {
      if (cancelled) return

      toast('A new version of SprintRoom is ready.', {
        duration: Infinity,
        action: {
          label: 'Reload',
          onClick: () => {
            reloadOnControllerChange = true
            waiting.postMessage({ type: 'SKIP_WAITING' })
          },
        },
      })
    }

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        if (cancelled) {
          return
        }

        // A build may already be waiting from a previous visit.
        if (registration.waiting && navigator.serviceWorker.controller) {
          promptForUpdate(registration.waiting)
        }

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing
          if (!installing) return

          installing.addEventListener('statechange', () => {
            // `controller` is null on a first install; there is nothing to
            // replace then, so no prompt is warranted.
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              promptForUpdate(installing)
            }
          })
        })

        registration.update().catch(() => {
          // The browser will retry service worker updates on its own schedule.
        })
      })
      .catch((error) => {
        console.warn('Service Worker registration failed:', error)
      })

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'sprintroom-sync') {
        window.dispatchEvent(new Event('sprintroom-sync-requested'))
      }
    }

    const handleControllerChange = () => {
      if (!reloadOnControllerChange) return
      reloadOnControllerChange = false
      window.location.reload()
    }

    navigator.serviceWorker.addEventListener('message', handleMessage)
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

    return () => {
      cancelled = true
      navigator.serviceWorker.removeEventListener('message', handleMessage)
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
    }
  }, [])

  return null
}
