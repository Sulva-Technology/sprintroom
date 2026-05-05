const CACHE_NAME = 'sprintroom-pwa-v3';

// Pre-cache core shell assets
const PRECACHE_URLS = [
  '/',
  '/offline',
  '/logo.png',
  '/favicon.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Only handle GET requests
  if (request.method !== 'GET') return;

  // 2. Skip Supabase / External APIs (handled by lib/offline)
  if (url.hostname.includes('supabase.co')) return;

  // 3. For Static Assets & Next.js Data
  // Use Cache-First for assets, Stale-While-Revalidate for data
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/static/') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.includes('/_next/data/') // Cache Next.js pre-fetch data
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse.ok) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        });

        // For assets, return cache immediately. For data, we can be more flexible.
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 4. For Navigation & Pages
  // Use Stale-While-Revalidate so user sees content immediately but it updates in background
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
            return networkResponse;
          })
          .catch(() => {
            // If offline and no cache, show offline page
            return caches.match('/offline');
          });

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 5. Default: Network first, then cache
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // Only cache successful GET responses
        if (networkResponse.ok && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => caches.match(request))
  );
});
