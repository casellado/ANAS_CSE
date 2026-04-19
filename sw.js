// sw.js — Service Worker ANAS SafeHub v1.2
// Cache-first per file statici, network-first per database.json

const CACHE_NAME = 'anas-safehub-v1.8';
const CACHE_STATIC = [
  './',
  './index.html',
  './ANAS_CSE_html.html',
  './dashboard-cantiere.html',
  './impresa-dettaglio.html',
  './lavoratore-dettaglio.html',
  './verbale-dettaglio.html',
  // JS core
  './db.js',
  './storage.js',
  './ui.js',
  './app.js',
  './navigation.js',
  './foto.js',
  './firma.js',
  './impostazioni.js',
  './salvataggio.js',
  './email.js',
  './verbali-riunione.js',
  './verbali-pos.js',
  './smart-memory.js',
  './mobile.css',
  './salva-file.js',
  './scorciatoie.js',
  './report-giornaliero.js',
  './lettera-sospensione.js',
  './animazioni.css',
  './ricerca-normativa.js',
  // JS moduli
  './nc.js',
  './nc-foto-dashboard.js',
  './verbali.js',
  './verbali-list.js',
  './imprese-list.js',
  './imprese-assegnazione.js',
  './lavoratori.js',
  './dashboard-cantiere.js',
  './dashboard-docs.js',
  './ui-dashboard.js',
  './documenti-indexeddb.js',
  './documenti.js',
  './documenti-preview.js',
  './documenti-collegamento.js',
  './documenti-popup.js',
  './documenti-imprese-lavoratori.js',
  './documenti-fondamentali.js',
  './scadenze-documenti.js',
  './export.js',
  './ods-inviati.js',
  './ods-ricevuti.js',
  // Icone PWA
  './icon-192.png',
  './icon-512.png',
  // Manifest
  './manifest.json'
];

// ── INSTALL: precache tutti i file statici ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-caching static assets...');
      // addAll è atomico: se un file manca il SW non si installa
      // Usiamo add() singolo per resilienza
      return Promise.allSettled(
        CACHE_STATIC.map(url => cache.add(url).catch(() => {
          console.warn('[SW] Impossibile cachare:', url);
        }))
      );
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: rimuove cache vecchie ──
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
  const url = new URL(event.request.url);

  // data/database.json → Network-first (aggiornamento USB)
  if (url.pathname.endsWith('database.json')) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // CDN esterni (Tailwind, Google Fonts) → Network-first con fallback cache
  if (url.origin !== self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // File statici dell'app → Cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return res;
      });
    })
  );
});

// ── MESSAGE: forza aggiornamento da UI ──
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
