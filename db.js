// db.js - Gestione IndexedDB per ANAS SafeHub v3

const DB_NAME = 'ANAS_CSE_DB';
const DB_VERSION = 10;

const STORES_CONFIG = {
  // Globali
  impostazioni: { keyPath: 'chiave' },
  
  // Cantiere-specifici (TUTTI con index su projectId)
  projects: { 
    keyPath: 'id',
    indexes: [
      { name: 'stato', keyPath: 'stato' }
    ]
  },
  imprese: { 
    keyPath: 'id',
    indexes: [
      { name: 'projectId', keyPath: 'projectId' },
      { name: 'ruolo', keyPath: 'ruolo' },
      { name: 'partitaIva', keyPath: 'partitaIva' }
    ]
  },
  persone_anas: { 
    keyPath: 'id',
    indexes: [
      { name: 'projectId', keyPath: 'projectId' },
      { name: 'ruolo', keyPath: 'ruolo' }
    ]
  },
  persone_terzi: { 
    keyPath: 'id',
    indexes: [
      { name: 'projectId', keyPath: 'projectId' }
    ]
  },
  lavoratori: { 
    keyPath: 'id',
    indexes: [
      { name: 'projectId', keyPath: 'projectId' },
      { name: 'impresaId', keyPath: 'impresaId' }
    ]
  },
  mezzi: { 
    keyPath: 'id',
    indexes: [
      { name: 'projectId', keyPath: 'projectId' },
      { name: 'impresaId', keyPath: 'impresaId' },
      { name: 'tipologia', keyPath: 'tipologia' }
    ]
  },
  verbali: { 
    keyPath: 'id',
    indexes: [
      { name: 'projectId', keyPath: 'projectId' },
      { name: 'tipo', keyPath: 'tipo' },
      { name: 'data', keyPath: 'data' }
    ]
  },
  verifiche_pos: { 
    keyPath: 'id',
    indexes: [
      { name: 'projectId', keyPath: 'projectId' },
      { name: 'impresaId', keyPath: 'impresaId' }
    ]
  },
  nc: { 
    keyPath: 'id',
    indexes: [
      { name: 'projectId', keyPath: 'projectId' },
      { name: 'impresaId', keyPath: 'impresaId' },
      { name: 'stato', keyPath: 'stato' },
      { name: 'livello', keyPath: 'livello' }
    ]
  },
  ods_inviati: { 
    keyPath: 'id',
    indexes: [
      { name: 'projectId', keyPath: 'projectId' },
      { name: 'impresaId', keyPath: 'impresaId' }
    ]
  },
  ods_ricevuti: { 
    keyPath: 'id',
    indexes: [
      { name: 'projectId', keyPath: 'projectId' },
      { name: 'mittente', keyPath: 'mittente' }
    ]
  },
  lettere_sospensione: { 
    keyPath: 'id',
    indexes: [
      { name: 'projectId', keyPath: 'projectId' }
    ]
  },
  diario_cse: { 
    keyPath: 'id',
    indexes: [
      { name: 'projectId', keyPath: 'projectId' },
      { name: 'data', keyPath: 'data' }
    ]
  },
  documenti: { 
    keyPath: 'id',
    indexes: [
      { name: 'projectId', keyPath: 'projectId' },
      { name: 'tipologia', keyPath: 'tipologia' },
      { name: 'entitaCollegataId', keyPath: 'entitaCollegataId' }
    ]
  }
};

let db = null;

// ─────────────────────────────────────────────
// INIZIALIZZAZIONE DB
// ─────────────────────────────────────────────
function initDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const database = event.target.result;
      
      // Creazione automatica degli store basata su STORES_CONFIG
      for (const [storeName, config] of Object.entries(STORES_CONFIG)) {
        if (!database.objectStoreNames.contains(storeName)) {
          const store = database.createObjectStore(storeName, { keyPath: config.keyPath });
          if (config.indexes) {
            config.indexes.forEach(idx => {
              store.createIndex(idx.name, idx.keyPath, { unique: false });
            });
          }
        }
      }
    };

    req.onsuccess = (event) => {
      db = event.target.result;
      resolve();
    };

    req.onerror = () => {
      console.error(req.error);
      reject('Errore di archiviazione locale. Riprovare.');
    };
  });
}

// ─────────────────────────────────────────────
// CRUD GENERICI
// ─────────────────────────────────────────────

/** Salva (insert o update) un elemento in uno store */
function saveItem(storeName, item) {
  return new Promise((resolve, reject) => {
    if (!db) { reject('DB non inizializzato. Chiamare initDB() prima.'); return; }
    const t = db.transaction(storeName, 'readwrite');
    const s = t.objectStore(storeName);
    try {
      const req = s.put(item);
      req.onsuccess = () => resolve(item);
      req.onerror = () => {
        console.error(req.error);
        if (req.error && req.error.name === 'QuotaExceededError') {
          reject('Spazio di archiviazione esaurito. Elimina alcuni file o libera spazio sul dispositivo.');
        } else {
          reject('Errore di archiviazione locale. Riprovare.');
        }
      };
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        reject('Spazio di archiviazione esaurito. Elimina alcuni file o libera spazio sul dispositivo.');
      } else {
        reject('Errore di archiviazione locale. Riprovare.');
      }
    }
  });
}

/** Recupera tutti gli elementi di uno store */
function getAll(storeName) {
  return new Promise((resolve, reject) => {
    if (!db) { reject('DB non inizializzato. Chiamare initDB() prima.'); return; }
    const t = db.transaction(storeName, 'readonly');
    const s = t.objectStore(storeName);
    const req = s.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => { console.error(req.error); reject('Errore di archiviazione locale. Riprovare.'); };
  });
}

/** Recupera un singolo elemento per chiave primaria */
function getItem(storeName, id) {
  return new Promise((resolve, reject) => {
    if (!db) { reject('DB non inizializzato. Chiamare initDB() prima.'); return; }
    const t = db.transaction(storeName, 'readonly');
    const s = t.objectStore(storeName);
    const req = s.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => { console.error(req.error); reject('Errore di archiviazione locale. Riprovare.'); };
  });
}

/** Recupera elementi tramite indice */
function getByIndex(storeName, indexName, value) {
  return new Promise((resolve, reject) => {
    if (!db) { reject('DB non inizializzato. Chiamare initDB() prima.'); return; }
    const t = db.transaction(storeName, 'readonly');
    const s = t.objectStore(storeName);
    const idx = s.index(indexName);
    const req = idx.getAll(value);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => { console.error(req.error); reject('Errore di archiviazione locale. Riprovare.'); };
  });
}

// Alias per compatibilità con il documento di refactoring
function getAllByIndex(storeName, indexName, value) {
  return getByIndex(storeName, indexName, value);
}

/** Elimina un elemento per chiave primaria */
function deleteItem(storeName, id) {
  return new Promise((resolve, reject) => {
    if (!db) { reject('DB non inizializzato. Chiamare initDB() prima.'); return; }
    const t = db.transaction(storeName, 'readwrite');
    const s = t.objectStore(storeName);
    const req = s.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => { console.error(req.error); reject('Errore di archiviazione locale. Riprovare.'); };
  });
}

/** Cancella tutti i record di uno store (per import completo) */
function clearStore(storeName) {
  return new Promise((resolve, reject) => {
    if (!db) { reject('DB non inizializzato. Chiamare initDB() prima.'); return; }
    const t = db.transaction(storeName, 'readwrite');
    const s = t.objectStore(storeName);
    const req = s.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => { console.error(req.error); reject('Errore di archiviazione locale. Riprovare.'); };
  });
}

/** 
 * Elimina intero cantiere e fa cascade su tutti gli store collegati 
 */
async function eliminaCantiere(projectId) {
  const STORES_CANTIERE = [
    'imprese', 'persone_anas', 'persone_terzi', 'lavoratori',
    'mezzi', 'verbali', 'verifiche_pos', 'nc', 'ods_inviati',
    'ods_ricevuti', 'lettere_sospensione', 'diario_cse', 'documenti'
  ];
  
  for (const storeName of STORES_CANTIERE) {
    const items = await getByIndex(storeName, 'projectId', projectId);
    for (const item of items) {
      await deleteItem(storeName, item.id);
    }
  }
  
  await deleteItem('projects', projectId);
  
  // Aggiorna anche OneDrive se attivo
  if (typeof isArchivioOneDriveAttivo === 'function' && await isArchivioOneDriveAttivo()) {
    if (typeof _eliminaCartellaLotto === 'function') await _eliminaCartellaLotto(projectId);
    if (typeof _eliminaJsonLotto === 'function') await _eliminaJsonLotto(projectId);
    if (typeof _aggiornaRegistroLotti === 'function') await _aggiornaRegistroLotti(projectId, 'remove');
  }
}
