// sw.js — Service Worker ANAS SafeHub v2.0
// Network-first per file app (deploy sempre fresco), cache-fallback offline
// Geom. Dogano Casella — ANAS SpA

const CACHE_NAME = 'anas-safehub-v2.2.8';

const CACHE_STATIC = [
  './',
  './index.html',
  './ANAS_CSE_html.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// ── INSTALL: precache file statici (resiliente — singoli file) ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-caching static assets...');
      return Promise.allSettled(
        CACHE_STATIC.map(url => cache.add(url).catch(err => {
          console.warn('[SW] Impossibile cachare:', url, err.message || '');
        }))
      );
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: rimuove TUTTE le cache vecchie e prende controllo ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Rimozione cache obsoleta:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: strategia ibrida ──
self.addEventListener('fetch', event => {
  const request = event.request;

  // ▸ IGNORA richieste non-GET (POST, PUT, etc.)
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // ▸ data/database.json → Network-first (aggiornamento USB)
  if (url.pathname.endsWith('database.json')) {
    event.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, clone));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request, { ignoreSearch: true });
          if (cached) return cached;
          return new Response('Network error on db', { status: 408 });
        })
    );
    return;
  }

  // ▸ CDN esterni (Tailwind, Google Fonts) → Network-first con fallback cache
  if (url.origin !== self.location.origin) {
    event.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, clone));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request, { ignoreSearch: true });
          if (cached) return cached;
          return new Response('Network error on external asset', { status: 408 });
        })
    );
    return;
  }

  // ▸ File statici dell'app → Network-first (deploy sempre fresco)
  event.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(request, { ignoreSearch: true });
        if (cached) return cached;
        return new Response('Offline and not cached', { status: 408 });
      })
  );
});

// ── MESSAGE: forza aggiornamento da UI ──
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
