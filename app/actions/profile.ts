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
