'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateProfile(data: { full_name?: string, avatar_url?: string }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Allowlist updatable fields; never trust caller-supplied ids or extra columns.
  const payload: { full_name?: string, avatar_url?: string } = {}
  if (typeof data.full_name === 'string') payload.full_name = data.full_name
  if (typeof data.avatar_url === 'string') payload.avatar_url = data.avatar_url

  const { error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard')
  return { success: true }
}

function isValidTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone })
    return true
  } catch {
    return false
  }
}

/**
 * Stores the browser's IANA timezone on the profile. The hourly rhythm nudge is
 * sent server-side, so without this the sender can't tell when 06:00 is for
 * this user (it falls back to UTC).
 */
export async function syncTimezone(timezone: string) {
  if (typeof timezone !== 'string' || timezone.length > 64 || !isValidTimezone(timezone)) {
    return { error: 'Invalid timezone' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('profiles')
    .update({ timezone })
    .eq('id', user.id)

  if (error) return { error: error.message }
  return { success: true }
}

/** Opt in/out of the hourly 06:00–18:00 rhythm nudge. */
export async function setRhythmNudgesEnabled(enabled: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('profiles')
    .update({ rhythm_nudges_enabled: enabled })
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/settings')
  return { success: true }
}
