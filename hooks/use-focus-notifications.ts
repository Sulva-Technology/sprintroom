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

  const showNotification = useCallback((title: string, body: string, options?: { tag?: string }) => {
    if (!notificationsEnabled || !isSupported) return
    if (Notification.permission !== 'granted') return

    const payload: NotificationOptions = {
      body,
      icon: '/icon-192.png',
      badge: '/favicon.png',
      ...(options?.tag ? { tag: options.tag } : {}),
    }

    // Prefer the service worker: mobile browsers (Android Chrome) throw
    // "Illegal constructor" for `new Notification()` in a page context, so the
    // direct constructor silently fails on exactly the devices that need it.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((registration) => registration.showNotification(title, payload))
        .catch(() => {
          try {
            new Notification(title, payload)
          } catch (e) {
            console.warn('Failed to show notification', e)
          }
        })
      return
    }

    try {
      new Notification(title, payload)
    } catch (e) {
      console.warn('Failed to show notification', e)
    }
  }, [notificationsEnabled, isSupported])

  return { isSupported, notificationsEnabled, toggleNotifications, showNotification }
}
