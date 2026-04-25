// salva-file.js — API unificata per salvare qualsiasi documento v1.7
//
// Comportamento:
//   • Desktop Chrome/Edge → Picker nativo del SO, l'utente sceglie cartella e nome.
//                           Il SO ricorda l'ultima posizione.
//   • Mobile con Web Share → Bottom-sheet con scelta Condividi / Scarica.
//   • Fallback universale → Download classico nella cartella Download del browser.
//
// Usage:
//   salvaDocumento({
//     filename:           'Verbale_2026-04-18.docx',
//     blob:                new Blob([...], { type: 'application/msword' }),
//     cantiereId:         'CZ399',        // opzionale — per suggerire nome cartella
//     cantiereNome:       'Viadotto',     // opzionale — idem
//     tipoDoc:            'verbale-sopralluogo',  // opzionale
//     titoloCondivisione: 'Verbale Cantiere CZ399 del 18 aprile'  // opzionale
//   });

// ─────────────────────────────────────────────
// Rilevamento capacità browser
// ─────────────────────────────────────────────
function _isDesktopFSAPI() {
  return typeof window.showSaveFilePicker === 'function';
}

function _puoCondividereFile() {
  return typeof navigator.canShare === 'function' &&
         typeof navigator.share    === 'function';
}

function _isMobile() {
  return /Mobi|Android|iPad|iPhone/i.test(navigator.userAgent);
}

// ─────────────────────────────────────────────
// Mappatura estensioni → descrizione per il picker
// ─────────────────────────────────────────────
function _descrizionePicker(filename) {
  const ext = filename.toLowerCase().split('.').pop();
  const tipi = {
    'doc':  { description: 'Documento Word', accept: { 'application/msword': ['.doc'] }},
    'docx': { description: 'Documento Word', accept: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] }},
    'pdf':  { description: 'Documento PDF',  accept: { 'application/pdf': ['.pdf'] }},
    'json': { description: 'File JSON',      accept: { 'application/json': ['.json'] }},
    'xlsx': { description: 'Foglio Excel',   accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }},
    'csv':  { description: 'File CSV',       accept: { 'text/csv': ['.csv'] }},
    'txt':  { description: 'File di testo',  accept: { 'text/plain': ['.txt'] }},
    'jpg':  { description: 'Immagine JPG',   accept: { 'image/jpeg': ['.jpg', '.jpeg'] }},
    'png':  { description: 'Immagine PNG',   accept: { 'image/png': ['.png'] }},
  };
  return tipi[ext] || { description: 'File', accept: { 'application/octet-stream': ['.' + ext] }};
}

// ─────────────────────────────────────────────
// Suggerimento sottocartella (struttura consigliata, non forzata)
// ─────────────────────────────────────────────
function _sottocartellaSuggerita(tipoDoc) {
  const mappa = {
    // Verbali
    'verbale-sopralluogo':  '02_Verbali/Sopralluogo',
    'riunione':             '02_Verbali/Riunioni_Coordinamento',
    'pos':                  '02_Verbali/Verifica_POS',

    // Non conformità e ODS
    'nc':                   '03_Non_Conformita/Aperte',
    'nc-chiusa':            '03_Non_Conformita/Chiuse',
    'foto-nc':              '03_Non_Conformita/Foto',
    'ods-ricevuto':         '04_ODS/Ricevuti',
    'ods-inviato':          '04_ODS/Inviati',

    // Atti formali
    'sospensione':          '05_Lettere_Sospensione',
    'report-giornaliero':   '06_Diario_Giornaliero',

    // Documenti fondamentali (mappatura granulare)
    'fondamentale-psc':                 '01_Documenti_Fondamentali/PSC',
    'fondamentale-pos':                 '01_Documenti_Fondamentali/POS',
    'fondamentale-durc':                '01_Documenti_Fondamentali/DURC',
    'fondamentale-notifica-preliminare':'01_Documenti_Fondamentali/Notifica_Preliminare',
    'fondamentale-nomina-cse':          '01_Documenti_Fondamentali/Nomina_CSE',
    'fondamentale-contratto-affidamento':'01_Documenti_Fondamentali/Contratto_Affidamento',
    'fondamentale-iscrizione-cciaa':    '01_Documenti_Fondamentali/Iscrizione_CCIAA',
    'fondamentale-elenco-lavoratori':   '01_Documenti_Fondamentali/Elenco_Lavoratori',
    'fondamentale-duvri':               '01_Documenti_Fondamentali/DUVRI',
    'fondamentale-autorizzazioni':      '01_Documenti_Fondamentali/Autorizzazioni_ANAS',

    // Fallback
    'documento':            '99_Altri_Documenti',
    'foto':                 '03_Non_Conformita/Foto',
    'database':            '',
  };
  return mappa[tipoDoc] || '99_Altri_Documenti';
}

// ─────────────────────────────────────────────
// API PUBBLICA: salvaDocumento(opts)
// ─────────────────────────────────────────────
/**
 * Salva un file usando il metodo migliore per il contesto.
 * @returns {Promise<{success: boolean, method: string, filename?: string}>}
 */
async function salvaDocumento(opts) {
  const { filename, blob, cantiereId, cantiereNome, tipoDoc, titoloCondivisione } = opts;
  if (!filename || !blob) {
    throw new Error('filename e blob sono obbligatori');
  }

  // MOD-11: Archiviazione automatica su OneDrive (se attivo e desktop)
  const usaOneDrive = (typeof isArchivioOneDriveAttivo === 'function') ? await isArchivioOneDriveAttivo() : false;
  
  if (usaOneDrive && cantiereId && !_isMobile()) {
    try {
      const dirHandle = await getSottocartellaTipoDoc(cantiereId, tipoDoc);
      if (dirHandle) {
        const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
        const writable   = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        
        showToast(`Archiviato in OneDrive: ${filename} ✓`, 'success');
        if (typeof showCheckmark === 'function') showCheckmark();
        
        return { success: true, method: 'onedrive', filename };
      }
    } catch (err) {
      console.warn('[OneDrive] Salvataggio diretto fallito, uso picker:', err.message);
      // Se fallisce (es. permessi negati momentaneamente), prosegue con il picker
    }
  }

  // Mobile con Web Share → proponi scelta
  if (_isMobile() && _puoCondividereFile()) {
    return await _salvaMobile(filename, blob, titoloCondivisione || filename);
  }

  // Desktop con FSAPI → picker nativo SO
  if (_isDesktopFSAPI()) {
    return await _salvaConPicker(filename, blob, tipoDoc, cantiereId, cantiereNome);
  }

  // Fallback universale: download classico
  _downloadClassico(filename, blob);
  return { success: true, method: 'download', filename };
}

// ─────────────────────────────────────────────
// Desktop: picker nativo (l'utente sceglie ogni volta)
// ─────────────────────────────────────────────
async function _salvaConPicker(filename, blob, tipoDoc, cantiereId, cantiereNome) {
  const suggerito = _sottocartellaSuggerita(tipoDoc);
  const sanitize = (s) => String(s || '').replace(/[\/\\:*?"<>|]/g, '').replace(/\s+/g, '_');

  // Suggerisco un nome file che include cantiere se disponibile
  // Esempio: "CZ399_Verbale_2026-04-18.docx"
  const suggerito_filename = cantiereId
    ? `${sanitize(cantiereId)}_${filename}`
    : filename;

  const tipoMeta = _descrizionePicker(filename);

  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: suggerito_filename,
      types: [tipoMeta],
      // startIn = 'documents' | 'downloads' | 'desktop' — il SO ricorda l'ultima scelta
      startIn: 'documents'
    });

    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();

    showToast(`Salvato: ${handle.name}`, 'success');
    return { success: true, method: 'fsapi', filename: handle.name };

  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, method: 'cancelled' };
    }
    console.error('Errore salvataggio:', err);
    // Fallback a download
    _downloadClassico(suggerito_filename, blob);
    return { success: true, method: 'download-fallback', filename: suggerito_filename };
  }
}

// ─────────────────────────────────────────────
// Mobile: Condividi o Scarica
// ─────────────────────────────────────────────
async function _salvaMobile(filename, blob, titoloCondivisione) {
  return new Promise((resolve) => {
    const existing = document.getElementById('modal-scelta-salvataggio');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'modal-scelta-salvataggio';
    modal.className = 'fixed inset-0 bg-black/50 flex items-end justify-center z-[9999]';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', 'Come salvare il documento');

    modal.innerHTML = `
      <div class="bg-white w-full rounded-t-2xl p-4 space-y-2"
           style="padding-bottom: calc(16px + env(safe-area-inset-bottom, 0))">
        <div class="text-center pb-2 border-b border-slate-200">
          <div class="text-xs text-slate-500">Documento pronto</div>
          <div class="text-sm font-bold text-slate-800 truncate mt-1">${escapeHtml(filename)}</div>
        </div>

        <button id="btn-scelta-condividi"
                class="w-full flex items-center gap-3 p-4 rounded-xl bg-blue-50 hover:bg-blue-100
                       border border-blue-200 text-left"
                aria-label="Condividi con altra app">
          <div class="text-3xl">📤</div>
          <div>
            <div class="font-bold text-blue-900 text-sm">Condividi</div>
            <div class="text-xs text-blue-700">
              Email, WhatsApp, OneDrive, AirDrop, Teams…
            </div>
          </div>
        </button>

        <button id="btn-scelta-scarica"
                class="w-full flex items-center gap-3 p-4 rounded-xl bg-slate-50 hover:bg-slate-100
                       border border-slate-200 text-left"
                aria-label="Scarica nel dispositivo">
          <div class="text-3xl">⬇️</div>
          <div>
            <div class="font-bold text-slate-900 text-sm">Scarica</div>
            <div class="text-xs text-slate-600">Nella cartella Download del dispositivo</div>
          </div>
        </button>

        <button id="btn-scelta-annulla"
                class="w-full mt-2 p-3 text-sm text-slate-600 font-semibold">
          Annulla
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener('click', e => {
      if (e.target === modal) {
        modal.remove();
        resolve({ success: false, method: 'cancelled' });
      }
    });

    document.getElementById('btn-scelta-condividi').onclick = async () => {
      modal.remove();
      const ok = await _condividiFile(filename, blob, titoloCondivisione);
      resolve({ success: ok, method: ok ? 'share' : 'cancelled', filename });
    };
    document.getElementById('btn-scelta-scarica').onclick = () => {
      modal.remove();
      _downloadClassico(filename, blob);
      resolve({ success: true, method: 'download', filename });
    };
    document.getElementById('btn-scelta-annulla').onclick = () => {
      modal.remove();
      resolve({ success: false, method: 'cancelled' });
    };
  });
}

// ─────────────────────────────────────────────
// Condivisione Web Share API
// ─────────────────────────────────────────────
async function _condividiFile(filename, blob, titolo) {
  try {
    const file = new File([blob], filename, { type: blob.type });
    if (!navigator.canShare({ files: [file] })) {
      showToast('Questo tipo di file non può essere condiviso direttamente.', 'warning');
      _downloadClassico(filename, blob);
      return false;
    }
    await navigator.share({
      files: [file],
      title: titolo || filename
    });
    return true;
  } catch (err) {
    if (err.name === 'AbortError') return false;
    console.error('Errore condivisione:', err);
    showToast('Errore condivisione: ' + err.message, 'error');
    return false;
  }
}

// ─────────────────────────────────────────────
// Download classico (fallback universale)
// ─────────────────────────────────────────────
function _downloadClassico(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─────────────────────────────────────────────
// Alias retrocompatibili (vecchi moduli che chiamavano salvaIntelligente)
// ─────────────────────────────────────────────
const salvaIntelligente = salvaDocumento;
const salvaInArchivio   = salvaDocumento;
