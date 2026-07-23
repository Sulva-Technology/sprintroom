'use client'

import { useState, useEffect } from 'react'

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof window === 'undefined') return true
    return navigator.onLine
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline = () => {
      // Verify with a real network round-trip. The cache-busting query stops the
      // service worker from answering a "cache-first" asset from cache (which would
      // report online while actually offline), and we must check res.ok because the
      // SW returns a synthetic 503 Response rather than rejecting when offline.
      fetch(`/favicon.png?_=${Date.now()}`, { method: 'HEAD', cache: 'no-store' })
        .then((res) => setIsOnline(res.ok))
        .catch(() => setIsOnline(false))
    }
    
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // iOS Safari Fix: Periodically check status because events can be missed 
    // when app is backgrounded or on some iOS versions.
    const interval = setInterval(() => {
      if (navigator.onLine !== isOnline) {
        if (navigator.onLine) handleOnline()
        else setIsOnline(false)
      }
    }, 5000)

    // Initial verify
    if (navigator.onLine) handleOnline()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [isOnline])

  return { isOnline }
}
