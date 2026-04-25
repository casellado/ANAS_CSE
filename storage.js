// storage.js — Router dati ANAS SafeHub v2.0
// MOD-1: wrapper trasparente IndexedDB ↔ OneDrive
// Geom. Dogano Casella · CSE ANAS SpA Calabria
//
// Strategia:
//   - Cattura le CRUD originali di db.js come funzioni private _*Local
//   - Ridefinisce saveItem / getItem / getAll / deleteItem come router
//   - I moduli feature (nc.js, verbali.js, ecc.) non cambiano una riga
//   - Se OneDrive non è configurato: comportamento identico a v1.8

// Store da includere nel backup (NO blob binari)
const STORES_EXPORT = ['projects', 'verbali', 'nc', 'imprese',
                       'lavoratori', 'imprese_cantieri', 'doc_links', 'impostazioni'];

// ─────────────────────────────────────────────────────────────────────────────
// CLASSIFICAZIONE STORE
// ─────────────────────────────────────────────────────────────────────────────

/** Store SEMPRE in IndexedDB (dati per-tecnico, non condivisi) */
const STORES_SOLO_LOCALE = new Set(['impostazioni', 'foto', 'doc_links']);

/** Store gestiti da OneDrive (dati condivisi) quando OneDrive è attivo */
const STORES_ONEDRIVE = new Set([
  'projects', 'verbali', 'nc', 'imprese_cantieri', 'imprese', 'lavoratori', 'documenti'
]);

// ─────────────────────────────────────────────────────────────────────────────
// RIFERIMENTI ALLE CRUD ORIGINALI DI db.js
// (catturate dopo il caricamento di db.js — storage.js viene dopo nel defer order)
// ─────────────────────────────────────────────────────────────────────────────
// HELPER: WRAPPERS LOCALI
// Usano window.__orig* che vengono catturati sincronamente alla fine del file
// (dopo db.js in defer order). Non dipendono da _installRouter().
// ─────────────────────────────────────────────────────────────────────────────

function _saveItemLocal(storeName, item) {
  const fn = window.__origSaveItem;
  if (!fn) throw new Error('[SafeHub] db.js non pronto (saveItem). Ricarica la pagina.');
  return fn(storeName, item);
}
function _getItemLocal(storeName, id) {
  const fn = window.__origGetItem;
  if (!fn) throw new Error('[SafeHub] db.js non pronto (getItem). Ricarica la pagina.');
  return fn(storeName, id);
}
function _getAllLocal(storeName) {
  const fn = window.__origGetAll;
  if (!fn) throw new Error('[SafeHub] db.js non pronto (getAll). Ricarica la pagina.');
  return fn(storeName);
}
function _deleteItemLocal(storeName, id) {
  const fn = window.__origDeleteItem;
  if (!fn) throw new Error('[SafeHub] db.js non pronto (deleteItem). Ricarica la pagina.');
  return fn(storeName, id);
}

/**
 * Salva multipli item in IndexedDB come cache (con _source: 'onedrive').
 * Non propaga errori — la cache è best-effort.
 */
async function _bulkSaveLocalCache(storeName, items) {
  for (const item of items) {
    try {
      await _saveItemLocal(storeName, { ...item, _source: 'onedrive' });
    } catch (_) { /* skip singolo item corrotto */ }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: NOME TECNICO (per modifiedBy)
// ─────────────────────────────────────────────────────────────────────────────

async function _getNomeTecnicoRouter() {
  try {
    if (typeof caricaImpostazioni === 'function') {
      const imp = await caricaImpostazioni();
      return imp?.firmaNome     // primario
          || imp?.nomeTecnico   // futuro
          || imp?.nome          // generico
          || imp?.studioNome    // fallback studio
          || 'Sconosciuto';
    }
  } catch (_) {}
  return 'Sconosciuto';
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: TOAST OFFLINE
// ─────────────────────────────────────────────────────────────────────────────

let _offlineToastDebounce = null;

function _toastOffline() {
  clearTimeout(_offlineToastDebounce);
  _offlineToastDebounce = setTimeout(() => {
    if (typeof showToast === 'function') {
      showToast('☁️ OneDrive non raggiungibile — modalità offline (cache locale)', 'warning');
    }
  }, 300);
}

// ─────────────────────────────────────────────────────────────────────────────
// MOD-1: ROUTER — saveItem
// Dichiarato come const per NON essere hoisted come property di window.
// Viene assegnato a window.saveItem solo dalla sezione INIT in fondo al file.
// ─────────────────────────────────────────────────────────────────────────────

const _routerSaveItem = async function(storeName, item) {
  // Store sempre locali: bypass diretto
  if (STORES_SOLO_LOCALE.has(storeName)) {
    return _saveItemLocal(storeName, item);
  }

  // Verifica OneDrive
  const usaOneDrive = (typeof isArchivioOneDriveAttivo === 'function')
    ? await isArchivioOneDriveAttivo()
    : false;

  if (!usaOneDrive || !STORES_ONEDRIVE.has(storeName)) {
    return _saveItemLocal(storeName, item);
  }

  // ── ROUTING SU ONEDRIVE ─────────────────────────────────────────────────
  try {
    const nomeTecnico = await _getNomeTecnicoRouter();
    const itemArricchito = {
      ...item,
      modifiedAt: new Date().toISOString(),
      modifiedBy: nomeTecnico
    };

    switch (storeName) {
      case 'projects':
        await _saveProjectOnDrive(itemArricchito);
        break;
      case 'verbali':
      case 'nc':
      case 'imprese_cantieri':
      case 'documenti':
        await _saveInLotto(storeName, itemArricchito);
        break;
      case 'imprese':
      case 'lavoratori':
        await _saveImpresaOrLavoratore(storeName, itemArricchito);
        break;
      default:
        return _saveItemLocal(storeName, item);
    }

    // Mirror in cache locale
    await _saveItemLocal(storeName, { ...itemArricchito, _source: 'onedrive' });
    return itemArricchito;

  } catch (err) {
    console.warn(`[Storage Router] Fallback locale per saveItem(${storeName}):`, err.message);
    _toastOffline();
    return _saveItemLocal(storeName, item);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MOD-1: ROUTER — getItem
// ─────────────────────────────────────────────────────────────────────────────

const _routerGetItem = async function(storeName, id) {
  if (STORES_SOLO_LOCALE.has(storeName)) {
    return _getItemLocal(storeName, id);
  }

  const usaOneDrive = (typeof isArchivioOneDriveAttivo === 'function')
    ? await isArchivioOneDriveAttivo()
    : false;

  if (!usaOneDrive || !STORES_ONEDRIVE.has(storeName)) {
    return _getItemLocal(storeName, id);
  }

  // Per getItem singolo, leggi dal lotto se ha projectId o cercalo nei dati generali
  // Strategia: prova prima la cache locale, poi OneDrive se cache vuota
  try {
    const cached = await _getItemLocal(storeName, id);
    if (cached && cached._source === 'onedrive') return cached;

    // Fallback a getAll filtrato (OneDrive non ha getById nativo)
    const tutti = await _routerGetAll(storeName);
    return tutti.find(x => x.id === id) || null;
  } catch (err) {
    console.warn(`[Storage Router] Fallback locale per getItem(${storeName}, ${id}):`, err.message);
    _toastOffline();
    return _getItemLocal(storeName, id);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MOD-1: ROUTER — getAll
// ─────────────────────────────────────────────────────────────────────────────

const _routerGetAll = async function(storeName) {
  if (STORES_SOLO_LOCALE.has(storeName)) {
    return _getAllLocal(storeName);
  }

  const usaOneDrive = (typeof isArchivioOneDriveAttivo === 'function')
    ? await isArchivioOneDriveAttivo()
    : false;

  if (!usaOneDrive || !STORES_ONEDRIVE.has(storeName)) {
    return _getAllLocal(storeName);
  }

  // ── LETTURA DA ONEDRIVE CON CACHE ────────────────────────────────────────
  try {
    return await _getAllFromOneDriveConCache(storeName);
  } catch (err) {
    console.warn(`[Storage Router] Fallback cache per getAll(${storeName}):`, err.message);
    _toastOffline();
    return _getAllLocal(storeName);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MOD-1: ROUTER — deleteItem
// ─────────────────────────────────────────────────────────────────────────────

const _routerDeleteItem = async function(storeName, id) {
  if (STORES_SOLO_LOCALE.has(storeName)) {
    return _deleteItemLocal(storeName, id);
  }

  const usaOneDrive = (typeof isArchivioOneDriveAttivo === 'function')
    ? await isArchivioOneDriveAttivo()
    : false;

  if (!usaOneDrive || !STORES_ONEDRIVE.has(storeName)) {
    return _deleteItemLocal(storeName, id);
  }

  // ── CANCELLAZIONE SU ONEDRIVE ─────────────────────────────────────────────
  try {
    await _deleteFromOneDrive(storeName, id);
    await _deleteItemLocal(storeName, id); // sincronizza cache
    return;
  } catch (err) {
    console.warn(`[Storage Router] Fallback locale per deleteItem(${storeName}, ${id}):`, err.message);
    _toastOffline();
    return _deleteItemLocal(storeName, id);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPLEMENTAZIONI ONEDRIVE
// ─────────────────────────────────────────────────────────────────────────────

/** Salva un cantiere nel registro.json */
async function _saveProjectOnDrive(project) {
  if (typeof aggiornaRegistroLotti !== 'function') throw new Error('storage-onedrive.js non caricato');

  await aggiornaRegistroLotti({
    id:        project.id,
    nome:      project.nome,
    loc:       project.loc || '',
    status:    project.status || 'ok',
    createdAt: project.createdAt || new Date().toISOString(),
    updatedAt: project.modifiedAt,
    updatedBy: project.modifiedBy
  });

  // Crea struttura cartelle per il lotto (MOD-9)
  if (typeof creaStrutturaLotto === 'function') {
    creaStrutturaLotto(project.id).catch(() => {}); // non bloccante
  }

  // Inizializza il JSON del lotto se non esiste
  try {
    const datiEsistenti = await leggiLotto(project.id);
    if (!datiEsistenti.lottoId) throw new Error('vuoto');
  } catch (_) {
    await salvaLotto(project.id, {
      ...project,
      nc: [], verbali: [], imprese_cantieri: [], foto_meta: [], documenti: []
    }, { forzato: true });
  }

  if (typeof aggiungiAudit === 'function') {
    await aggiungiAudit({ azione: 'projects.save', lotto: project.id, dettaglio: project.nome });
  }
}

/** Salva NC / verbale / imprese_cantieri / documenti dentro il file JSON del lotto */
async function _saveInLotto(storeName, item) {
  if (!item.projectId) {
    throw new Error(`saveItem(${storeName}) richiede projectId per OneDrive`);
  }

  const lottoId = item.projectId;
  const dati    = await leggiLotto(lottoId);

  // Tieni traccia dell'updatedAt letto (lock soft)
  const updatedAtOriginale = dati.updatedAt;

  if (!Array.isArray(dati[storeName])) dati[storeName] = [];

  // Upsert per id
  const idx = dati[storeName].findIndex(x => x.id === item.id);
  if (idx >= 0) dati[storeName][idx] = item;
  else          dati[storeName].push(item);

  const result = await salvaLotto(lottoId, {
    ...dati,
    _updatedAtOriginale: updatedAtOriginale
  });

  if (!result.success && result.conflitto) {
    // Mostra modal conflitto e lascia decidere l'utente
    return new Promise((resolve, reject) => {
      if (typeof mostraModalConflittoSync === 'function') {
        mostraModalConflittoSync(
          lottoId,
          dati,
          result.remoto,
          async () => {
            // Sovrascrivi
            await salvaLotto(lottoId, { ...dati, _updatedAtOriginale: undefined }, { forzato: true });
            resolve(item);
          },
          () => reject(new Error('Salvataggio annullato dall\'utente (conflitto OneDrive)'))
        );
      } else {
        reject(new Error('Conflitto di salvataggio non risolto'));
      }
    });
  }

  if (typeof aggiungiAudit === 'function') {
    await aggiungiAudit({
      azione:    `${storeName}.save`,
      lotto:     lottoId,
      itemId:    item.id,
      dettaglio: item.titolo || item.nome || item.oggetto || item.id
    });
  }

  return item;
}

/** Salva impresa o lavoratore nel file imprese.json globale */
async function _saveImpresaOrLavoratore(storeName, item) {
  if (typeof leggiImprese !== 'function') throw new Error('storage-onedrive.js non caricato');

  // Leggi l'elenco attuale (il file imprese.json tiene sia imprese che lavoratori)
  const currentRaw = await leggiImprese(); // { imprese: [], lavoratori: [] } o array flat
  // Normalizza: può essere array flat (legacy) o oggetto strutturato
  let   imprese    = [];
  let   lavoratori = [];

  if (Array.isArray(currentRaw)) {
    // Legacy flat: tutti i record nella stessa lista
    imprese    = currentRaw.filter(x => !x.impresaId);
    lavoratori = currentRaw.filter(x =>  x.impresaId);
  } else {
    imprese    = Array.isArray(currentRaw.imprese)    ? currentRaw.imprese    : [];
    lavoratori = Array.isArray(currentRaw.lavoratori) ? currentRaw.lavoratori : [];
  }

  if (storeName === 'imprese') {
    const idx = imprese.findIndex(x => x.id === item.id);
    if (idx >= 0) imprese[idx] = item; else imprese.push(item);
  } else {
    const idx = lavoratori.findIndex(x => x.id === item.id);
    if (idx >= 0) lavoratori[idx] = item; else lavoratori.push(item);
  }

  await salvaImprese({ imprese, lavoratori });

  if (typeof aggiungiAudit === 'function') {
    await aggiungiAudit({
      azione:    `${storeName}.save`,
      itemId:    item.id,
      dettaglio: item.nome || item.cognome || item.id
    });
  }
}

/** Lettura getAll da OneDrive con aggiornamento cache */
async function _getAllFromOneDriveConCache(storeName) {
  if (storeName === 'projects') {
    // Leggi registro.json
    const registro = await leggiRegistroLotti();
    const lotti    = Array.isArray(registro.lotti) ? registro.lotti : [];
    await _bulkSaveLocalCache('projects', lotti);
    return lotti;
  }

  if (storeName === 'imprese' || storeName === 'lavoratori') {
    const raw = await leggiImprese();
    const lista = Array.isArray(raw)
      ? (storeName === 'imprese' ? raw.filter(x => !x.impresaId) : raw.filter(x => x.impresaId))
      : (Array.isArray(raw[storeName]) ? raw[storeName] : []);
    await _bulkSaveLocalCache(storeName, lista);
    return lista;
  }

  // Per verbali, nc, imprese_cantieri, documenti:
  // legge il lotto corrente (currentProjectId da sessionStorage/appState)
  const projectId = window.appState?.currentProject
    || sessionStorage.getItem('currentProjectId');

  if (!projectId) {
    // Nessun progetto attivo → legge la cache locale
    return _getAllLocal(storeName);
  }

  const datiLotto = await leggiLotto(projectId);
  const items     = Array.isArray(datiLotto[storeName]) ? datiLotto[storeName] : [];
  await _bulkSaveLocalCache(storeName, items);
  return items;
}

/** Cancellazione su OneDrive */
async function _deleteFromOneDrive(storeName, id) {
  if (storeName === 'projects') {
    // Rimuovi dal registro — non cancella il file JSON del lotto (sicurezza dati)
    const registro = await leggiRegistroLotti();
    registro.lotti = registro.lotti.filter(l => l.id !== id);
    // Salva direttamente il registro modificato
    const dir = await (typeof _getOrCreateSafehubDir === 'function' ? _getOrCreateSafehubDir() : null);
    if (dir) {
      const { _scriviJSON: sj } = { _scriviJSON: undefined }; // non esposto pubblicamente
      // Usiamo aggiornaRegistroLotti con un item fantasma per rimuoverlo
      // Strategia alternativa: sovrascrittura diretta tramite salvaLotto
      const impRepo = (typeof caricaImpostazioni === 'function') ? await caricaImpostazioni() : {};
      const root    = impRepo?.onedrive_folder_handle;
      if (root) {
        const safehubDir = await root.getDirectoryHandle('_safehub', { create: false }).catch(() => null);
        if (safehubDir) {
          const testo = JSON.stringify({ ...registro, aggiornatoAt: new Date().toISOString() }, null, 2);
          const fh    = await safehubDir.getFileHandle('registro.json', { create: true });
          const wr    = await fh.createWritable();
          await wr.write(testo);
          await wr.close();
        }
      }
    }

    if (typeof aggiungiAudit === 'function') {
      await aggiungiAudit({ azione: 'projects.delete', itemId: id });
    }
    return;
  }

  // Per verbali / nc / imprese_cantieri / documenti
  const projectId = window.appState?.currentProject
    || sessionStorage.getItem('currentProjectId');

  if (!projectId) throw new Error('deleteItem OneDrive: projectId non disponibile');

  const dati = await leggiLotto(projectId);
  const updatedAtOriginale = dati.updatedAt;

  if (Array.isArray(dati[storeName])) {
    dati[storeName] = dati[storeName].filter(x => x.id !== id);
  }

  await salvaLotto(projectId, { ...dati, _updatedAtOriginale: updatedAtOriginale });

  if (typeof aggiungiAudit === 'function') {
    await aggiungiAudit({
      azione:    `${storeName}.delete`,
      lotto:     projectId,
      itemId:    id
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT ROUTER — Installazione sincrona al termine del file
// ─────────────────────────────────────────────────────────────────────────────
//
// PERCHÉ SINCRONO (non DOMContentLoaded):
// Gli script con `defer` vengono eseguiti nell'ordine di dichiarazione,
// DOPO che il DOM è stato parsato. db.js è dichiarato PRIMA di storage.js
// nell'HTML, quindi al momento in cui storage.js esegue questa sezione,
// window.saveItem è già db.js's saveItem.
//
// PERCHÉ `const saveItem` e non `function saveItem`:
// Le `function` declaration vengono hoisted come proprietà di window,
// sovrascrivendo immediatamente db.js. Le `const` invece NON creano
// proprietà di window automaticamente, quindi window.saveItem rimane
// quella di db.js fino a questo momento.

;(function _installRouterSync() {
  if (typeof window === 'undefined') return;

  // Cattura riferimenti originali di db.js (ancora intatti)
  window.__origSaveItem   = window.saveItem;
  window.__origGetItem    = window.getItem;
  window.__origGetAll     = window.getAll;
  window.__origDeleteItem = window.deleteItem;

  // Installa il router
  window.saveItem   = _routerSaveItem;
  window.getItem    = _routerGetItem;
  window.getAll     = _routerGetAll;
  window.deleteItem = _routerDeleteItem;
  // getByIndex rimane invariato — sempre IndexedDB (usato per join locali)

  // Espone le funzioni helper pubbliche di storage.js su window
  // Le `const` non sono automaticamente globali (a differenza delle `function` declaration)
  // Le `function` declaration sotto sono hoisted ma le dichiariamo comunque per chiarezza
  window.tryLoadDatabaseJsonFromDataFolder = tryLoadDatabaseJsonFromDataFolder;
  window.exportDatabaseToFile              = exportDatabaseToFile;
  window.importDatabaseFromFile            = importDatabaseFromFile;

  console.info('[SafeHub v2.0] Storage router installato (OneDrive ↔ IndexedDB)');
})();




// ─────────────────────────────────────────────
// 1. ESPORTAZIONE DATABASE (backup completo)
//    Usa salvaDocumento: picker nativo SO (desktop), share (mobile), fallback download
// ─────────────────────────────────────────────
async function exportDatabaseToFile() {
  const data = { exportedAt: new Date().toISOString() };

  for (const store of STORES_EXPORT) {
    try {
      data[store] = await getAll(store);
    } catch (_) {
      data[store] = [];
    }
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const dataOggi = new Date().toISOString().slice(0, 10);
  const filename = `database_SafeHub_${dataOggi}.json`;

  if (typeof salvaDocumento === 'function') {
    const result = await salvaDocumento({
      filename,
      blob,
      tipoDoc: 'database',
      titoloCondivisione: 'Backup database ANAS SafeHub'
    });
    if (result.method !== 'cancelled') {
      if (typeof showCheckmark === 'function') showCheckmark();
    }
    return;
  }

  // Fallback se salva-file.js non è caricato
  const blobUrl = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href        = blobUrl;
  a.download    = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

  showToast('Database esportato ✓', 'success');
}

// ─────────────────────────────────────────────
// 2. IMPORTAZIONE DATABASE DA FILE
// ─────────────────────────────────────────────
async function importDatabaseFromFile(file) {
  const text = await file.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch (_) {
    showToast('File JSON non valido.', 'error');
    return false;
  }

  for (const store of STORES_EXPORT) {
    if (Array.isArray(data[store])) {
      for (const item of data[store]) {
        try { await saveItem(store, item); } catch (_) { /* skip duplicati */ }
      }
    }
  }

  return true;
}

// ─────────────────────────────────────────────
// 3. CARICAMENTO AUTOMATICO da data/database.json
//    (chiavetta USB o cartella del progetto)
// ─────────────────────────────────────────────

/**
 * Salva più record in un unico store in una SINGOLA transazione.
 * Molto più veloce di saveItem() in loop (1 transazione per record).
 */
function _bulkSave(storeName, items) {
  return new Promise((resolve, reject) => {
    if (!db) return reject('DB non inizializzato.');
    if (!Array.isArray(items) || items.length === 0) return resolve(0);

    const t = db.transaction(storeName, 'readwrite');
    const s = t.objectStore(storeName);
    let saved = 0;

    t.oncomplete = () => resolve(saved);
    t.onerror    = () => reject('Errore bulk-save in ' + storeName);
    t.onabort    = () => reject('Bulk-save abortito in ' + storeName);

    for (const item of items) {
      try {
        const req = s.put(item);
        req.onsuccess = () => { saved++; };
        req.onerror   = (e) => { e.preventDefault(); /* skip singolo record rotto, non abortire transazione */ };
      } catch(_) { /* skip */ }
    }
  });
}

async function tryLoadDatabaseJsonFromDataFolder() {
  try {
    const response = await fetch('./data/database.json');
    if (!response.ok) return false;

    const data = await response.json();

    // Bulk-save: 1 transazione per store invece di N per record
    for (const store of STORES_EXPORT) {
      if (Array.isArray(data[store]) && data[store].length > 0) {
        try { await _bulkSave(store, data[store]); } catch(_) { /* skip store rotto */ }
      }
    }

    console.info('database.json caricato automaticamente da data/');
    return true;
  } catch (_) {
    console.info('Nessun database.json trovato in data/ (normale su GitHub Pages).');
    return false;
  }
}

// ─────────────────────────────────────────────
// 4. SCRITTURA DIRETTA SU USB (File System Access API, solo Chrome)
// ─────────────────────────────────────────────
async function exportDatabaseWithFSAPI() {
  if (!window.showSaveFilePicker) {
    showToast('Il tuo browser non supporta la scrittura diretta su USB. Usa "Salva su USB".', 'warning');
    return;
  }

  const data = { exportedAt: new Date().toISOString() };
  for (const store of STORES_EXPORT) {
    try { data[store] = await getAll(store); } catch (_) { data[store] = []; }
  }

  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'database.json',
      types: [{ description: 'JSON Database', accept: { 'application/json': ['.json'] } }]
    });
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
    showToast('Database salvato direttamente sulla chiavetta USB ✓', 'success');
  } catch (err) {
    if (err.name !== 'AbortError') {
      showToast('Errore scrittura USB: ' + err.message, 'error');
    }
  }
}
