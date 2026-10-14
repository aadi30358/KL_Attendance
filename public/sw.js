// KL Attendance - High-Speed Service Worker
// Cache Storage is kept clean to prevent public inspection of client assets

const CACHE_NAME = 'kl-attendance-v1792001494825';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING' || event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', () => {
  // Pass-through to browser HTTP cache for instant performance without exposing assets in DevTools Cache Storage
  return;
});
