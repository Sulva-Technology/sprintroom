import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export const ACTIVE_WORKSPACE_COOKIE = 'active_workspace_id'

/**
 * Pure resolution of the active workspace id.
 *
 * The cookie wins only if it names a workspace the user is actually a member of
 * (so a stale cookie from a workspace they left, or one that never belonged to
 * them, can't scope the whole UI to nothing). Otherwise fall back to the first
 * membership. `orderedMembershipIds` MUST be passed in a stable order (we use
 * workspace_members.created_at) so every surface picks the SAME fallback — the
 * root cause of the old "workspaces are messy" behaviour was each page rolling
 * its own unordered `[0]`.
 */
export function pickActiveWorkspaceId(
  cookieId: string | undefined | null,
  orderedMembershipIds: string[],
): string | undefined {
  if (cookieId && orderedMembershipIds.includes(cookieId)) {
    return cookieId
  }
  return orderedMembershipIds[0]
}

/**
 * The single source of truth for "which workspace am I looking at" on the
 * server. Read-only (safe to call from server components): it never writes the
 * cookie, so callers in a render pass won't trip Next's cookie-mutation guard.
 * The cookie is (re)written on login and on an explicit switch instead.
 */
export async function resolveActiveWorkspaceId(): Promise<string | undefined> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return undefined

  const { data } = await supabase
    .from('workspace_members')
    .select('workspace_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const orderedMembershipIds = (data || []).map((m) => m.workspace_id as string)
  const cookieId = (await cookies()).get(ACTIVE_WORKSPACE_COOKIE)?.value

  return pickActiveWorkspaceId(cookieId, orderedMembershipIds)
}
