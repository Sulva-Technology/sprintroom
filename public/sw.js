self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Very basic network-first with offline fallback strategy for app shell
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  
  // Only handle GET requests for navigation or standard assets
  if (event.request.method !== 'GET') return
  
  // Skip API/Supabase calls from SW direct caching unless specifically handled
  if (url.hostname.includes('supabase.co')) return

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful GET requests for basic HTML/assets
        if (response.ok && (event.request.mode === 'navigate' || url.pathname.startsWith('/_next/static'))) {
          const resClone = response.clone()
          caches.open('sprintroom-app-shell').then(cache => {
            cache.put(event.request, resClone)
          })
        }
        return response
      })
      .catch(async () => {
        // Offline fallback
        const cache = await caches.open('sprintroom-app-shell')
        const cachedResponse = await cache.match(event.request)
        if (cachedResponse) {
          return cachedResponse
        }
        
        // If navigate request and not cached, return the offline page
        if (event.request.mode === 'navigate') {
          const offlineResponse = await cache.match('/offline')
          if (offlineResponse) return offlineResponse
          
          return new Response(
            '<html><body><h1>You are offline.</h1><p>Open SprintRoom to continue with your cached workspace, focus timer, and pending changes.</p></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          )
        }

        return new Response('', { status: 408, statusText: 'Request Timeout' })
      })
  )
})

// Listen for background sync if supported
self.addEventListener('sync', (event) => {
  if (event.tag === 'sprintroom-sync') {
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'trigger-sync' })
        })
      })
    )
  }
})

// --- Push Notification Handlers ---

self.addEventListener('push', function (event) {
  if (event.data) {
    try {
      const data = event.data.json()
      const title = data.title || 'Focus Session'
      const options = {
        body: data.body || 'You have a notification.',
        icon: '/favicon.ico', // You can update this to an app icon
        badge: '/favicon.ico',
        data: {
          url: data.url || '/'
        }
      }
      event.waitUntil(self.registration.showNotification(title, options))
    } catch (e) {
      console.error('Error parsing push data', e)
    }
  }
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const urlToOpen = event.notification.data.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
      let matchingClient = null
      for (let i = 0; i < windowClients.length; i++) {
        const windowClient = windowClients[i]
        // Simple check: if the client URL contains the target URL
        if (windowClient.url.includes(urlToOpen) || windowClient.url === new URL(urlToOpen, self.location.origin).href) {
          matchingClient = windowClient
          break
        }
      }
      if (matchingClient) {
        return matchingClient.focus()
      } else {
        return clients.openWindow(urlToOpen)
      }
    })
  )
})
