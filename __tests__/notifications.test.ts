import { describe, expect, it } from 'vitest'
import { describeNotification } from '@/lib/notifications'
import { getUserNotificationSubscription } from '@/lib/realtime-subscriptions'

describe('describeNotification', () => {
  it('describes each event type', () => {
    expect(describeNotification({ type: 'assigned', actorName: 'Ada', taskTitle: 'Ship v2', body: null })).toBe('Ada assigned you "Ship v2"')
    expect(describeNotification({ type: 'comment', actorName: 'Ada', taskTitle: 'Ship v2', body: 'looks good' })).toBe(
      'Ada commented on "Ship v2": looks good'
    )
    expect(describeNotification({ type: 'blocked', actorName: 'Ada', taskTitle: 'Ship v2', body: 'waiting on API' })).toBe(
      'Ada marked "Ship v2" blocked: waiting on API'
    )
  })
  it('falls back gracefully when names are missing', () => {
    expect(describeNotification({ type: 'assigned', actorName: null, taskTitle: null, body: null })).toBe('Someone assigned you a task')
  })
})

describe('notification realtime subscription', () => {
  it('listens for new rows addressed to the user', () => {
    expect(getUserNotificationSubscription('user-1')).toEqual({
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: 'user_id=eq.user-1',
    })
  })
})
