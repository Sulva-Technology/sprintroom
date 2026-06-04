'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function globalRevalidate() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: membership, error: membershipError } = await supabase
    .from('workspace_members')
    .select('id')
    .eq('user_id', user.id)
    .in('role', ['owner', 'admin'])
    .limit(1)
    .maybeSingle()

  if (membershipError || !membership) {
    return { success: false, error: 'Not authorized' }
  }

  revalidatePath('/dashboard', 'layout')
  return { success: true }
}
