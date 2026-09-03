// SeePOINT PWA: cache only a data-free offline fallback and public icons.
// Authenticated pages and API responses must never be persisted by the worker.
const CACHE_NAME = 'seepoint-pwa-v2';
const PRECACHE_URLS = [
  '/offline.html',
  '/seepoint-app-icon.svg',
  '/seepoint-app-icon-192.png',
  '/seepoint-app-icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith('seepoint-pwa-') && name !== CACHE_NAME).map((name) => caches.delete(name)))),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.mode !== 'navigate') return;

  event.respondWith(
    fetch(request).catch(async () => {
      const cached = await caches.match('/offline.html');
      return cached || new Response('Aplikace je offline.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }),
  );
});
