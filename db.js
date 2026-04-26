// db.js - Gestione IndexedDB per ANAS SafeHub
// v7: store foto, imprese_cantieri, impostazioni

const DB_NAME    = 'ANAS_SafeHub_DB';
const DB_VERSION = 10;          // v10: Forza allineamento cache v2.2.2 (MOD-25)

let db = null;

// ─────────────────────────────────────────────
// INIZIALIZZAZIONE DB
// ─────────────────────────────────────────────
function initDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. Cantieri
      if (!db.objectStoreNames.contains('projects')) {
        const s = db.createObjectStore('projects', { keyPath: 'id' });
        s.createIndex('nome', 'nome', { unique: false });
      }

      // 2. Verbali
      if (!db.objectStoreNames.contains('verbali')) {
        const s = db.createObjectStore('verbali', { keyPath: 'id' });
        s.createIndex('projectId', 'projectId', { unique: false });
      }

      // 3. Non Conformità
      if (!db.objectStoreNames.contains('nc')) {
        const s = db.createObjectStore('nc', { keyPath: 'id' });
        s.createIndex('projectId', 'projectId', { unique: false });
        s.createIndex('stato',     'stato',     { unique: false });
      }

      // 4. Imprese (anagrafica globale)
      if (!db.objectStoreNames.contains('imprese')) {
        db.createObjectStore('imprese', { keyPath: 'id' });
      }

      // 5. Lavoratori
      if (!db.objectStoreNames.contains('lavoratori')) {
        const s = db.createObjectStore('lavoratori', { keyPath: 'id' });
        s.createIndex('impresaId', 'impresaId', { unique: false });
      }

      // 6. Documenti (file blob + metadati)
      if (!db.objectStoreNames.contains('documenti')) {
        const s = db.createObjectStore('documenti', { keyPath: 'id' });
        s.createIndex('nome', 'nome', { unique: false });
        s.createIndex('tags', 'tags', { unique: false, multiEntry: true });
      }

      // 7. Collegamento Documenti ↔ Verbali / NC / Imprese / Lavoratori
      if (!db.objectStoreNames.contains('doc_links')) {
        const s = db.createObjectStore('doc_links', { keyPath: 'id' });
        s.createIndex('by_riferimento', ['tipo', 'riferimentoId'], { unique: false });
      }

      // 8. Foto NC  ← MANCAVA (causava il crash di foto.js con DB_VERSION+1)
      if (!db.objectStoreNames.contains('foto')) {
        const s = db.createObjectStore('foto', { keyPath: 'id' });
        s.createIndex('ncId', 'ncId', { unique: false });
      }

      // 9. Assegnazione Imprese ↔ Cantieri  ← MANCAVA (imprese-assegnazione.js)
      if (!db.objectStoreNames.contains('imprese_cantieri')) {
        const s = db.createObjectStore('imprese_cantieri', { keyPath: 'id' });
        s.createIndex('projectId',  'projectId',  { unique: false });
        s.createIndex('impresaId',  'impresaId',  { unique: false });
      }

      // 10. Impostazioni personalizzazione verbale
      if (!db.objectStoreNames.contains('impostazioni')) {
        db.createObjectStore('impostazioni', { keyPath: 'id' });
      }

      // 11. Coda di sincronizzazione (MOD-24)
      if (!db.objectStoreNames.contains('sync_queue')) {
        const s = db.createObjectStore('sync_queue', { keyPath: 'id' });
        s.createIndex('status', 'status', { unique: false });
      }
    };

    req.onsuccess = (event) => {
      db = event.target.result;
      resolve();
    };

    req.onerror = () => reject('Errore apertura IndexedDB: ' + req.error);
  });
}

// ─────────────────────────────────────────────
// CRUD GENERICI
// ─────────────────────────────────────────────

/** Salva (insert o update) un elemento in uno store */
function saveItem(storeName, item) {
  return new Promise((resolve, reject) => {
    if (!db) { reject('DB non inizializzato. Chiamare initDB() prima.'); return; }
    const t   = db.transaction(storeName, 'readwrite');
    const s   = t.objectStore(storeName);
    const req = s.put(item);
    req.onsuccess = () => resolve(item);
    req.onerror   = () => reject('Errore salvataggio in ' + storeName + ': ' + req.error);
  });
}

/** Recupera tutti gli elementi di uno store */
function getAll(storeName) {
  return new Promise((resolve, reject) => {
    if (!db) { reject('DB non inizializzato. Chiamare initDB() prima.'); return; }
    const t   = db.transaction(storeName, 'readonly');
    const s   = t.objectStore(storeName);
    const req = s.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = () => reject('Errore lettura da ' + storeName + ': ' + req.error);
  });
}

/** Recupera un singolo elemento per chiave primaria */
function getItem(storeName, id) {
  return new Promise((resolve, reject) => {
    if (!db) { reject('DB non inizializzato. Chiamare initDB() prima.'); return; }
    const t   = db.transaction(storeName, 'readonly');
    const s   = t.objectStore(storeName);
    const req = s.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror   = () => reject('Errore get da ' + storeName + ': ' + req.error);
  });
}

/** Recupera elementi tramite indice */
function getByIndex(storeName, indexName, value) {
  return new Promise((resolve, reject) => {
    if (!db) { reject('DB non inizializzato. Chiamare initDB() prima.'); return; }
    const t   = db.transaction(storeName, 'readonly');
    const s   = t.objectStore(storeName);
    const idx = s.index(indexName);
    const req = idx.getAll(value);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = () => reject('Errore lettura indice ' + indexName + ': ' + req.error);
  });
}

/** Elimina un elemento per chiave primaria */
function deleteItem(storeName, id) {
  return new Promise((resolve, reject) => {
    if (!db) { reject('DB non inizializzato. Chiamare initDB() prima.'); return; }
    const t   = db.transaction(storeName, 'readwrite');
    const s   = t.objectStore(storeName);
    const req = s.delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject('Errore cancellazione da ' + storeName + ': ' + req.error);
  });
}

/** Cancella tutti i record di uno store (per import completo) */
function clearStore(storeName) {
  return new Promise((resolve, reject) => {
    if (!db) { reject('DB non inizializzato. Chiamare initDB() prima.'); return; }
    const t   = db.transaction(storeName, 'readwrite');
    const s   = t.objectStore(storeName);
    const req = s.clear();
    req.onsuccess = () => resolve();
    req.onerror   = () => reject('Errore clear store ' + storeName + ': ' + req.error);
  });
}
