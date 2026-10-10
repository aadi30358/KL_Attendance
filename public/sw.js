// KL Attendance - High-Speed Real-time Service Worker
// Automatically versioned on build to guarantee zero-lag deployment updates

const CACHE_NAME = 'kl-attendance-v1791641702638';
const STATIC_EXTENSIONS = ['.js', '.css', '.woff2', '.woff', '.ttf', '.svg', '.png', '.webp', '.ico'];

self.addEventListener('install', () => {
  // Activate new service worker immediately without waiting for tabs to close
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING' || event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, non-http, internal Vite/HMR, version.json, sw.js, and API/Firestore requests
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;
  if (url.pathname === '/version.json' || url.pathname === '/sw.js' || url.search.includes('_t=')) return;
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('firestore') || url.hostname.includes('firebaseio.com')) return;
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/index.php')) return;

  const ext = url.pathname.slice(url.pathname.lastIndexOf('.'));
  const isStatic = STATIC_EXTENSIONS.includes(ext);

  if (isStatic) {
    // Stale-While-Revalidate: serve cached version instantly for 60fps speed, refresh in background
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const cached = await cache.match(request);
          if (cached) {
            // Revalidate in background
            fetch(request).then((networkRes) => {
              if (networkRes && networkRes.ok) {
                cache.put(request, networkRes.clone());
              }
            }).catch(() => {});
            return cached;
          }
          const networkRes = await fetch(request);
          if (networkRes && networkRes.ok) {
            cache.put(request, networkRes.clone());
          }
          return networkRes;
        } catch {
          const fallback = await cache.match(request);
          if (fallback) return fallback;
          return fetch(request);
        }
      })
    );
  } else {
    // Network-First for HTML navigation: always get the absolute latest build from server
    event.respondWith(
      fetch(request)
        .then((networkRes) => {
          if (networkRes && networkRes.ok) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
          }
          return networkRes;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const fallbackIndex = await caches.match('/');
          if (fallbackIndex) return fallbackIndex;
          const fallbackHtml = await caches.match('/index.html');
          if (fallbackHtml) return fallbackHtml;
          return new Response(
            '<!DOCTYPE html><html><body><h1>Offline</h1><p>Please check your connection and reload.</p></body></html>',
            { status: 200, headers: { 'Content-Type': 'text/html' } }
          );
        })
    );
  }
});
