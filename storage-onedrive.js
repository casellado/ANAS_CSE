// storage-onedrive.js — Livello 2 OneDrive · File System Access API
// ANAS SafeHub v2.0 — Geom. Dogano Casella · CSE ANAS SpA Calabria
//
// NON usa Microsoft Graph API — usa esclusivamente la File System Access API
// del browser sulla cartella OneDrive sincronizzata localmente.
// Compatibilità: Chrome ≥90, Edge ≥90 desktop (showDirectoryPicker).
// Firefox / Safari / mobile → tutte le funzioni restituiscono "inattivo", nessun crash.

// ─────────────────────────────────────────────────────────────────────────────
// COSTANTI
// ─────────────────────────────────────────────────────────────────────────────
const OD_SAFEHUB_DIR   = '_safehub';          // sottocartella dati JSON
const OD_REGISTRO      = 'registro.json';      // elenco lotti
const OD_IMPRESE       = 'imprese.json';       // anagrafica globale imprese
const OD_AUDIT         = 'audit.log.json';     // log modifiche
const OD_HANDLE_KEY    = 'onedrive_folder_handle'; // chiave in impostazioni IndexedDB
const OD_LOCK_TIMEOUT  = 5000;                // ms — timeout lock soft scrittura

// ─────────────────────────────────────────────────────────────────────────────
// STATO INTERNO (singleton)
// ─────────────────────────────────────────────────────────────────────────────
let _odHandleRadice = null;   // FileSystemDirectoryHandle cartella root
let _odConfigured   = false;  // true dopo verifica permessi
let _odSafehubDir   = null;   // handle di _safehub/

// Cache in-memory (timestamp → evita rilettura se file non cambiato)
const _odCache = new Map();   // key: 'Lotto_XXX' | 'registro' | 'imprese' → { data, mtime }
const OD_CACHE_MAX = 20;      // max lotti in cache (eviction LRU)

/** Inserisce un valore in cache con eviction LRU */
function _odCacheSet(key, value) {
  // Se la chiave esiste già, cancellala per ri-inserirla in coda (LRU)
  _odCache.delete(key);
  // Se la cache è piena, rimuovi il primo elemento (il più vecchio)
  if (_odCache.size >= OD_CACHE_MAX) {
    var firstKey = _odCache.keys().next().value;
    _odCache.delete(firstKey);
  }
  _odCache.set(key, value);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. RILEVAMENTO SUPPORTO BROWSER
// ─────────────────────────────────────────────────────────────────────────────
function _fsapiSupported() {
  return typeof window !== 'undefined' &&
         typeof window.showDirectoryPicker === 'function';
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. SANIFICAZIONE NOMI (usato per ID lotto → nome file/cartella)
// ─────────────────────────────────────────────────────────────────────────────
function _sanitizeNomeCartella(id) {
  return String(id || '').replace(/[^a-zA-Z0-9_\-]/g, '').substring(0, 64);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. CONFIGURAZIONE — prima volta
//    Mostra il directory picker, salva il handle in IndexedDB (impostazioni)
// ─────────────────────────────────────────────────────────────────────────────
async function configuraArchivioOneDrive() {
  if (!_fsapiSupported()) {
    showToast('Il tuo browser non supporta la selezione cartella. Usa Chrome o Edge.', 'warning');
    return false;
  }

  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite', startIn: 'documents' });

    // Salva il handle in IndexedDB tramite impostazioni
    const imp = (typeof caricaImpostazioni === 'function') ? await caricaImpostazioni() : {};
    imp[OD_HANDLE_KEY] = handle;
    if (typeof salvaImpostazioni === 'function') await salvaImpostazioni(imp);

    _odHandleRadice = handle;
    _odConfigured   = true;
    _odSafehubDir   = null; // forza re-init

    // Crea sottocartella _safehub se non esiste
    await _getOrCreateSafehubDir();

    // Inizializza registro se non esiste
    await _initRegistroSeAssente();

    showToast('☁️ Cartella OneDrive configurata correttamente ✓', 'success');

    // Trigger UI update
    if (typeof aggiornaStatoOneDriveUI === 'function') aggiornaStatoOneDriveUI();

    return true;
  } catch (err) {
    if (err.name === 'AbortError') return false; // utente ha annullato
    console.error('[OneDrive] Errore configurazione:', err);
    showToast('Errore configurazione OneDrive: ' + err.message, 'error');
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. STATO ATTIVO
// ─────────────────────────────────────────────────────────────────────────────
async function isArchivioOneDriveAttivo() {
  if (!_fsapiSupported()) return false;

  // Se già verificato in questa sessione, usa lo stato in memoria
  if (_odConfigured && _odHandleRadice) {
    try {
      const perm = await _odHandleRadice.queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') return true;
    } catch (_) {}
    _odConfigured = false;
  }

  // Tenta di ripristinare il handle dalla IndexedDB
  try {
    if (typeof caricaImpostazioni !== 'function') return false;
    const imp = await caricaImpostazioni();
    const handle = imp[OD_HANDLE_KEY];
    if (!handle || typeof handle.queryPermission !== 'function') return false;

    const perm = await handle.queryPermission({ mode: 'readwrite' });
    if (perm === 'granted') {
      _odHandleRadice = handle;
      _odConfigured   = true;
      _odSafehubDir   = null;
      return true;
    }

    // Permesso in attesa di conferma dell'utente (richiede gesto)
    if (perm === 'prompt') {
      // Non richiamiamo requestPermission qui (richiederebbe un click)
      // Il pannello UI mostrerà il badge "Richiede conferma"
      _odHandleRadice = handle;
      _odConfigured   = false;
      return false;
    }

    return false;
  } catch (_) {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. RICHIESTA PERMESSO (da gesto utente nel pannello OneDrive)
// ─────────────────────────────────────────────────────────────────────────────
async function richiediPermessoOneDrive() {
  if (!_fsapiSupported()) return false;
  try {
    if (typeof caricaImpostazioni !== 'function') return false;
    const imp = await caricaImpostazioni();
    const handle = imp[OD_HANDLE_KEY];
    if (!handle || typeof handle.requestPermission !== 'function') return false;

    const perm = await handle.requestPermission({ mode: 'readwrite' });
    if (perm === 'granted') {
      _odHandleRadice = handle;
      _odConfigured   = true;
      _odSafehubDir   = null;
      if (typeof aggiornaStatoOneDriveUI === 'function') aggiornaStatoOneDriveUI();
      return true;
    }
    return false;
  } catch (err) {
    console.error('[OneDrive] Errore richiesta permesso:', err);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. DISCONNESSIONE
// ─────────────────────────────────────────────────────────────────────────────
async function disconnettiArchivioOneDrive() {
  _odHandleRadice = null;
  _odConfigured   = false;
  _odSafehubDir   = null;
  _odCache.clear();

  try {
    if (typeof caricaImpostazioni === 'function' && typeof salvaImpostazioni === 'function') {
      const imp = await caricaImpostazioni();
      delete imp[OD_HANDLE_KEY];
      await salvaImpostazioni(imp);
    }
  } catch (_) {}

  showToast('Disconnesso da OneDrive. Dati letti da IndexedDB locale.', 'info');
  if (typeof aggiornaStatoOneDriveUI === 'function') aggiornaStatoOneDriveUI();
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. HELPERS HANDLE
// ─────────────────────────────────────────────────────────────────────────────

/** Restituisce l'handle root (già verificato) o null */
async function _getHandleRadice() {
  if (_odConfigured && _odHandleRadice) return _odHandleRadice;
  const attivo = await isArchivioOneDriveAttivo();
  return attivo ? _odHandleRadice : null;
}

/** Ottiene (o crea) la cartella _safehub/ dentro la root */
async function _getOrCreateSafehubDir() {
  if (_odSafehubDir) return _odSafehubDir;
  const radice = await _getHandleRadice();
  if (!radice) return null;
  _odSafehubDir = await radice.getDirectoryHandle(OD_SAFEHUB_DIR, { create: true });
  return _odSafehubDir;
}

/** Legge testo grezzo da un file handle */
async function _leggiFile(dirHandle, nomeFile) {
  const fh  = await dirHandle.getFileHandle(nomeFile, { create: false });
  const f   = await fh.getFile();
  return f.text();
}

/** Scrive testo in un file (sovrascrive) — scrittura atomica con gestione errori */
async function _scriviFile(dirHandle, nomeFile, testo) {
  var fh = await dirHandle.getFileHandle(nomeFile, { create: true });
  var writable = null;
  try {
    writable = await fh.createWritable();
    await writable.write(testo);
    await writable.close();
    writable = null; // segnala chiusura riuscita
  } catch (err) {
    // Se il writable è ancora aperto, prova ad abortire per non lasciare il file troncato
    if (writable) {
      try { await writable.abort(); } catch (_) { /* best effort */ }
    }
    console.error('[OneDrive] Errore scrittura file ' + nomeFile + ':', err);
    throw new Error('Scrittura fallita su ' + nomeFile + ': ' + err.message);
  }
}

/** Legge e fa il parse di un JSON da una dir handle */
async function _leggiJSON(dirHandle, nomeFile) {
  try {
    const testo = await _leggiFile(dirHandle, nomeFile);
    return JSON.parse(testo);
  } catch (err) {
    if (err.name === 'NotFoundError' || err.name === 'TypeMismatchError') return null;
    // JSON corrotto
    console.error(`[OneDrive] JSON corrotto: ${nomeFile}`, err);
    throw new Error(`File ${nomeFile} corrotto o illeggibile: ${err.message}`);
  }
}

/** Scrive un oggetto JS come JSON in una dir handle */
async function _scriviJSON(dirHandle, nomeFile, obj) {
  await _scriviFile(dirHandle, nomeFile, JSON.stringify(obj, null, 2));
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. REGISTRO LOTTI
// ─────────────────────────────────────────────────────────────────────────────

async function _initRegistroSeAssente() {
  const dir = await _getOrCreateSafehubDir();
  if (!dir) return;
  try {
    await dir.getFileHandle(OD_REGISTRO, { create: false });
    // esiste già
  } catch (e) {
    if (e.name === 'NotFoundError') {
      await _scriviJSON(dir, OD_REGISTRO, { lotti: [], aggiornatoAt: new Date().toISOString() });
    }
  }
}

async function leggiRegistroLotti() {
  const dir = await _getOrCreateSafehubDir();
  if (!dir) return { lotti: [] };
  const data = await _leggiJSON(dir, OD_REGISTRO);
  return data || { lotti: [] };
}

async function aggiornaRegistroLotti(lotto) {
  const dir = await _getOrCreateSafehubDir();
  if (!dir) return;

  const registro = await leggiRegistroLotti();
  const idx = registro.lotti.findIndex(l => l.id === lotto.id);
  if (idx >= 0) {
    registro.lotti[idx] = { ...registro.lotti[idx], ...lotto };
  } else {
    registro.lotti.push(lotto);
  }
  registro.aggiornatoAt = new Date().toISOString();
  await _scriviJSON(dir, OD_REGISTRO, registro);
  _odCache.delete('registro');
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. LOTTI (read / write con lock soft)
// ─────────────────────────────────────────────────────────────────────────────

async function leggiLotto(lottoId) {
  const dir = await _getOrCreateSafehubDir();
  if (!dir) throw new Error('OneDrive non disponibile');

  const safeLottoId = _sanitizeNomeCartella(lottoId);
  const nomeFile    = `Lotto_${safeLottoId}.json`;

  // Cache in-memory: legge il file e controlla mtime
  try {
    const fh   = await dir.getFileHandle(nomeFile, { create: false });
    const file = await fh.getFile();
    const mtime = file.lastModified;

    const cached = _odCache.get(lottoId);
    if (cached && cached.mtime === mtime) {
      return cached.data;
    }

    const testo = await file.text();
    const data  = JSON.parse(testo);
    _odCacheSet(lottoId, { data, mtime });
    return data;
  } catch (e) {
    if (e.name === 'NotFoundError') {
      // Lotto non esiste ancora: restituisci struttura vuota
      return _lottoVuoto(lottoId);
    }
    throw e;
  }
}

function _lottoVuoto(lottoId) {
  return {
    lottoId,
    nc:               [],
    verbali:          [],
    imprese_cantieri: [],
    foto_meta:        [],
    documenti:        [],
    createdAt:        new Date().toISOString(),
    updatedAt:        new Date().toISOString(),
    updatedBy:        ''
  };
}

/**
 * Salva il lotto con lock soft anti-conflitto.
 * opts.forzato = true → sovrascrive senza controllo conflitti
 * Ritorna { success: true } o { success: false, conflitto: true, remoto: {...} }
 */
async function salvaLotto(lottoId, dati, opts = {}) {
  const dir = await _getOrCreateSafehubDir();
  if (!dir) throw new Error('OneDrive non disponibile');

  const safeLottoId = _sanitizeNomeCartella(lottoId);
  const nomeFile    = `Lotto_${safeLottoId}.json`;

  if (!opts.forzato) {
    // Lock soft: confronta updatedAt remoto con quello che abbiamo letto
    const remoto = await _leggiJSON(dir, nomeFile);
    if (remoto && remoto.updatedAt && dati._updatedAtOriginale &&
        remoto.updatedAt !== dati._updatedAtOriginale) {
      // Qualcuno ha modificato il file nel frattempo
      return { success: false, conflitto: true, remoto };
    }
  }

  // Arricchisci i metadati
  const payload = {
    ...dati,
    updatedAt:            new Date().toISOString(),
    updatedBy:            await _getNomeTecnico(),
    _updatedAtOriginale:  undefined  // rimuovi campo di servizio
  };
  delete payload._updatedAtOriginale;

  await _scriviJSON(dir, nomeFile, payload);
  _odCache.delete(lottoId); // invalida cache

  // Aggiorna il registro con updatedAt del lotto
  await aggiornaRegistroLotti({
    id:        lottoId,
    updatedAt: payload.updatedAt,
    updatedBy: payload.updatedBy
  });

  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. IMPRESE GLOBALI
// ─────────────────────────────────────────────────────────────────────────────

async function leggiImprese() {
  const dir = await _getOrCreateSafehubDir();
  if (!dir) return [];
  const data = await _leggiJSON(dir, OD_IMPRESE);
  return (data && data.imprese) ? data.imprese : [];
}

async function salvaImprese(elenco) {
  const dir = await _getOrCreateSafehubDir();
  if (!dir) throw new Error('OneDrive non disponibile');
  await _scriviJSON(dir, OD_IMPRESE, {
    imprese:     elenco,
    aggiornatoAt: new Date().toISOString(),
    aggiornatoDa: await _getNomeTecnico()
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. AUDIT LOG
// ─────────────────────────────────────────────────────────────────────────────

async function aggiungiAudit(evento) {
  const dir = await _getOrCreateSafehubDir();
  if (!dir) return; // silenzioso se OneDrive non disponibile

  try {
    const data   = (await _leggiJSON(dir, OD_AUDIT)) || { eventi: [] };
    const voci   = Array.isArray(data.eventi) ? data.eventi : [];

    voci.unshift({
      timestamp: new Date().toISOString(),
      utente:    await _getNomeTecnico(),
      ...evento
    });

    // Mantieni ultimi 500 eventi per non far crescere il file all'infinito
    const trimmed = voci.slice(0, 500);
    await _scriviJSON(dir, OD_AUDIT, { eventi: trimmed });
  } catch (err) {
    console.warn('[OneDrive] Impossibile scrivere audit:', err.message);
    // Non propagare — l'audit non deve bloccare l'operazione principale
  }
}

async function leggiAudit(ultimi = 20, filtroLotto = null) {
  const dir = await _getOrCreateSafehubDir();
  if (!dir) return [];
  try {
    const data  = (await _leggiJSON(dir, OD_AUDIT)) || { eventi: [] };
    let   voci  = Array.isArray(data.eventi) ? data.eventi : [];
    if (filtroLotto) voci = voci.filter(e => e.lotto === filtroLotto);
    return voci.slice(0, ultimi);
  } catch (_) {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. STRUTTURA CARTELLE PER LOTTO (MOD-9)
//     Crea le 21 sottocartelle standard alla prima apertura del lotto
// ─────────────────────────────────────────────────────────────────────────────

const OD_STRUTTURA_LOTTO = [
  '01_Documenti_Fondamentali/PSC',
  '01_Documenti_Fondamentali/POS',
  '01_Documenti_Fondamentali/DURC',
  '01_Documenti_Fondamentali/Nomina_CSE',
  '01_Documenti_Fondamentali/Notifica_Preliminare',
  '01_Documenti_Fondamentali/Contratto_Affidamento',
  '01_Documenti_Fondamentali/Iscrizione_CCIAA',
  '01_Documenti_Fondamentali/Elenco_Lavoratori',
  '01_Documenti_Fondamentali/DUVRI',
  '01_Documenti_Fondamentali/Autorizzazioni_ANAS',
  '02_Verbali/Sopralluogo',
  '02_Verbali/Riunioni_Coordinamento',
  '02_Verbali/Verifica_POS',
  '03_Non_Conformita/Aperte',
  '03_Non_Conformita/Chiuse',
  '03_Non_Conformita/Foto',
  '04_ODS/Ricevuti',
  '04_ODS/Inviati',
  '05_Lettere_Sospensione',
  '06_Diario_Giornaliero',
  '99_Altri_Documenti'
];

/** Mappatura tipo documento → sottocartella fisica */
const OD_MAPPA_SOTTOCARTELLE = {
  'verbale-sopralluogo':               '02_Verbali/Sopralluogo',
  'riunione':                          '02_Verbali/Riunioni_Coordinamento',
  'pos':                               '02_Verbali/Verifica_POS',
  'nc':                                '03_Non_Conformita/Aperte',
  'nc-chiusa':                         '03_Non_Conformita/Chiuse',
  'foto-nc':                           '03_Non_Conformita/Foto',
  'ods-ricevuto':                      '04_ODS/Ricevuti',
  'ods-inviato':                       '04_ODS/Inviati',
  'sospensione':                       '05_Lettere_Sospensione',
  'report-giornaliero':                '06_Diario_Giornaliero',
  'fondamentale-psc':                  '01_Documenti_Fondamentali/PSC',
  'fondamentale-pos':                  '01_Documenti_Fondamentali/POS',
  'fondamentale-durc':                 '01_Documenti_Fondamentali/DURC',
  'fondamentale-notifica-preliminare': '01_Documenti_Fondamentali/Notifica_Preliminare',
  'fondamentale-nomina-cse':           '01_Documenti_Fondamentali/Nomina_CSE',
  'fondamentale-contratto-affidamento':'01_Documenti_Fondamentali/Contratto_Affidamento',
  'fondamentale-iscrizione-cciaa':     '01_Documenti_Fondamentali/Iscrizione_CCIAA',
  'fondamentale-elenco-lavoratori':    '01_Documenti_Fondamentali/Elenco_Lavoratori',
  'fondamentale-duvri':                '01_Documenti_Fondamentali/DUVRI',
  'fondamentale-autorizzazioni':       '01_Documenti_Fondamentali/Autorizzazioni_ANAS',
  'documento':                         '99_Altri_Documenti',
  'generico':                          '99_Altri_Documenti'
};

/**
 * Crea la struttura completa delle 21 sottocartelle per un lotto.
 * Idempotente: se le cartelle esistono già, non le tocca.
 */
async function creaStrutturaLotto(lottoId) {
  const radice = await _getHandleRadice();
  if (!radice) return;

  const safeLottoId = _sanitizeNomeCartella(lottoId);

  try {
    const lottoDir = await radice.getDirectoryHandle(`Lotto_${safeLottoId}`, { create: true });

    for (const percorso of OD_STRUTTURA_LOTTO) {
      let current = lottoDir;
      for (const parte of percorso.split('/')) {
        current = await current.getDirectoryHandle(parte, { create: true });
      }
    }

    await aggiungiAudit({
      azione:    'struttura.create',
      lotto:     lottoId,
      dettaglio: `Create ${OD_STRUTTURA_LOTTO.length} sottocartelle`
    });
  } catch (err) {
    console.warn(`[OneDrive] Impossibile creare struttura lotto ${lottoId}:`, err.message);
  }
}

/**
 * Restituisce l'handle della sottocartella per un tipo documento.
 * Usato da salva-file.js (in futuro v2.1) — disponibile ora come API.
 */
async function getSottocartellaTipoDoc(lottoId, tipoDoc) {
  const radice = await _getHandleRadice();
  if (!radice) return null;

  const safeLottoId   = _sanitizeNomeCartella(lottoId);
  const sottocartella = OD_MAPPA_SOTTOCARTELLE[tipoDoc] || '99_Altri_Documenti';

  try {
    const lottoDir = await radice.getDirectoryHandle(`Lotto_${safeLottoId}`, { create: false });
    let   current  = lottoDir;
    for (const parte of sottocartella.split('/')) {
      current = await current.getDirectoryHandle(parte, { create: true });
    }
    return current;
  } catch (_) {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 13. TAG LIBERI — normalizzazione
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalizza un tag libero utente:
 * lowercase, trim, spazi → trattini, no caratteri speciali, max 30 char.
 */
function normalizzaTag(raw) {
  return String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-àèéìòùç]/g, '')
    .substring(0, 30);
}

/**
 * Restituisce i tag liberi di un documento (quelli senza ':').
 */
function estraiTagLiberi(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.filter(t => typeof t === 'string' && !t.includes(':'));
}

/**
 * Raccoglie tutti i tag liberi già usati nei documenti del lotto.
 * Utile per l'autocomplete nel modal upload.
 */
async function getTagLiberiLotto(lottoId) {
  try {
    const dati = await leggiLotto(lottoId);
    const docs = Array.isArray(dati.documenti) ? dati.documenti : [];
    const set  = new Set();
    docs.forEach(d => estraiTagLiberi(d.tags || []).forEach(t => set.add(t)));
    return Array.from(set).sort();
  } catch (_) {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 14. HELPER NOME TECNICO
// ─────────────────────────────────────────────────────────────────────────────

let _cachedNomeTecnico = null;

async function _getNomeTecnico() {
  if (_cachedNomeTecnico) return _cachedNomeTecnico;
  try {
    if (typeof caricaImpostazioni === 'function') {
      const imp = await caricaImpostazioni();
      _cachedNomeTecnico = imp.firmaNome || imp.studioNome || 'Tecnico';
      return _cachedNomeTecnico;
    }
  } catch (_) {}
  return 'Tecnico';
}

/** Invalida la cache nome se l'utente cambia le impostazioni */
function _invalidaCacheNomeTecnico() {
  _cachedNomeTecnico = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 15. CONTROLLA MODIFICA ESTERNA (per MOD-4 polling)
//     Restituisce il lastModified del file JSON del lotto (ms epoch)
//     o null se il file non esiste.
// ─────────────────────────────────────────────────────────────────────────────

async function getLastModifiedLotto(lottoId) {
  const dir = await _getOrCreateSafehubDir();
  if (!dir) return null;
  const safeLottoId = _sanitizeNomeCartella(lottoId);
  const nomeFile    = `Lotto_${safeLottoId}.json`;
  try {
    const fh   = await dir.getFileHandle(nomeFile, { create: false });
    const file = await fh.getFile();
    return file.lastModified;
  } catch (_) {
    return null;
  }
}

/** Invalida la cache del lotto (forza rilettura da disco) */
function invalidaCacheLotto(lottoId) {
  _odCache.delete(lottoId);
}

/** Invalida tutta la cache in memoria */
function invalidaCacheOneDrive() {
  _odCache.clear();
}
// Esportazione funzioni su window per moduli UI
window.isArchivioOneDriveAttivo = isArchivioOneDriveAttivo;
window.configuraArchivioOneDrive = configuraArchivioOneDrive;
window.disconnettiArchivioOneDrive = disconnettiArchivioOneDrive;
window.richiediPermessoOneDrive = richiediPermessoOneDrive;
window.leggiLotto = leggiLotto;
window.salvaLotto = salvaLotto;
window.leggiRegistroLotti = leggiRegistroLotti;
window.aggiornaRegistroLotti = aggiornaRegistroLotti;
window.leggiImprese = leggiImprese;
window.salvaImprese = salvaImprese;
window.aggiungiAudit = aggiungiAudit;
window.leggiAudit = leggiAudit;
window.creaStrutturaLotto = creaStrutturaLotto;
window.getSottocartellaTipoDoc = getSottocartellaTipoDoc;
window.normalizzaTag = normalizzaTag;
window.estraiTagLiberi = estraiTagLiberi;
window.getTagLiberiLotto = getTagLiberiLotto;
window.getLastModifiedLotto = getLastModifiedLotto;
window.invalidaCacheLotto = invalidaCacheLotto;
window.invalidaCacheOneDrive = invalidaCacheOneDrive;
