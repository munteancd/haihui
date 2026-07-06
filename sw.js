const CACHE = 'haihui-v14';
const ASSETS = ['./', './index.html', './css/style.css', './src/main.js'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
    // Force every open tab onto the fresh version. This is stronger than relying on the
    // page's own controllerchange handler: it also rescues tabs whose page predates that
    // handler, so a device stuck on an old service worker un-sticks itself on next visit.
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
      if ('navigate' in client) client.navigate(client.url);
    }
  })());
});

// Network-first with `no-store`: always fetch the live version bypassing the browser's
// HTTP cache, falling back to our cache only when offline. `no-store` is what stops stale
// JS modules from being served after an update (the cache-first / stale-HTTP-cache trap).
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request, { cache: 'no-store' })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
