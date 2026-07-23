'use client'

import { useEffect } from 'react'
import { syncTimezone } from '@/app/actions/profile'

const STORAGE_KEY = 'sprintroom-synced-timezone'

/**
 * Keeps profiles.timezone in step with the device. The server-side rhythm nudge
 * needs it to know when 06:00–18:00 is for this user; travelling or a fresh
 * signup would otherwise leave it stale (the sender falls back to UTC).
 */
export function TimezoneSync({ savedTimezone }: { savedTimezone?: string | null }) {
  useEffect(() => {
    let timezone: string | undefined
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
      return
    }
    if (!timezone) return

    // Skip the round-trip when the server value already matches, and when this
    // browser already synced the same value.
    if (savedTimezone === timezone) return
    try {
      if (localStorage.getItem(STORAGE_KEY) === timezone) return
    } catch {
      // localStorage unavailable — just sync.
    }

    syncTimezone(timezone)
      .then((result) => {
        if (result?.success) {
          try { localStorage.setItem(STORAGE_KEY, timezone) } catch {}
        }
      })
      .catch(() => {})
  }, [savedTimezone])

  return null
}
