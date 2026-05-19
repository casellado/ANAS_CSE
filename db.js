// db.js - Gestione IndexedDB for SafeHub v3 (v13)
// Architettura Scoped to ProjectId

const DB_NAME = 'ANAS_CSE_DB';
const DB_VERSION = 18;

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
      { name: 'dataSopralluogo', keyPath: 'dataSopralluogo' },
      { name: 'stato', keyPath: 'stato' }
    ]
  },
  eventi_incidentali: {
    keyPath: 'id',
    autoIncrement: true,
    indexes: [
      { name: 'projectId',          keyPath: 'projectId' },
      { name: 'tipologia',          keyPath: 'tipologia' },
      { name: 'stato',              keyPath: 'stato' },
      { name: 'dataOraEvento',      keyPath: 'dataOraEvento' },
      { name: 'gravita',            keyPath: 'gravita' },
      { name: 'codiceEvento',       keyPath: 'codiceEvento' },
      { name: 'verbaleOrigineId',   keyPath: 'verbaleOrigineId' },
      { name: 'nearMissOriginaleId',keyPath: 'nearMissOriginaleId' }
    ]
  },
  aggiornamenti_psc: {
    keyPath: 'id',
    indexes: [
      { name: 'projectId', keyPath: 'projectId' },
      { name: 'tipoAggiornamento', keyPath: 'tipoAggiornamento' },
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
      { name: 'livello', keyPath: 'livello' },
      { name: 'verbaleOrigineId', keyPath: 'verbaleOrigineId' }
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
  },
  verbali_riunione: {
    keyPath: 'id',
    autoIncrement: true,
    indexes: [
      { name: 'projectId', keyPath: 'projectId' },
      { name: 'dataRiunione', keyPath: 'dataRiunione' },
      { name: 'stato', keyPath: 'stato' },
      { name: 'numeroProgressivo', keyPath: 'numeroProgressivo' }
    ]
  },
  verifica_pos: {
    keyPath: 'id',
    autoIncrement: true,
    indexes: [
      { name: 'projectId', keyPath: 'projectId' },
      { name: 'dataDocumento', keyPath: 'dataDocumento' },
      { name: 'stato', keyPath: 'stato' },
      { name: 'numeroProgressivo', keyPath: 'numeroProgressivo' },
      { name: 'impresaId', keyPath: 'impresaId' }
    ]
  }
};

let db = null;

/**
 * Inizializzazione DB con schema v10
 */
function initDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const database = event.target.result;
      const tx = event.target.transaction;

      // Creazione automatica degli store basata su STORES_CONFIG
      for (const [storeName, config] of Object.entries(STORES_CONFIG)) {
        if (!database.objectStoreNames.contains(storeName)) {
          const storeOpts = { keyPath: config.keyPath };
          if (config.autoIncrement) storeOpts.autoIncrement = true;
          const store = database.createObjectStore(storeName, storeOpts);
          if (config.indexes) {
            config.indexes.forEach(idx => {
              store.createIndex(idx.name, idx.keyPath, { unique: false });
            });
          }
        }
      }

      // Migrazione v14: estensione anagrafica cantiere (projects)
      if (event.oldVersion < 14 && database.objectStoreNames.contains('projects')) {
        const projectsStore = tx.objectStore('projects');
        const NUOVI_CAMPI_DEFAULT = {
          ssNumero: null, progressivaInizio: null, progressivaFine: null, strutturaTerritoriale: null,
          codicePpmSil: null, commessaNumero: null, voceBudget: null, cup: null, cig: null,
          contrattoNumero: null, contrattoData: null, importoContratto: null,
          dataConsegnaLavori: null, durataContrattuale: null, giorniSospensione: 0,
          rupId: null, dlId: null, cseTitolareId: null, cseDelegatoId: null,
          ispettoreCantiereId: null, responsabileLavoriId: null,
          cspNome: null, cspQualifica: null, cspRecapito: null,
          committente: null,
          dataInizioEffettiva: null, dataFineEffettiva: null,
          impresaAffidatariaId: null, direttoreTecnicoNome: null, direttoreCantiereNome: null
        };
        projectsStore.openCursor().onsuccess = function(e) {
          const cursor = e.target.result;
          if (!cursor) return;
          const record = cursor.value;
          let aggiornato = false;
          for (const [campo, def] of Object.entries(NUOVI_CAMPI_DEFAULT)) {
            if (!(campo in record)) { record[campo] = def; aggiornato = true; }
          }
          if (aggiornato) cursor.update(record);
          cursor.continue();
        };
      }

      // Migrazione v16: estensione store nc (workflow stato + audit log)
      if (event.oldVersion < 16 && database.objectStoreNames.contains('nc')) {
        const ncStore = tx.objectStore('nc');
        ncStore.openCursor().onsuccess = function(e) {
          const cursor = e.target.result;
          if (!cursor) return;
          const record = cursor.value;
          let aggiornato = false;
          // Normalizza stato legacy lowercase → uppercase
          if (!record.stato || record.stato === 'aperta') { record.stato = 'APERTA'; aggiornato = true; }
          else if (record.stato === 'in_risoluzione') { record.stato = 'IN_RISOLUZIONE'; aggiornato = true; }
          else if (record.stato === 'chiusa') { record.stato = 'CHIUSA'; aggiornato = true; }
          if (!('dataPresaInCarico' in record)) { record.dataPresaInCarico = null; aggiornato = true; }
          if (!('dataChiusura' in record)) { record.dataChiusura = null; aggiornato = true; }
          if (!('notaChiusura' in record)) { record.notaChiusura = null; aggiornato = true; }
          if (!('auditLog' in record)) { record.auditLog = []; aggiornato = true; }
          if (aggiornato) cursor.update(record);
          cursor.continue();
        };
      }

      // Migrazione v17: ricrea eventi_incidentali con schema completo (autoIncrement + indici corretti)
      if (event.oldVersion < 17) {
        if (database.objectStoreNames.contains('eventi_incidentali')) {
          database.deleteObjectStore('eventi_incidentali');
        }
        const evStore = database.createObjectStore('eventi_incidentali', { keyPath: 'id', autoIncrement: true });
        ['projectId','tipologia','stato','dataOraEvento','gravita','codiceEvento','verbaleOrigineId','nearMissOriginaleId'].forEach(idx => {
          evStore.createIndex(idx, idx, { unique: false });
        });
      }
      // Migrazione v18: ricrea verbali_riunione con autoIncrement: true
      // Lo store fu creato in una versione precedente senza autoIncrement, quindi
      // s.put(record senza id) sollevava DataError invece di auto-generare la chiave.
      if (event.oldVersion < 18 && database.objectStoreNames.contains('verbali_riunione')) {
        const vrStore = tx.objectStore('verbali_riunione');
        if (!vrStore.autoIncrement) {
          const buffer = [];
          vrStore.openCursor().onsuccess = function(ce) {
            const cur = ce.target.result;
            if (cur) { buffer.push(cur.value); cur.continue(); return; }
            // Fine cursore: ricrea store con autoIncrement
            database.deleteObjectStore('verbali_riunione');
            const ns = database.createObjectStore('verbali_riunione', { keyPath: 'id', autoIncrement: true });
            ['projectId', 'dataRiunione', 'stato', 'numeroProgressivo'].forEach(n =>
              ns.createIndex(n, n, { unique: false })
            );
            buffer.forEach(r => ns.put(r));
          };
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
// CRUD HELPERS (Globali)
// ─────────────────────────────────────────────

function saveItem(storeName, item) {
  return new Promise((resolve, reject) => {
    if (!db) { reject('DB non inizializzato.'); return; }
    const t = db.transaction(storeName, 'readwrite');
    const s = t.objectStore(storeName);
    item.modifiedAt = new Date().toISOString();
    const req = s.put(item);
    req.onsuccess = () => resolve(item);
    req.onerror = () => reject(req.error);
  });
}

function getItem(storeName, id) {
  return new Promise((resolve, reject) => {
    if (!db) { reject('DB non inizializzato.'); return; }
    const t = db.transaction(storeName, 'readonly');
    const req = t.objectStore(storeName).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

function getByIndex(storeName, indexName, value) {
  return new Promise((resolve, reject) => {
    if (!db) { reject('DB non inizializzato.'); return; }
    const t = db.transaction(storeName, 'readonly');
    const idx = t.objectStore(storeName).index(indexName);
    const req = idx.getAll(value);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function getAllByIndex(storeName, indexName, value) {
  return getByIndex(storeName, indexName, value);
}

function deleteItem(storeName, id) {
  return new Promise((resolve, reject) => {
    if (!db) { reject('DB non inizializzato.'); return; }
    const t = db.transaction(storeName, 'readwrite');
    const req = t.objectStore(storeName).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** 
 * Elimina intero cantiere e fa cascade su tutti gli store collegati 
 */
async function eliminaCantiere(projectId) {
  const STORES_CANTIERE = [
    'imprese', 'persone_anas', 'persone_terzi', 'lavoratori',
    'mezzi', 'verbali', 'verbali_riunione', 'eventi_incidentali', 'aggiornamenti_psc',
    'verifiche_pos', 'verifica_pos', 'nc', 'ods_inviati',
    'ods_ricevuti', 'lettere_sospensione', 'diario_cse', 'documenti'
  ];
  
  for (const storeName of STORES_CANTIERE) {
    // Salta store non ancora presenti (upgrade DB in corso o versione precedente)
    if (!db.objectStoreNames.contains(storeName)) continue;
    try {
      const items = await getAllByIndex(storeName, 'projectId', projectId);
      for (const item of items) {
        await deleteItem(storeName, item.id);
      }
    } catch (e) {
      console.warn(`eliminaCantiere: store "${storeName}" non accessibile, saltato.`, e);
    }
  }
  
  await deleteItem('projects', projectId);
  
  // Bridge con OneDrive (se presenti funzioni globali)
  if (typeof isArchivioOneDriveAttivo === 'function' && await isArchivioOneDriveAttivo()) {
    if (typeof _eliminaCartellaLotto === 'function') await _eliminaCartellaLotto(projectId);
    if (typeof _eliminaJsonLotto === 'function') await _eliminaJsonLotto(projectId);
    if (typeof _aggiornaRegistroLotti === 'function') await _aggiornaRegistroLotti(projectId, 'remove');
  }
}

// Esposizione globale per script legacy
window.initDB = initDB;
window.saveItem = saveItem;
window.getItem = getItem;
window.getByIndex = getByIndex;
window.getAllByIndex = getAllByIndex;
window.deleteItem = deleteItem;
window.eliminaCantiere = eliminaCantiere;
