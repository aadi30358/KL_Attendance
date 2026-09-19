// Ultra-clean high-speed Service Worker: zero stale cache, instant updates in seconds
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Pass all requests directly to high-speed network / CDN so mobile receives updates in seconds
self.addEventListener('fetch', (event) => {
  return;
});
