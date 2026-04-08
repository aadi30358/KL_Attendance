const CACHE_NAME = 'kl-attendance-v7';

const ASSETS_TO_CACHE = [
  './',
  'index.html',
  'manifest.json',
  'vite.svg',
  'icon-192.png',
  'icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  
  // CRITICAL: NEVER cache API calls or the ERP proxy
  // If we cache /index.php, it caches a STALE CSRF token, breaking login!
  if (url.pathname.startsWith('/api') || url.pathname.includes('index.php')) {
    return; // Bypass service worker entirely, go straight to network
  }

  // Network-First strategy for Navigation (HTML)
  // Ensures users ALWAYS get the latest index.html and clears bricked cache automatically
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
          return response;
        })
        .catch(() => caches.match(event.request).then(res => res || caches.match('/')))
    );
    return;
  }

  // Cache-First strategy for Assets (JS, CSS, images)
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request).then(fetchResponse => {
          // Don't cache if not a valid response or if it's external
          if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
            return fetchResponse;
          }

          const responseToCache = fetchResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });

          return fetchResponse;
        });
      })
  );
});

