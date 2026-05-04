'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function savePushSubscription(subscription: any) {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'Not authenticated' }
  }

  // Parse the subscription keys
  const keys = subscription.keys || {};
  const p256dh = keys.p256dh;
  const auth = keys.auth;
  const endpoint = subscription.endpoint;

  if (!endpoint || !p256dh || !auth) {
     return { error: 'Invalid subscription data' }
  }

  // Check if this exact subscription already exists for this user to avoid duplicates
  const { data: existing } = await supabase
    .from('web_push_subscriptions')
    .select('id')
    .eq('user_id', user.id)
    .eq('endpoint', endpoint)
    .single();

  if (existing) {
     return { success: true, message: 'Subscription already exists' }
  }

  // Insert new subscription
  const { error } = await supabase
    .from('web_push_subscriptions')
    .insert({
      user_id: user.id,
      endpoint: endpoint,
      keys_p256dh: p256dh,
      keys_auth: auth
    });

  if (error) {
    console.error('Error saving push subscription:', error);
    return { error: 'Failed to save subscription' }
  }

  revalidatePath('/dashboard', 'layout')
  return { success: true }
}
