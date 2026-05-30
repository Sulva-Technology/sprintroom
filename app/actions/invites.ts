'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const inviteActionSchema = z.object({
  inviteId: z.string().uuid(),
})

function buildInvitesRedirect(params: Record<string, string>) {
  const searchParams = new URLSearchParams(params)
  return `/dashboard/invites?${searchParams.toString()}`
}

export async function acceptWorkspaceInvite(formData: FormData) {
  const parsed = inviteActionSchema.safeParse({
    inviteId: formData.get('inviteId'),
  })

  if (!parsed.success) {
    redirect(buildInvitesRedirect({ error: 'Invalid invite.' }))
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: workspaceId, error } = await supabase.rpc('accept_workspace_invite', {
    invite_id_input: parsed.data.inviteId,
  })

  if (error) {
    redirect(buildInvitesRedirect({ error: error.message || 'Could not accept invite.' }))
  }

  if (workspaceId) {
    const cookieStore = await cookies()
    cookieStore.set('active_workspace_id', workspaceId, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'lax',
    })
  }

  revalidatePath('/dashboard', 'layout')
  revalidatePath('/dashboard/invites')
  redirect(buildInvitesRedirect({ accepted: '1' }))
}

export async function declineWorkspaceInvite(formData: FormData) {
  const parsed = inviteActionSchema.safeParse({
    inviteId: formData.get('inviteId'),
  })

  if (!parsed.success) {
    redirect(buildInvitesRedirect({ error: 'Invalid invite.' }))
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { error } = await supabase.rpc('decline_workspace_invite', {
    invite_id_input: parsed.data.inviteId,
  })

  if (error) {
    redirect(buildInvitesRedirect({ error: error.message || 'Could not decline invite.' }))
  }

  revalidatePath('/dashboard/invites')
  redirect(buildInvitesRedirect({ declined: '1' }))
}
