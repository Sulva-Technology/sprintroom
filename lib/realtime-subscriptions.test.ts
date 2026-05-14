import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getWorkspaceRealtimeSubscriptions,
  getUserFocusSessionSubscription,
} from './realtime-subscriptions.ts'

test('builds workspace-scoped realtime subscriptions for the published tables', () => {
  const subscriptions = getWorkspaceRealtimeSubscriptions('workspace-123')

  assert.deepEqual(subscriptions, [
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

test('returns no workspace-scoped subscriptions when there is no workspace id', () => {
  assert.deepEqual(getWorkspaceRealtimeSubscriptions(undefined), [])
})

test('builds a user-scoped focus-session subscription', () => {
  assert.deepEqual(getUserFocusSessionSubscription('user-456'), {
    event: 'INSERT',
    schema: 'public',
    table: 'focus_sessions',
    filter: 'user_id=eq.user-456',
  })
})
