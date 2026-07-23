/**
 * SprintRoom service worker.
 *
 * Cache layout (all versioned together via CACHE_VERSION):
 *   static  - immutable Next build output (/_next/static). Cache-first, never revalidated.
 *   assets  - icons, sounds, fonts, images. Cache-first with network fill.
 *   pages   - navigation HTML. Network-first (short timeout) then cache then /offline.
 *   rsc     - App Router RSC payloads. Network-first then cache. Keyed by pathname
 *             only, because Next appends a volatile `?_rsc=<hash>` to every request.
 *
 * `pages` and `rsc` hold authenticated markup, so they are wiped on sign-out via
 * the CLEAR_APP_CACHE message.
 */
const CACHE_VERSION = 'v5';
const STATIC_CACHE = `sprintroom-static-${CACHE_VERSION}`;
const ASSET_CACHE = `sprintroom-assets-${CACHE_VERSION}`;
const PAGE_CACHE = `sprintroom-pages-${CACHE_VERSION}`;
const RSC_CACHE = `sprintroom-rsc-${CACHE_VERSION}`;

const CURRENT_CACHES = [STATIC_CACHE, ASSET_CACHE, PAGE_CACHE, RSC_CACHE];

// Caches holding per-user content. Cleared on sign-out.
const PRIVATE_CACHES = [PAGE_CACHE, RSC_CACHE];

const OFFLINE_URL = '/offline';

// How long a navigation waits for the network before falling back to cache.
// Keeps "lie-fi" (connected but no throughput) from hanging the app shell.
const NAVIGATION_TIMEOUT_MS = 3500;

const PRECACHE_ASSETS = [
  '/logo.png',
  '/favicon.ico',
  '/favicon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
  '/home-new.png',
  '/sounds/focus-start.mp3',
  '/sounds/focus-complete.mp3',
  '/sounds/break-start.mp3',
  '/sounds/warning.mp3',
  '/sounds/tick.mp3',
];

const PRECACHE_PAGES = ['/', OFFLINE_URL, '/login', '/signup'];

// Routes that must never be served from a stale cache: they either set auth
// cookies or depend entirely on a live server round-trip.
const NEVER_CACHE_PATHS = ['/auth/callback', '/api/'];

// Signed-in areas. A navigation into one of these that misses the cache falls
// back to the cached /dashboard shell rather than the generic offline page.
const APP_SHELL_PREFIXES = ['/dashboard', '/focus', '/team-pulse'];

const ASSET_EXTENSIONS = [
  '.css',
  '.js',
  '.mjs',
  '.woff',
  '.woff2',
  '.ttf',
  '.png',
  '.jpg',
  '.jpeg',
  '.svg',
  '.webp',
  '.avif',
  '.ico',
  '.mp3',
  '.json',
];

const FALLBACK_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>SprintRoom Offline</title>
    <style>
      body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f8fa;color:#0f172a;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      main{max-width:28rem;padding:2rem;text-align:center}
      h1{font-size:1.5rem;margin:0 0 .75rem}
      p{color:#475569;line-height:1.6}
    </style>
  </head>
  <body>
    <main>
      <h1>You are offline.</h1>
      <p>Open SprintRoom again after visiting a page online to keep using its cached version offline. Pending changes will sync when the network returns.</p>
    </main>
  </body>
</html>`;

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isNeverCached(url) {
  return NEVER_CACHE_PATHS.some((path) => url.pathname.startsWith(path));
}

function isImmutableStatic(url) {
  return url.pathname.startsWith('/_next/static/');
}

function isAssetRequest(url, request) {
  return (
    url.pathname.startsWith('/_next/image') ||
    url.pathname.startsWith('/static/') ||
    url.pathname.startsWith('/sounds/') ||
    ASSET_EXTENSIONS.some((extension) => url.pathname.endsWith(extension)) ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'audio'
  );
}

/**
 * An App Router flight request. Next marks these with an `RSC: 1` header (and a
 * `?_rsc=` cache-buster), so they never look like navigations.
 */
function isRscRequest(url, request) {
  const accept = request.headers.get('accept') || '';

  return (
    request.headers.get('rsc') === '1' ||
    url.searchParams.has('_rsc') ||
    accept.includes('text/x-component')
  );
}

function isNavigationRequest(request) {
  const accept = request.headers.get('accept') || '';

  return request.mode === 'navigate' || accept.includes('text/html');
}

/**
 * Cache key for a page or RSC response. Strips `_rsc` (rotates per build) and
 * any other query string so a warmed route matches what the router later asks
 * for. Search params are dropped deliberately: SprintRoom routes use them only
 * for transient UI state (`?new=true`, `?focus=<id>`), never for page identity.
 */
function routeCacheKey(url, suffix) {
  return new Request(`${url.origin}${url.pathname}${suffix}`, { method: 'GET' });
}

function pageKey(url) {
  return routeCacheKey(url, '');
}

function rscKey(url) {
  return routeCacheKey(url, '?__sw_rsc=1');
}

async function putIfCacheable(cacheName, key, response) {
  // `response.redirected` is the important one for navigations: the browser
  // follows /dashboard -> /login itself, and caching that body under the
  // dashboard key would render a login screen offline.
  if (
    !response ||
    !response.ok ||
    response.status !== 200 ||
    response.redirected ||
    response.type === 'opaqueredirect'
  ) {
    return false;
  }

  const cache = await caches.open(cacheName);
  await cache.put(key, response.clone());
  return true;
}

async function precache() {
  const assetCache = await caches.open(ASSET_CACHE);

  await Promise.all(
    PRECACHE_ASSETS.map(async (path) => {
      try {
        await assetCache.add(new Request(path, { cache: 'reload' }));
      } catch (error) {
        // A single missing asset must not abort the install.
      }
    }),
  );

  await Promise.all(
    PRECACHE_PAGES.map(async (path) => {
      try {
        const url = new URL(path, self.location.origin);
        // `redirect: 'manual'` matters: signed-in users are bounced from / to
        // /dashboard and signed-out users from protected routes to /login.
        // Following those would cache the wrong document under this key.
        const response = await fetch(
          new Request(url, { cache: 'reload', credentials: 'same-origin', redirect: 'manual' }),
        );

        if (await putIfCacheable(PAGE_CACHE, pageKey(url), response)) {
          await precacheReferencedStatics(await response.clone().text());
        }
      } catch (error) {
        // Protected or temporarily unavailable route; skip it.
      }
    }),
  );
}

async function removeOldCaches() {
  const cacheNames = await caches.keys();

  await Promise.all(
    cacheNames
      .filter((cacheName) => cacheName.startsWith('sprintroom-') && !CURRENT_CACHES.includes(cacheName))
      .map((cacheName) => caches.delete(cacheName)),
  );
}

/** Drop every cache holding signed-in content. Used on sign-out. */
async function clearPrivateCaches() {
  await Promise.all(PRIVATE_CACHES.map((cacheName) => caches.delete(cacheName)));
}

// --- Strategies -------------------------------------------------------------

async function cacheFirst(cacheName, request) {
  const cached = await caches.match(request, { cacheName });

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    await putIfCacheable(cacheName, request, response);
    return response;
  } catch (error) {
    if (request.destination === 'image') {
      const fallbackImage = await caches.match('/icon-192.png', { cacheName: ASSET_CACHE });
      if (fallbackImage) return fallbackImage;
    }

    return new Response('Asset unavailable offline', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

/** fetch() that rejects once `ms` elapses, so a stalled request can fall back. */
function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Network timeout')), ms);

    fetch(request).then(
      (response) => {
        clearTimeout(timer);
        resolve(response);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function handleNavigation(request) {
  const url = new URL(request.url);
  const key = pageKey(url);

  try {
    const response = await fetchWithTimeout(request, NAVIGATION_TIMEOUT_MS);
    await putIfCacheable(PAGE_CACHE, key, response);
    return response;
  } catch (error) {
    const cached = await caches.match(key, { cacheName: PAGE_CACHE });

    if (cached) {
      return cached;
    }

    // Cold offline start on a signed-in route we never cached (a deep link, or
    // a route added since the last warm). Sign-in is impossible offline, so the
    // useful answer is the cached app shell, not a dead end: /dashboard renders
    // from IndexedDB and the client router can take it from there.
    if (APP_SHELL_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
      const shell = await caches.match(pageKey(new URL('/dashboard', url.origin)), {
        cacheName: PAGE_CACHE,
      });

      if (shell) {
        return shell;
      }
    }

    const offlinePage = await caches.match(pageKey(new URL(OFFLINE_URL, url.origin)), {
      cacheName: PAGE_CACHE,
    });

    return (
      offlinePage ||
      new Response(FALLBACK_HTML, {
        headers: { 'content-type': 'text/html; charset=utf-8' },
        status: 200,
      })
    );
  }
}

async function handleRsc(request) {
  const url = new URL(request.url);
  const key = rscKey(url);

  try {
    const response = await fetchWithTimeout(request, NAVIGATION_TIMEOUT_MS);
    await putIfCacheable(RSC_CACHE, key, response);
    return response;
  } catch (error) {
    const cached = await caches.match(key, { cacheName: RSC_CACHE });

    if (cached) {
      return cached;
    }

    // No cached payload: fail the flight request so the App Router falls back to
    // a full navigation, which handleNavigation can answer from the page cache.
    return new Response('', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

async function networkFirst(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const cached = await caches.match(request);

    if (cached) {
      return cached;
    }

    return new Response('Network unavailable', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

const NEXT_STATIC_REFERENCE = /\/_next\/static\/[A-Za-z0-9._\-/@%]+?\.(?:js|css|woff2?)/g;

/**
 * Pull the /_next/static chunk and stylesheet URLs out of a warmed document and
 * cache them.
 *
 * Warming the HTML alone is not enough: the document is only markup, and its
 * JS/CSS are separate requests the browser would make at render time. Offline,
 * those requests would miss and the route would fail to hydrate. A route's
 * server-rendered HTML (and its RSC payload) lists exactly the chunks that
 * route needs, so parsing them is what makes a never-visited route usable.
 */
async function precacheReferencedStatics(text) {
  const matches = text.match(NEXT_STATIC_REFERENCE);

  if (!matches) return;

  const cache = await caches.open(STATIC_CACHE);
  const paths = Array.from(new Set(matches));

  await Promise.all(
    paths.map(async (path) => {
      const request = new Request(new URL(path, self.location.origin));

      // Build output is content-hashed and immutable, so an existing entry is
      // always current and re-fetching it would be pure waste.
      if (await cache.match(request)) return;

      try {
        const response = await fetch(request);
        if (response.ok && response.status === 200) {
          await cache.put(request, response);
        }
      } catch (error) {
        // Chunk unavailable right now; the next warm picks it up.
      }
    }),
  );
}

/**
 * Fetch a route's HTML and RSC payload into the cache without rendering it, so
 * it is available offline even if the user never opened it. Driven by the
 * client via the WARM_ROUTES message.
 */
async function warmRoutes(paths) {
  let warmed = 0;

  for (const path of paths) {
    const url = new URL(path, self.location.origin);

    if (!isSameOrigin(url) || isNeverCached(url)) {
      continue;
    }

    try {
      const htmlResponse = await fetch(
        new Request(url, {
          credentials: 'same-origin',
          headers: { accept: 'text/html' },
          // Never follow: an expired session redirects to /login, and caching
          // that under a dashboard route would show a login page offline.
          redirect: 'manual',
        }),
      );

      const html = await htmlResponse.clone().text();

      if (await putIfCacheable(PAGE_CACHE, pageKey(url), htmlResponse)) {
        warmed += 1;
        await precacheReferencedStatics(html);
      }
    } catch (error) {
      // Offline again mid-warm; stop trying the rest.
      console.warn('[sw] warm failed for', path, error);
      await notifyClients({ type: 'sprintroom-warm-complete', warmed, error: String(error) });
      return;
    }

    try {
      const rscResponse = await fetch(
        new Request(url, {
          credentials: 'same-origin',
          headers: { RSC: '1', accept: 'text/x-component' },
          // Never follow: an expired session redirects to /login, and caching
          // that under a dashboard route would show a login page offline.
          redirect: 'manual',
        }),
      );

      const flight = await rscResponse.clone().text();

      if (await putIfCacheable(RSC_CACHE, rscKey(url), rscResponse)) {
        await precacheReferencedStatics(flight);
      }
    } catch (error) {
      console.warn('[sw] warm failed for', path, error);
      await notifyClients({ type: 'sprintroom-warm-complete', warmed, error: String(error) });
      return;
    }
  }

  await notifyClients({ type: 'sprintroom-warm-complete', warmed });
}

async function notifyClients(message) {
  const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });

  clientList.forEach((client) => client.postMessage(message));
}

// --- Lifecycle --------------------------------------------------------------

self.addEventListener('install', (event) => {
  // Deliberately no skipWaiting() here. Activating immediately would delete the
  // previous build's caches while open tabs are still requesting its chunks,
  // breaking navigation mid-session. The client shows an update prompt and
  // sends SKIP_WAITING when the user accepts. A first install has no controller
  // to displace, so it activates right away regardless.
  event.waitUntil(precache());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await removeOldCaches();

      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.disable();
      }

      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Supabase and every other origin stay on the network; their failures are
  // what the offline queue reacts to.
  if (!isSameOrigin(url) || isNeverCached(url)) {
    return;
  }

  if (isImmutableStatic(url)) {
    event.respondWith(cacheFirst(STATIC_CACHE, request));
    return;
  }

  // RSC is checked before navigation: flight requests can carry an html-ish
  // Accept header and would otherwise be cached as a page.
  if (isRscRequest(url, request)) {
    event.respondWith(handleRsc(request));
    return;
  }

  if (isNavigationRequest(request)) {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (isAssetRequest(url, request)) {
    event.respondWith(cacheFirst(ASSET_CACHE, request));
    return;
  }

  event.respondWith(networkFirst(request));
});

self.addEventListener('message', (event) => {
  const data = event.data;

  if (!data || typeof data.type !== 'string') {
    return;
  }

  switch (data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    case 'CLEAR_APP_CACHE':
      event.waitUntil(clearPrivateCaches());
      break;
    case 'WARM_ROUTES':
      if (Array.isArray(data.paths)) {
        event.waitUntil(warmRoutes(data.paths));
      }
      break;
    default:
      break;
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sprintroom-sync') {
    event.waitUntil(notifyClients({ type: 'sprintroom-sync' }));
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'You have an upcoming task execution.',
      icon: '/icon-192.png',
      badge: '/favicon.png',
      data,
      vibrate: [200, 100, 200],
      tag: data.tag || 'sprintroom-task',
      renotify: true,
      actions: [
        { action: 'focus', title: 'Start Focus' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'SprintRoom Execution', options),
    );
  } catch (error) {
    console.error('Error handling push event:', error);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const taskId = event.notification.data?.taskId;
  const urlToOpen = event.action === 'focus' && taskId ? `/dashboard?focus=${taskId}` : '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }

      return undefined;
    }),
  );
});
