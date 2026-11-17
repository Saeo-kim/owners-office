// OWNER'S OFFICE service worker.
//
// Goal: the installed app opens offline and always shows the newest code when
// the phone is online.
//  - Install: precache the app shell (the files needed to draw the first screen).
//  - Fetch, same-origin GET only: network first, cache as fallback. Every
//    successful response refreshes the cache, so new deploys reach the phone on
//    the next load without a version bump in the page.
//  - /api/ requests (local Node mode) are never cached or intercepted.
//  - Activate: delete caches from older builds.
// scripts/build-pages.js replaces __BUILD_ID__ with the build's identifier so
// each deploy gets its own cache name.

const BUILD_ID = '__BUILD_ID__';
const CACHE = `owners-office-${BUILD_ID}`;

// Paths relative to the service worker's scope (the site root).
const SHELL = [
  './',
  './index.html',
  './css/app.css',
  './js/main.js',
  './js/backend.js',
  './js/ui.js',
  './manifest.webmanifest',
  './favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  // Cache each shell file on its own. One file that cannot be fetched (for
  // example a passcode challenge answered with 401) must not stop the worker
  // from activating; the rest is still cached and runtime caching fills the gaps.
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.allSettled(
        SHELL.map(async (p) => {
          const url = new URL(p, self.registration.scope);
          const res = await fetch(url);
          if (res.ok) await cache.put(url, res);
        }),
      ),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith('owners-office-') && key !== CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/api/')) return;

  event.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok && res.type === 'basic') cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    if (req.mode === 'navigate') {
      const shell = await cache.match(new URL('./index.html', self.registration.scope));
      if (shell) return shell;
    }
    return new Response('오프라인 상태이며 이 파일은 아직 저장되어 있지 않습니다.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
