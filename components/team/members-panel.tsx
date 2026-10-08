'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { leaveWorkspace, removeMember, updateMemberRole } from '@/app/actions/members'
import type { WorkspaceRole } from '@/app/actions/roles'
import {
  ASSIGNABLE_ROLES,
  canChangeRole,
  canLeaveWorkspace,
  canRemoveMember,
} from '@/lib/team/member-permissions'

export type PanelMember = { id: string; name: string; email: string; role: WorkspaceRole }

type Result = { success: true } | { success: false; error: string }

export function MembersPanel({
  workspaceId,
  members,
  currentUserId,
  actorRole,
}: {
  workspaceId: string
  members: PanelMember[]
  currentUserId: string
  actorRole: WorkspaceRole | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const ownerCount = members.filter((m) => m.role === 'owner').length

  function run(action: () => Promise<Result>, ok: string, after?: () => void) {
    startTransition(async () => {
      const res = await action()
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success(ok)
      if (after) after()
      else router.refresh()
    })
  }

  return (
    <section>
      <h3 className="mb-4 text-xl font-bold text-foreground">Members ({members.length})</h3>
      <ul className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-white">
        {members.map((m) => {
          const isSelf = m.id === currentUserId
          const roleOptions = ASSIGNABLE_ROLES.filter(
            (r) => r === m.role || canChangeRole(actorRole, m.role, r, isSelf)
          )
          return (
            <li key={m.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {m.name}
                  {isSelf && <span className="text-muted-foreground"> (you)</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              </div>

              {roleOptions.length > 1 ? (
                <select
                  aria-label={`Role for ${m.name}`}
                  value={m.role}
                  disabled={pending}
                  onChange={(e) => run(() => updateMemberRole(workspaceId, m.id, e.target.value), 'Role updated')}
                  className="h-9 rounded-lg border border-border bg-white px-2 text-sm"
                >
                  {roleOptions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs font-semibold uppercase text-muted-foreground">{m.role}</span>
              )}

              {canRemoveMember(actorRole, m.role, isSelf) && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm(`Remove ${m.name} from this workspace?`)) {
                      run(() => removeMember(workspaceId, m.id), 'Member removed')
                    }
                  }}
                >
                  Remove
                </Button>
              )}

              {isSelf && canLeaveWorkspace(m.role, ownerCount) && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm('Leave this workspace? You will lose access until someone invites you again.')) {
                      run(() => leaveWorkspace(workspaceId), 'You left the workspace', () => {
                        router.push('/dashboard')
                        router.refresh()
                      })
                    }
                  }}
                >
                  Leave
                </Button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
