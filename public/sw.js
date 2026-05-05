const CACHE_NAME = 'sprintroom-pwa-v1';

// Add whateveryou want here
const PRECACHE_URLS = [
  '/',
  '/offline',
  '/logo.png',
  '/favicon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) return;

  // Skip API routes and Supabase calls
  if (event.request.url.includes('/api/') || event.request.url.includes('supabase.co')) return;

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }

        return fetch(event.request).catch(() => {
          // If network fetch fails (offline), return the offline page
          // if it's a navigation request
          if (event.request.mode === 'navigate') {
            return caches.match('/offline');
          }
          return null;
        });
      })
  );
});
