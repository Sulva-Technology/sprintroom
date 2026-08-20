import { describe, expect, it, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * P0-1. Loads the REAL .env the same way the app does and runs the REAL
 * integration gate. Fails while any integration is still unconfigured.
 *
 * Local .env only — this says nothing about the deploy target's secret store.
 */
function loadEnv() {
  const raw = readFileSync(join(__dirname, '..', '..', '.env'), 'utf8')
  for (const line of raw.split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (!match) continue
    process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '')
  }
}

describe('P0-1 required env keys are populated', () => {
  beforeEach(loadEnv)

  it('every integration reports itself configured', async () => {
    const { getIntegrationStatus } = await import('@/lib/config/integrations')
    const unconfigured = getIntegrationStatus().filter((entry) => entry.missing.length > 0)

    console.log(
      'unconfigured integrations:',
      JSON.stringify(unconfigured.map((e) => ({ name: e.name, missing: e.missing })), null, 2),
    )

    expect(unconfigured.map((e) => e.name)).toEqual([])
  })
})
