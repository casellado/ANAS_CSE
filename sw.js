// sw.js — Service Worker ANAS SafeHub v2.0
// Network-first per file app (deploy sempre fresco), cache-fallback offline
// Geom. Dogano Casella — ANAS SpA

const CACHE_NAME = 'anas-safehub-v2.0';

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
  './ricerca-normativa.js',
  './salva-file.js',
  './scorciatoie.js',
  './report-giornaliero.js',
  './lettera-sospensione.js',
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
  './ai-assistente.js',
  // CSS
  './animazioni.css',
  './mobile.css',
  // Icone PWA
  './icon-192.png',
  './icon-512.png',
  // Manifest
  './manifest.json'
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
  //   Le richieste POST (es. API Gemini) non possono essere cachate.
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
        .catch(() => caches.match(request))
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
        .catch(() => caches.match(request))
    );
    return;
  }

  // ▸ File statici dell'app → Network-first (deploy sempre fresco)
  //   Se la rete risponde, aggiorna la cache e serve fresco.
  //   Se offline, serve dalla cache.
  event.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
        }
        return res;
      })
      .catch(() => caches.match(request))
  );
});

// ── MESSAGE: forza aggiornamento da UI ──
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
