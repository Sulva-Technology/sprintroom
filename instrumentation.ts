/**
 * Runs once per server process, before any request is handled.
 * Used to surface silently-disabled integrations in the startup log.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { reportIntegrationStatus } = await import('@/lib/config/integrations')
  reportIntegrationStatus()
}
