/**
 * Which optional integrations are actually configured.
 *
 * Every integration in this app degrades silently when its key is missing —
 * AI returns "not configured", Resend returns `{ sent: false }`, the edge
 * functions 401 their own cron caller. That made "disabled" and "broken"
 * indistinguishable at runtime. `reportIntegrationStatus()` runs once at server
 * startup (see instrumentation.ts) so the gap is visible in the logs.
 */

export type IntegrationName = 'supabase-admin' | 'cron' | 'email' | 'ai' | 'web-push'

type IntegrationCheck = {
  name: IntegrationName
  /** Env vars that must ALL be non-empty. */
  requires: string[]
  /** What stops working while it is unconfigured. */
  disables: string
}

const CHECKS: IntegrationCheck[] = [
  {
    name: 'supabase-admin',
    requires: ['SUPABASE_SERVICE_ROLE_KEY'],
    disables: 'admin Supabase operations and the signup-confirmation email fallback',
  },
  {
    name: 'cron',
    requires: ['CRON_SECRET'],
    disables: 'recurring tasks, scheduled-session pushes and hourly rhythm nudges (every cron call is rejected with 401)',
  },
  {
    name: 'email',
    requires: ['RESEND_API_KEY', 'INVITE_EMAIL_FROM'],
    disables: 'workspace invite emails (invites are still created; the link must be shared manually)',
  },
  {
    name: 'ai',
    requires: ['GEMINI_API_KEY'],
    disables: 'AI task suggestions and financial insights',
  },
  {
    name: 'web-push',
    requires: ['NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'],
    disables: 'push notifications (browsers cannot subscribe)',
  },
]

function isSet(name: string) {
  const value = process.env[name]
  return typeof value === 'string' && value.trim().length > 0
}

/** Names of the required env vars that are missing or empty. */
export function missingKeysFor(name: IntegrationName): string[] {
  const check = CHECKS.find((candidate) => candidate.name === name)
  if (!check) return []
  return check.requires.filter((key) => !isSet(key))
}

export function isConfigured(name: IntegrationName) {
  return missingKeysFor(name).length === 0
}

export function getIntegrationStatus() {
  return CHECKS.map((check) => ({
    name: check.name,
    disables: check.disables,
    missing: check.requires.filter((key) => !isSet(key)),
  }))
}

/** Logs one line per unconfigured integration. Safe to call more than once. */
export function reportIntegrationStatus() {
  const unconfigured = getIntegrationStatus().filter((entry) => entry.missing.length > 0)

  if (unconfigured.length === 0) {
    console.log('[config] all integrations configured')
    return
  }

  console.warn(
    `[config] ${unconfigured.length} integration(s) disabled — set the keys in .env and in the deploy target:`,
  )

  for (const entry of unconfigured) {
    console.warn(`[config]   ${entry.name}: missing ${entry.missing.join(', ')} — disables ${entry.disables}`)
  }
}
