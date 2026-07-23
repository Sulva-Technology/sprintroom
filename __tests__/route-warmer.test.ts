import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { CORE_APP_ROUTES, isWarmDue, warmRoutes, clearPrivateCaches } from '@/lib/offline/route-warmer'

const LAST_WARM_KEY = 'sprintroom:last-route-warm'

function mockServiceWorker(postMessage = vi.fn()) {
  const active = { postMessage }
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve({ active }) },
  })
  return postMessage
}

describe('route warmer', () => {
  beforeEach(() => {
    localStorage.clear()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('covers every signed-in top-level route', () => {
    for (const route of ['/dashboard', '/dashboard/projects', '/dashboard/focus', '/offline']) {
      expect(CORE_APP_ROUTES).toContain(route)
    }
  })

  it('is due when nothing has ever been warmed', () => {
    expect(isWarmDue()).toBe(true)
  })

  it('throttles repeat warms within the interval but allows them after it', () => {
    const now = Date.now()
    localStorage.setItem(LAST_WARM_KEY, String(now))

    expect(isWarmDue(now + 60_000)).toBe(false)
    expect(isWarmDue(now + 11 * 60_000)).toBe(true)
  })

  it('sends de-duplicated paths to the service worker and records the run', async () => {
    const postMessage = mockServiceWorker()

    await warmRoutes(['/dashboard', '/dashboard', '/dashboard/projects'])

    expect(postMessage).toHaveBeenCalledWith({
      type: 'WARM_ROUTES',
      paths: ['/dashboard', '/dashboard/projects'],
    })
    expect(isWarmDue()).toBe(false)
  })

  it('does not warm while offline', async () => {
    const postMessage = mockServiceWorker()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })

    await warmRoutes(['/dashboard'])

    expect(postMessage).not.toHaveBeenCalled()
  })

  it('tells the worker to drop private caches and resets the throttle on sign-out', async () => {
    const postMessage = mockServiceWorker()
    localStorage.setItem(LAST_WARM_KEY, String(Date.now()))

    await clearPrivateCaches()

    expect(postMessage).toHaveBeenCalledWith({ type: 'CLEAR_APP_CACHE' })
    expect(localStorage.getItem(LAST_WARM_KEY)).toBeNull()
  })
})
