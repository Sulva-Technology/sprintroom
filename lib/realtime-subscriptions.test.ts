import { describe, expect, it } from 'vitest'

import {
  getWorkspaceRealtimeSubscriptions,
  getUserFocusSessionSubscription,
} from './realtime-subscriptions'

describe('realtime subscription helpers', () => {
  it('builds workspace-scoped realtime subscriptions for the published tables', () => {
    const subscriptions = getWorkspaceRealtimeSubscriptions('workspace-123')

    expect(subscriptions).toEqual([
      {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: 'workspace_id=eq.workspace-123',
      },
      {
        event: '*',
        schema: 'public',
        table: 'projects',
        filter: 'workspace_id=eq.workspace-123',
      },
      {
        event: '*',
        schema: 'public',
        table: 'focus_sessions',
        filter: 'workspace_id=eq.workspace-123',
      },
    ])
  })

  it('returns no workspace-scoped subscriptions when there is no workspace id', () => {
    expect(getWorkspaceRealtimeSubscriptions(undefined)).toEqual([])
  })

  it('builds a user-scoped focus-session subscription', () => {
    expect(getUserFocusSessionSubscription('user-456')).toEqual({
      event: 'INSERT',
      schema: 'public',
      table: 'focus_sessions',
      filter: 'user_id=eq.user-456',
    })
  })
})
