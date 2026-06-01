import { acceptWorkspaceInvite } from '@/app/actions/invites'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { Check, LogIn, MailPlus, UserPlus } from 'lucide-react'
import Link from 'next/link'

type InviteLookupRow = {
  invite_id: string
  workspace_id: string
  workspace_name: string | null
  workspace_initial: string | null
  email: string
  role: string
  status: 'pending' | 'accepted' | 'declined'
  inviter_name: string | null
  inviter_email: string | null
  created_at: string
  responded_at: string | null
}

function getInitial(value: string | null) {
  return (value?.trim()?.[0] || 'W').toUpperCase()
}

function buildAuthHref(pathname: '/login' | '/signup', email: string, next: string) {
  const params = new URLSearchParams({ email, next })
  return `${pathname}?${params.toString()}`
}

export default async function InviteTokenPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const nextPath = `/invite/${encodeURIComponent(token)}`
  const supabase = await createClient()
  const { data: userResult } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
  const { data, error } = await supabase.rpc('get_workspace_invite_by_token', {
    invite_token_input: token,
  })
  const invite = Array.isArray(data) ? data[0] as InviteLookupRow | undefined : undefined
  const signedInEmail = userResult.user?.email?.toLowerCase()
  const inviteEmail = invite?.email.toLowerCase()
  const isInvitee = Boolean(signedInEmail && inviteEmail && signedInEmail === inviteEmail)

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F8FA] p-6">
      <Card className="w-full max-w-md bg-white/90 shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MailPlus className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Workspace invite</CardTitle>
            <CardDescription>
              {invite
                ? `You have been invited to join ${invite.workspace_name || 'a workspace'}.`
                : 'This invite link could not be resolved.'}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {(error || !invite) && (
            <Alert variant="destructive">
              <AlertTitle>Invite unavailable</AlertTitle>
              <AlertDescription>
                {error?.message || 'This invite link may be invalid or expired.'}
              </AlertDescription>
            </Alert>
          )}

          {invite && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-slate-50 p-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-foreground text-sm font-bold text-background">
                {invite.workspace_initial || getInitial(invite.workspace_name)}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold">{invite.workspace_name || 'Workspace'}</p>
                <p className="text-sm text-muted-foreground">
                  Invited as {invite.role} {invite.inviter_name ? `by ${invite.inviter_name}` : ''}
                </p>
              </div>
              <Badge variant="secondary" className="ml-auto rounded-full capitalize">
                {invite.status}
              </Badge>
            </div>
          )}

          {invite?.status === 'pending' && !userResult.user && (
            <Alert>
              <AlertTitle>Use the invited email</AlertTitle>
              <AlertDescription>
                Create an account or log in with {invite.email}, then you will return here to accept.
              </AlertDescription>
            </Alert>
          )}

          {invite?.status === 'pending' && userResult.user && !isInvitee && (
            <Alert variant="destructive">
              <AlertTitle>Wrong account</AlertTitle>
              <AlertDescription>
                This invite is for {invite.email}. Log in with that email to accept it.
              </AlertDescription>
            </Alert>
          )}

          {invite?.status !== 'pending' && invite && (
            <Alert>
              <Check className="h-4 w-4" />
              <AlertTitle>Invite already {invite.status}</AlertTitle>
              <AlertDescription>
                Open your dashboard to continue.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-2 sm:flex-row">
          {invite?.status === 'pending' && !userResult.user && (
            <>
              <Button render={<Link href={buildAuthHref('/signup', invite.email, nextPath)} />} className="w-full rounded-xl">
                <UserPlus className="h-4 w-4" />
                Create account
              </Button>
              <Button render={<Link href={buildAuthHref('/login', invite.email, nextPath)} />} variant="outline" className="w-full rounded-xl">
                <LogIn className="h-4 w-4" />
                Log in
              </Button>
            </>
          )}

          {invite?.status === 'pending' && userResult.user && isInvitee && (
            <form action={acceptWorkspaceInvite} className="w-full">
              <input type="hidden" name="inviteId" value={invite.invite_id} />
              <Button type="submit" className="w-full rounded-xl">
                <Check className="h-4 w-4" />
                Accept invite
              </Button>
            </form>
          )}

          {(!invite || invite.status !== 'pending') && (
            <Button render={<Link href="/dashboard" />} className="w-full rounded-xl">
              Open dashboard
            </Button>
          )}
        </CardFooter>
      </Card>
    </main>
  )
}
