export interface RealtimeSubscriptionConfig {
  event: '*' | 'INSERT' | 'UPDATE' | 'DELETE'
  schema: 'public'
  table: string
  filter?: string
}

export function getWorkspaceRealtimeSubscriptions(workspaceId?: string): RealtimeSubscriptionConfig[] {
  if (!workspaceId) {
    return []
  }

  return [
    {
      event: '*',
      schema: 'public',
      table: 'tasks',
      filter: `workspace_id=eq.${workspaceId}`,
    },
    {
      event: '*',
      schema: 'public',
      table: 'projects',
      filter: `workspace_id=eq.${workspaceId}`,
    },
    {
      event: '*',
      schema: 'public',
      table: 'focus_sessions',
      filter: `workspace_id=eq.${workspaceId}`,
    },
  ]
}

export function getUserFocusSessionSubscription(userId: string): RealtimeSubscriptionConfig {
  return {
    event: 'INSERT',
    schema: 'public',
    table: 'focus_sessions',
    filter: `user_id=eq.${userId}`,
  }
}
