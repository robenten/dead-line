/* DEAD LINE service worker — Phase 0 web PWA. Dependency-free, root scope.
 *
 * SEMANTICS (matched to the game's conventions):
 *  - Navigations (HTML) are NETWORK-FIRST, cached under the full request URL
 *    including its query: the QR-code cache-busting convention (?v=BUILD)
 *    must always fetch fresh HTML from the network. Only when the network
 *    fails do we serve the cached game. We deliberately do NOT match
 *    ignoring the query string.
 *  - Other same-origin GETs (icons, manifest) are CACHE-FIRST — immutable-ish;
 *    bump the filename if one ever changes.
 *  - Old caches are swept on activate by cache-name version.
 */
const CACHE = 'dead-line-v2026.11.20.2'; // .20: tap-on-the-shoulder launcher icons — installed PWAs re-fetch

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll([
      './',
      './index.html',
      './manifest.webmanifest',
      './icon-192.png',
      './icon-512.png',
      './icon-maskable-192.png',
      './icon-maskable-512.png',
      './apple-touch-icon.png',
    ]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;      // cross-origin: not ours to touch
  if (e.request.method !== 'GET') return;

  if (e.request.mode === 'navigate' || e.request.destination === 'document') {
    // network-first — freshness wins; the cache is the offline safety net
    e.respondWith((async () => {
      try {
        const res = await fetch(e.request);
        const copy = res.clone();
        const c = await caches.open(CACHE);
        c.put(e.request, copy);                    // key includes ?v= — never conflated
        return res;
      } catch {
        const hit = await caches.match(e.request);
        if (hit) return hit;
        // a cache-busted URL we've never seen offline still gets the game
        const game = await caches.match('./index.html') || await caches.match('./');
        if (game) return game;
        return new Response('offline', { status: 503, statusText: 'offline' });
      }
    })());
    return;
  }

  // static assets — cache-first
  e.respondWith((async () => {
    const hit = await caches.match(e.request);
    if (hit) return hit;
    const res = await fetch(e.request);
    if (res.ok) {
      const copy = res.clone();
      const c = await caches.open(CACHE);
      c.put(e.request, copy);
    }
    return res;
  })());
});
