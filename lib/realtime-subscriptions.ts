export interface RealtimeSubscriptionConfig {
  event: '*' | 'INSERT' | 'UPDATE' | 'DELETE'
  schema: 'public'
  table: string
  filter?: string
}

const WORKSPACE_REALTIME_TABLES = [
  'tasks',
  'projects',
  'focus_sessions',
  'task_comments',
  'task_activity',
  'workspace_members',
] as const

export function getWorkspaceRealtimeSubscriptions(workspaceId?: string): RealtimeSubscriptionConfig[] {
  if (!workspaceId) {
    return []
  }

  return WORKSPACE_REALTIME_TABLES.map((table) => ({
    event: '*' as const,
    schema: 'public' as const,
    table,
    filter: `workspace_id=eq.${workspaceId}`,
  }))
}

export function getUserFocusSessionSubscription(userId: string): RealtimeSubscriptionConfig {
  return {
    event: 'INSERT',
    schema: 'public',
    table: 'focus_sessions',
    filter: `user_id=eq.${userId}`,
  }
}

export function getUserNotificationSubscription(userId: string): RealtimeSubscriptionConfig {
  return {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
    filter: `user_id=eq.${userId}`,
  }
}
