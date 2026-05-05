const CACHE_NAME = 'sprintroom-pwa-v2';

// Cache essential static assets and offline page
const PRECACHE_URLS = [
  '/',
  '/offline',
  '/logo.png',
  '/favicon.png'
];

self.addEventListener('install', (event) => {
  // Force waiting service worker to become active
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', (event) => {
  // Claim any clients immediately
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
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) return;

  // Skip API routes, Supabase calls, Next.js internal endpoints
  if (
    event.request.url.includes('/api/') || 
    event.request.url.includes('supabase.co') ||
    event.request.url.includes('/_next/data/')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Return cached response if found
        if (cachedResponse) {
          return cachedResponse;
        }

        // Otherwise fetch from network
        return fetch(event.request).catch(() => {
          // If network fetch fails (offline), return the offline page
          // Specifically check for navigate requests (HTML documents)
          if (event.request.mode === 'navigate' || event.request.headers.get('accept').includes('text/html')) {
            return caches.match('/offline');
          }
          return null;
        });
      })
  );
});
