const CACHE_NAME = 'syncchat-v4';
const PRECACHE_URLS = ['/', '/manifest.json', '/placeholder.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch((error) => {
        console.warn('[SW] Precache failed:', error);
      })
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      )
    )
  );
  self.clients.claim();
});

function shouldBypass(request) {
  const url = new URL(request.url);

  if (request.method !== 'GET') return true;
  if (url.origin !== self.location.origin) return true;
  if (url.pathname.startsWith('/assets/')) return true;
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) return true;
  if (url.pathname.endsWith('.map')) return true;
  if (url.pathname.includes('/api/')) return true;
  if (url.hostname.endsWith('.supabase.co')) return true;
  if (url.pathname.includes('/auth/')) return true;
  if (url.pathname.includes('/realtime/')) return true;
  if (url.pathname.includes('/rest/v1/')) return true;
  if (url.pathname.includes('/functions/v1/')) return true;

  return false;
}

self.addEventListener('fetch', (event) => {
  if (shouldBypass(event.request)) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((cached) => cached || caches.match('/'))
        )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200) return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    })
  );
});

self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New notification',
    icon: '/placeholder.svg',
    badge: '/placeholder.svg',
  };

  event.waitUntil(self.registration.showNotification('SyncChat', options));
});
