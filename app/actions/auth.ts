'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSignupConfirmationEmail } from '@/lib/email/resend'
import { getSafeRedirectPath } from '@/lib/auth/redirect'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

function isConfirmationEmailDeliveryError(error: { message?: string; status?: number; code?: string } | null) {
  if (!error) return false

  const message = error.message || ''

  if (!/confirmation (email|mail)/i.test(message)) return false

  return (
    /send|sending|sent|deliver|delivery|smtp/i.test(message) ||
    (error.status === 500 && error.code === 'unexpected_failure')
  )
}

export async function login(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const next = getSafeRedirectPath(formData.get('next'))
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }
  
  redirect(next)
}

export async function signup(formData: FormData) {
  const email = ((formData.get('email') as string) || '').trim().toLowerCase()
  const password = formData.get('password') as string
  const fullName = formData.get('full_name') as string
  const next = getSafeRedirectPath(formData.get('next'))

  const supabase = await createClient()
  const requestHeaders = await headers()
  const origin = requestHeaders.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    }
  })

  if (error) {
    if (isConfirmationEmailDeliveryError(error)) {
      const admin = createAdminClient()
      if (!admin) {
        return {
          error: 'Could not send the confirmation email. Configure Supabase SMTP or add SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, and AUTH_EMAIL_FROM for the Resend fallback.',
        }
      }

      const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
        type: 'signup',
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      })

      if (linkError) {
        return { error: linkError.message }
      }

      const confirmationUrl = linkData.properties?.action_link
      if (!confirmationUrl) {
        return { error: 'Could not create a signup confirmation link.' }
      }

      const confirmationEmail = await sendSignupConfirmationEmail({
        to: email,
        confirmationUrl,
      })

      if (!confirmationEmail.sent) {
        return { error: confirmationEmail.error }
      }

      revalidatePath('/', 'layout')
      return { success: true }
    }

    return { error: error.message }
  }

  revalidatePath('/', 'layout')

  if (data.session) {
    redirect(next)
  }

  return { success: true }
}

export async function resetPassword(formData: FormData) {
  const email = formData.get('email') as string
  const supabase = await createClient()
  const requestHeaders = await headers()
  const origin = requestHeaders.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  // First check if the user exists
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (!profile) {
    return { error: 'No account found with this email address.' }
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/update-password`,
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function updatePassword(formData: FormData) {
  const password = formData.get('password') as string
  const supabase = await createClient()

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return { error: error.message }
  }

  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
