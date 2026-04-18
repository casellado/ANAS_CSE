// storage.js - Import / Export database.json (USB-first / GitHub Pages)

// Store da includere nel backup (NO blob binari)
const STORES_EXPORT = ['projects', 'verbali', 'nc', 'imprese',
                       'lavoratori', 'imprese_cantieri', 'doc_links', 'impostazioni'];

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
        req.onerror   = () => { /* skip singolo record rotto */ };
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
