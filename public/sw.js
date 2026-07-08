// Minimal pass-through service worker: Chrome wants a fetch handler before it
// offers the install prompt. No caching — offline support is out of scope
// (see the mobile optimization spec).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
