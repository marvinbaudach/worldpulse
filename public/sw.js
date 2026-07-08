// Minimal service worker: Chrome wants a fetch handler before it offers the
// install prompt. The handler is deliberately empty — Chrome detects no-op
// handlers and skips the worker for requests entirely (native networking,
// zero overhead). No caching — offline support is out of scope (see the
// mobile optimization spec).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
