'use server'

import { cookies } from 'next/headers'
import { ACTIVE_WORKSPACE_COOKIE, ACTIVE_WORKSPACE_COOKIE_OPTIONS } from '@/lib/workspace/active-workspace'

export async function setActiveWorkspaceAction(workspaceId: string) {
  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, ACTIVE_WORKSPACE_COOKIE_OPTIONS)
  return { success: true }
}
