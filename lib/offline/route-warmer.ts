/**
 * Route warming: pull the HTML + RSC payload for every important route into the
 * service worker's cache while the network is up, so those routes still render
 * after the connection drops — even if the user never opened them this session.
 *
 * Without this, offline navigation only works for pages that happened to be
 * visited beforehand, which is not "works offline" in any useful sense.
 */

/** Routes every signed-in user can reach. */
export const CORE_APP_ROUTES = [
  '/',
  '/offline',
  '/dashboard',
  '/dashboard/projects',
  '/dashboard/focus',
  '/dashboard/team',
  '/dashboard/rhythms',
  '/dashboard/settings',
  '/dashboard/finances',
  '/dashboard/invites',
  '/team-pulse',
]

const WARM_INTERVAL_MS = 10 * 60 * 1000
const LAST_WARM_KEY = 'sprintroom:last-route-warm'

function readLastWarm(): number {
  try {
    return Number(localStorage.getItem(LAST_WARM_KEY) || 0)
  } catch {
    return 0
  }
}

function writeLastWarm(value: number) {
  try {
    localStorage.setItem(LAST_WARM_KEY, String(value))
  } catch {
    // Private mode / storage disabled: warming just runs more often.
  }
}

export function isWarmDue(now = Date.now()) {
  return now - readLastWarm() > WARM_INTERVAL_MS
}

/**
 * Ask the active service worker to cache `paths`. Resolves immediately — the
 * worker does the fetching in the background via event.waitUntil.
 */
export async function warmRoutes(paths: string[]) {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  if (!navigator.onLine) return
  if (paths.length === 0) return

  const registration = await navigator.serviceWorker.ready
  const worker = registration.active

  if (!worker) return

  // De-duplicate so a project appearing in several lists is fetched once.
  worker.postMessage({ type: 'WARM_ROUTES', paths: Array.from(new Set(paths)) })
  writeLastWarm(Date.now())
}

/** Drop cached signed-in HTML/RSC. Call on sign-out. */
export async function clearPrivateCaches() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  try {
    const registration = await navigator.serviceWorker.ready
    registration.active?.postMessage({ type: 'CLEAR_APP_CACHE' })
  } catch {
    // No worker registered; nothing cached to clear.
  }

  try {
    localStorage.removeItem(LAST_WARM_KEY)
  } catch {
    // Ignore.
  }
}
