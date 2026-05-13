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
      // When browser says online, verify with a ping to be sure
      fetch('/favicon.png', { method: 'HEAD', cache: 'no-store' })
        .then(() => setIsOnline(true))
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
