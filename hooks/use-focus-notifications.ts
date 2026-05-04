'use client'

import { useState, useEffect, useCallback } from 'react'

export function useFocusNotifications() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return false

    try {
      return localStorage.getItem('sprintroom-notify-enabled') === 'true' && Notification.permission === 'granted'
    } catch {
      return false
    }
  })
  const [isSupported] = useState(() => typeof window !== 'undefined' && 'Notification' in window)

  const toggleNotifications = useCallback(async () => {
    if (!isSupported) return

    if (notificationsEnabled) {
      setNotificationsEnabled(false)
      try { localStorage.setItem('sprintroom-notify-enabled', 'false') } catch(e) {}
    } else {
      if (Notification.permission === 'granted') {
        setNotificationsEnabled(true)
        try { localStorage.setItem('sprintroom-notify-enabled', 'true') } catch(e) {}
      } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission()
        if (permission === 'granted') {
          setNotificationsEnabled(true)
          try { localStorage.setItem('sprintroom-notify-enabled', 'true') } catch(e) {}
        }
      }
    }
  }, [isSupported, notificationsEnabled])

  const showNotification = useCallback((title: string, body: string) => {
    if (!notificationsEnabled || !isSupported) return
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/icon-192x192.png' // Assumes basic PWA icon
        })
      } catch (e) {
        console.warn('Failed to show notification', e)
        // Service worker fallback could be implemented here if using service workers
      }
    }
  }, [notificationsEnabled, isSupported])

  return { isSupported, notificationsEnabled, toggleNotifications, showNotification }
}
