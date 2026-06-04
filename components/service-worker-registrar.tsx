'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return
    }

    let cancelled = false

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        if (cancelled) {
          return
        }

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

    navigator.serviceWorker.addEventListener('message', handleMessage)

    return () => {
      cancelled = true
      navigator.serviceWorker.removeEventListener('message', handleMessage)
    }
  }, [])

  return null
}
