import { acceptWorkspaceInvite, declineWorkspaceInvite } from '@/app/actions/invites'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { Check, Inbox, MailPlus, ShieldCheck, UserPlus, X } from 'lucide-react'
import { redirect } from 'next/navigation'

type InviteRow = {
  invite_id: string
  workspace_id: string
  workspace_name: string | null
  workspace_initial: string | null
  email: string
  role: string
  status: 'pending' | 'accepted' | 'declined'
  inviter_id: string | null
  inviter_name: string | null
  inviter_email: string | null
  created_at: string
  responded_at: string | null
}

function formatDate(value: string | null) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function getInitial(value: string | null) {
  return (value?.trim()?.[0] || 'W').toUpperCase()
}

export default async function InvitesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = searchParams ? await searchParams : {}
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data, error } = await supabase.rpc('get_my_workspace_invites')
  const invites = (data || []) as InviteRow[]
  const pendingInvites = invites.filter((invite) => invite.status === 'pending')
  const pastInvites = invites.filter((invite) => invite.status !== 'pending')

  const message = typeof params.accepted === 'string'
    ? { title: 'Invite accepted', body: 'The workspace is now available in your switcher.' }
    : typeof params.declined === 'string'
      ? { title: 'Invite declined', body: 'The invitation has been moved out of your pending list.' }
      : null
  const errorMessage = typeof params.error === 'string' ? params.error : error?.message

  return (
    <div className="flex flex-col pb-8 max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MailPlus className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Workspace Invites</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review invitations sent to {user.email}.
          </p>
        </div>
        <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">
          {pendingInvites.length} pending
        </Badge>
      </div>

      {message && (
        <Alert className="border-primary/20 bg-primary/5">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <AlertTitle>{message.title}</AlertTitle>
          <AlertDescription>{message.body}</AlertDescription>
        </Alert>
      )}

      {errorMessage && (
        <Alert variant="destructive">
          <AlertTitle>Invite action failed</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold">Pending invitations</h2>
        </div>

        {pendingInvites.length === 0 ? (
          <Card className="border-dashed bg-white/70">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Inbox className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">No pending invites</p>
                <p className="mt-1 text-sm text-muted-foreground">New workspace invitations will appear here.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {pendingInvites.map((invite) => (
              <Card key={invite.invite_id} className="bg-white/80 shadow-sm">
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-foreground text-background text-sm font-bold">
                      {invite.workspace_initial || getInitial(invite.workspace_name)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{invite.workspace_name || 'Workspace'}</p>
                      <p className="text-sm text-muted-foreground">
                        Invited as {invite.role} {invite.inviter_name ? `by ${invite.inviter_name}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">Sent {formatDate(invite.created_at)}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 sm:justify-end">
                    <form action={declineWorkspaceInvite}>
                      <input type="hidden" name="inviteId" value={invite.invite_id} />
                      <Button type="submit" variant="outline" className="h-9 rounded-xl">
                        <X className="h-4 w-4" />
                        Decline
                      </Button>
                    </form>
                    <form action={acceptWorkspaceInvite}>
                      <input type="hidden" name="inviteId" value={invite.invite_id} />
                      <Button type="submit" className="h-9 rounded-xl">
                        <Check className="h-4 w-4" />
                        Accept
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className={cn('space-y-3', pastInvites.length === 0 && 'hidden')}>
        <h2 className="text-lg font-semibold">Past invitations</h2>
        <Card className="bg-white/80 shadow-sm">
          <CardHeader>
            <CardTitle>Invite history</CardTitle>
            <CardDescription>Accepted and declined invitations for this email.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border/70 p-0">
            {pastInvites.map((invite) => (
              <div key={invite.invite_id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{invite.workspace_name || 'Workspace'}</p>
                  <p className="text-xs text-muted-foreground">
                    {invite.responded_at ? formatDate(invite.responded_at) : formatDate(invite.created_at)}
                  </p>
                </div>
                <Badge
                  variant={invite.status === 'accepted' ? 'default' : 'secondary'}
                  className="rounded-full capitalize"
                >
                  {invite.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
