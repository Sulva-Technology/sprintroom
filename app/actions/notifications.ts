'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type Result = { success: true } | { success: false; error: string }

export async function markNotificationRead(id: string): Promise<Result> {
  if (!z.string().uuid().safeParse(id).success) return { success: false, error: 'Invalid input' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard', 'layout')
  return { success: true }
}

export async function markAllNotificationsRead(): Promise<Result> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null)
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard', 'layout')
  return { success: true }
}
