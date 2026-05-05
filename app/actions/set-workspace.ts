'use server'

import { cookies } from 'next/headers'

export async function setActiveWorkspaceAction(workspaceId: string) {
  const cookieStore = await cookies()
  cookieStore.set('active_workspace_id', workspaceId, {
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    sameSite: 'lax',
  })
  return { success: true }
}
