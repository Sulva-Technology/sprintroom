const CACHE_NAME = 'sprintroom-pwa-v4';
const OFFLINE_URL = '/offline';

const PRECACHE_URLS = [
  '/',
  OFFLINE_URL,
  '/login',
  '/signup',
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

const ASSET_EXTENSIONS = [
  '.css',
  '.js',
  '.woff',
  '.woff2',
  '.png',
  '.jpg',
  '.jpeg',
  '.svg',
  '.webp',
  '.ico',
  '.mp3',
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

function isAssetRequest(url, request) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/_next/image') ||
    url.pathname.startsWith('/static/') ||
    url.pathname.includes('/_next/data/') ||
    ASSET_EXTENSIONS.some((extension) => url.pathname.endsWith(extension)) ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'audio'
  );
}

function isPageRequest(request) {
  const accept = request.headers.get('accept') || '';

  return request.mode === 'navigate' || accept.includes('text/html');
}

function isAppDataRequest(url, request) {
  const accept = request.headers.get('accept') || '';

  return (
    request.headers.get('rsc') === '1' ||
    url.searchParams.has('_rsc') ||
    accept.includes('text/x-component')
  );
}

async function openAppCache() {
  return caches.open(CACHE_NAME);
}

async function putIfCacheable(request, response) {
  if (!response || !response.ok || response.status !== 200) {
    return;
  }

  const cache = await openAppCache();
  await cache.put(request, response.clone());
}

async function preloadCoreAssets() {
  await Promise.all(
    PRECACHE_URLS.map(async (url) => {
      try {
        const response = await fetch(new Request(url, { cache: 'reload' }));
        await putIfCacheable(url, response);
      } catch (error) {
        // A single protected or temporarily unavailable route should not break PWA install.
      }
    }),
  );
}

async function removeOldCaches() {
  const cacheNames = await caches.keys();

  await Promise.all(
    cacheNames.map((cacheName) => {
      if (cacheName !== CACHE_NAME) {
        return caches.delete(cacheName);
      }
      return undefined;
    }),
  );
}

async function updateCache(request) {
  const response = await fetch(request);
  await putIfCacheable(request, response);
  return response;
}

async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    return await updateCache(request);
  } catch (error) {
    const fallbackImage = await caches.match('/icon-192.png');

    if (request.destination === 'image' && fallbackImage) {
      return fallbackImage;
    }

    return new Response('Asset unavailable offline', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

async function staleWhileRevalidate(request) {
  const cachedResponse = await caches.match(request);
  const networkResponsePromise = updateCache(request);

  if (cachedResponse) {
    networkResponsePromise.catch(() => undefined);
    return cachedResponse;
  }

  try {
    return await networkResponsePromise;
  } catch (error) {
    const offlineResponse = await caches.match(OFFLINE_URL);

    return offlineResponse || new Response(FALLBACK_HTML, {
      headers: { 'content-type': 'text/html; charset=utf-8' },
      status: 200,
    });
  }
}

async function networkFirst(request) {
  try {
    return await updateCache(request);
  } catch (error) {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    return new Response('Network unavailable', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

async function notifyClientsToSync() {
  const clientList = await clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });

  clientList.forEach((client) => {
    client.postMessage({ type: 'sprintroom-sync' });
  });
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(preloadCoreAssets());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      removeOldCaches(),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (!isSameOrigin(url) || url.hostname.includes('supabase.co')) {
    return;
  }

  if (isAssetRequest(url, request)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (isPageRequest(request)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (isAppDataRequest(url, request)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  event.respondWith(networkFirst(request));
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sprintroom-sync') {
    event.waitUntil(notifyClientsToSync());
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
