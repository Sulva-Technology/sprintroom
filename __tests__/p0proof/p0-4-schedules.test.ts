import { describe, expect, it, vi, beforeEach } from 'vitest'
import { makeFakeSupabase } from './stubs/fake-postgrest'
import * as denoHttp from './stubs/deno-http'
import * as supabaseStub from './stubs/supabase-js'
import webpush from './stubs/web-push'

/**
 * P0-4. Executes the REAL process-schedules source. The fake PostgREST returns
 * PGRST200 for any select that tries to embed a table it has no FK to — the
 * same failure the live API returns. If the embed is still there the schedule
 * query fails and NO push is ever sent.
 *
 * The assertion is behavioural: did a notification actually go out?
 */

const handlers = new Map<string, any>()

async function run(modulePath: string) {
  ;(globalThis as any).Deno = {
    env: {
      get: (key: string) =>
        ({
          CRON_SECRET: 'test-secret',
          SUPABASE_URL: 'http://localhost',
          SUPABASE_SERVICE_ROLE_KEY: 'service-role',
          NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'vapid-public',
          VAPID_PRIVATE_KEY: 'vapid-private',
          VAPID_SUBJECT: 'mailto:test@example.com',
        })[key],
    },
  }

  const soon = new Date(Date.now() + 2 * 60 * 1000).toISOString()

  const supabase = makeFakeSupabase({
    focus_schedules: [{ id: 'sched-1', user_id: 'user-1', start_time: soon, notified_started_at: null }],
    web_push_subscriptions: [
      { user_id: 'user-1', endpoint: 'https://push.example/1', keys_p256dh: 'p', keys_auth: 'a' },
    ],
  })
  supabaseStub.__setClient(supabase)

  if (!handlers.has(modulePath)) {
    denoHttp.__reset()
    await import(modulePath)
    handlers.set(modulePath, denoHttp.__getHandler())
  }

  const response = await handlers.get(modulePath)(
    new Request('http://localhost', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-secret' },
    }),
  )

  return { supabase, response, body: await response.json() }
}

describe('P0-4 process-schedules delivers a notification', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.clearAllMocks()
  })

  it('CURRENT working tree: a push is actually sent', async () => {
    const send = vi.spyOn(webpush, 'sendNotification')

    const { supabase, response, body } = await run(
      '../../supabase/functions/process-schedules/index.ts',
    )

    expect(response.status).toBe(200)
    expect(send, 'no push notification was sent').toHaveBeenCalled()
    expect(body.warningsSent).toBe(1)

    // Subscriptions came from their own query, not an embed.
    const embeds = supabase.calls.filter((c) => /\w+\s*\(/.test(c.select ?? ''))
    expect(embeds, 'a PostgREST embed is still being used').toHaveLength(0)
    expect(supabase.calls.some((c) => c.table === 'web_push_subscriptions')).toBe(true)
  })

  it('DISCRIMINATOR — the same test against HEAD (pre-fix) sends nothing', async () => {
    const send = vi.spyOn(webpush, 'sendNotification')
    const { body } = await run('./head/schedules.head.ts')
    console.log('HEAD body', JSON.stringify(body))
    expect(send).not.toHaveBeenCalled()
    expect(body.warningsSent ?? 0).toBe(0) // pre-fix build has no counter at all
  })
})
