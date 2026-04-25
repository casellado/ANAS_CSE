// onedrive-ui.js — Pannello stato e configurazione OneDrive
// ANAS SafeHub v2.0 — Geom. Dogano Casella · CSE ANAS SpA Calabria
//
// Gestisce:
//  - Bottone topbar con badge stato (🔗 / ☁️ / ⚠️ / disabilitato)
//  - Modal configurazione (primo setup + riconfigurazione)
//  - Modal conflitto di sincronizzazione
//  - Banner "Imposta nome tecnico" se firmaNome è vuoto

// ─────────────────────────────────────────────────────────────────────────────
// 1. STATO BADGE TOPBAR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aggiorna il bottone OneDrive nella topbar in base allo stato corrente.
 * Chiamata: all'avvio app, dopo configura/disconnetti, dopo ogni verifica.
 */
async function aggiornaStatoOneDriveUI() {
  const btn   = document.getElementById('btn-onedrive-status');
  const icon  = document.getElementById('onedrive-status-icon');
  const label = document.getElementById('onedrive-status-label');
  if (!btn || !icon || !label) return;

  // ── Browser non supporta FSAPI ────────────────────────────────────────────
  if (typeof window.showDirectoryPicker !== 'function') {
    icon.textContent  = '☁️';
    label.textContent = 'OneDrive N/D';
    btn.disabled      = true;
    btn.className     = _classBtnOneDrive('unsupported');
    btn.setAttribute('title',
      'Archivio condiviso OneDrive richiede Chrome o Edge desktop. ' +
      'Su questo browser SafeHub funziona in modalità locale (IndexedDB).');
    btn.setAttribute('aria-label', 'OneDrive non disponibile su questo browser');
    _nascondiBtnRicarica();
    return;
  }

  btn.disabled  = false;
  btn.onclick   = apriPannelloOneDrive;

  // ── Verifica stato ────────────────────────────────────────────────────────
  const attivo = await isArchivioOneDriveAttivo();

  if (attivo) {
    icon.textContent  = '☁️';
    label.textContent = 'OneDrive attivo';
    btn.className     = _classBtnOneDrive('active');
    btn.setAttribute('title', 'Archivio condiviso OneDrive configurato e attivo. Clicca per gestire.');
    btn.setAttribute('aria-label', 'OneDrive attivo — clicca per gestire');
    _mostraBtnRicarica();
  } else {
    // Controlla se c'è un handle salvato ma senza permesso
    const imp = (typeof caricaImpostazioni === 'function') ? await caricaImpostazioni() : {};
    const handle = imp?.onedrive_folder_handle;

    if (handle && typeof handle.queryPermission === 'function') {
      // Handle presente ma permesso non concesso (cartella spostata o prompt)
      icon.textContent  = '⚠️';
      label.textContent = 'OneDrive — Richiede accesso';
      btn.className     = _classBtnOneDrive('warning');
      btn.setAttribute('title', 'OneDrive non più accessibile. Clicca per riconfigurare o concedere l\'accesso.');
      btn.setAttribute('aria-label', 'OneDrive richiede conferma accesso — clicca per gestire');
    } else {
      icon.textContent  = '🔗';
      label.textContent = 'OneDrive';
      btn.className     = _classBtnOneDrive('inactive');
      btn.setAttribute('title', 'Configura archivio condiviso OneDrive per collaborazione multi-tecnico.');
      btn.setAttribute('aria-label', 'Configura OneDrive');
    }
    _nascondiBtnRicarica();
  }

  // Banner nome tecnico mancante
  await _verificaBannerNomeTecnico();
}

function _classBtnOneDrive(stato) {
  const base = 'topbar-btn flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition focus:outline-none focus:ring-2';
  const varianti = {
    active:      base + ' bg-sky-600 text-white hover:bg-sky-700 focus:ring-sky-400',
    warning:     base + ' bg-amber-500 text-white hover:bg-amber-600 focus:ring-amber-400',
    inactive:    base + ' bg-slate-700 text-slate-200 hover:bg-slate-600 focus:ring-slate-400',
    unsupported: base + ' bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed',
  };
  return varianti[stato] || varianti.inactive;
}

function _mostraBtnRicarica() {
  const btn = document.getElementById('btn-onedrive-ricarica');
  if (btn) btn.classList.remove('hidden');
}

function _nascondiBtnRicarica() {
  const btn = document.getElementById('btn-onedrive-ricarica');
  if (btn) btn.classList.add('hidden');
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. BANNER NOME TECNICO MANCANTE
// ─────────────────────────────────────────────────────────────────────────────

async function _verificaBannerNomeTecnico() {
  // Solo se OneDrive attivo — il nome è importante per i metadati
  const attivo = await isArchivioOneDriveAttivo();
  if (!attivo) { _rimuoviBannerNome(); return; }

  const imp = (typeof caricaImpostazioni === 'function') ? await caricaImpostazioni() : {};
  const nome = (imp?.firmaNome || '').trim();

  if (!nome) {
    _mostraBannerNome();
  } else {
    _rimuoviBannerNome();
  }
}

function _mostraBannerNome() {
  if (document.getElementById('banner-nome-tecnico')) return;

  const banner = document.createElement('div');
  banner.id        = 'banner-nome-tecnico';
  banner.className = 'fixed top-14 left-0 right-0 z-40 bg-amber-50 border-b border-amber-300 ' +
                     'flex items-center justify-between px-4 py-2 text-xs text-amber-800';
  banner.setAttribute('role', 'alert');
  banner.innerHTML = `
    <span>
      ⚠️ <strong>OneDrive attivo:</strong> Imposta il tuo nome nelle
      <button onclick="switchView('impostazioni')" class="underline font-bold hover:text-amber-900 focus:outline-none">
        Impostazioni
      </button>
      per identificare le tue modifiche nel registro condiviso.
    </span>
    <button onclick="document.getElementById('banner-nome-tecnico')?.remove()"
            class="ml-4 text-amber-600 hover:text-amber-800 font-bold focus:outline-none"
            aria-label="Chiudi avviso">✕</button>
  `;
  // Inserisci dopo la topbar (primo figlio del main)
  const main = document.querySelector('body > div.flex-1');
  if (main) main.prepend(banner);
  else document.body.prepend(banner);
}

function _rimuoviBannerNome() {
  document.getElementById('banner-nome-tecnico')?.remove();
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. PANNELLO CONFIGURAZIONE ONEDRIVE
// ─────────────────────────────────────────────────────────────────────────────

async function apriPannelloOneDrive() {
  const existing = document.getElementById('modal-onedrive-config');
  if (existing) existing.remove();

  const attivo = await isArchivioOneDriveAttivo();
  const imp    = (typeof caricaImpostazioni === 'function') ? await caricaImpostazioni() : {};
  const handle = imp?.onedrive_folder_handle;

  // Determina stato
  let statoLabel = '';
  let statoClass = '';
  let nomeCartella = '';
  let permPending  = false;

  if (attivo) {
    nomeCartella = handle?.name || '(cartella configurata)';
    statoLabel   = '☁️ Connesso';
    statoClass   = 'text-sky-700 bg-sky-50 border border-sky-200';
  } else if (handle) {
    nomeCartella = handle?.name || '(cartella non accessibile)';
    statoLabel   = '⚠️ Richiede accesso';
    statoClass   = 'text-amber-700 bg-amber-50 border border-amber-200';
    permPending  = true;
  } else {
    statoLabel = '🔗 Non configurato';
    statoClass = 'text-slate-600 bg-slate-50 border border-slate-200';
  }

  const modal = document.createElement('div');
  modal.id        = 'modal-onedrive-config';
  modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'od-modal-title');

  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">

      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 id="od-modal-title" class="text-lg font-bold text-slate-800">
            ☁️ Archivio condiviso OneDrive
          </h2>
          <p class="text-xs text-slate-500 mt-1">
            Condividi NC, verbali e cantieri con altri tecnici tramite la cartella OneDrive locale.
          </p>
        </div>
        <button onclick="document.getElementById('modal-onedrive-config').remove()"
                class="text-slate-400 hover:text-slate-700 focus:outline-none shrink-0 p-1"
                aria-label="Chiudi pannello">✕</button>
      </div>

      <!-- Stato attuale -->
      <div class="rounded-xl p-3 text-sm font-semibold ${statoClass}">
        ${statoLabel}
        ${nomeCartella ? `<span class="font-normal text-xs ml-2 opacity-75">· ${escapeHtml ? escapeHtml(nomeCartella) : nomeCartella}</span>` : ''}
      </div>

      <!-- Descrizione funzionamento -->
      <div class="bg-slate-50 rounded-xl p-4 space-y-2 text-xs text-slate-600">
        <p class="font-semibold text-slate-700">Come funziona:</p>
        <ul class="space-y-1 list-disc list-inside">
          <li>Seleziona la cartella OneDrive sincronizzata localmente (es. <code>C:\\OneDrive\\CSE\\</code>)</li>
          <li>SafeHub salva i dati in file JSON nella sottocartella <code>_safehub\\</code></li>
          <li>Gli altri tecnici vedono solo i lotti per cui hanno i permessi OneDrive</li>
          <li>Se OneDrive non è accessibile, SafeHub usa i dati in cache locale</li>
        </ul>
      </div>

      <!-- Azioni -->
      <div class="flex flex-col gap-2">

        ${permPending ? `
        <button id="btn-od-concedi-accesso"
                class="w-full bg-amber-600 text-white py-2.5 rounded-xl text-sm font-bold
                       hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-400">
          🔑 Concedi accesso alla cartella
        </button>` : ''}

        <button id="btn-od-configura"
                class="w-full ${attivo ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-sky-600 text-white hover:bg-sky-700'}
                       py-2.5 rounded-xl text-sm font-bold
                       focus:outline-none focus:ring-2 focus:ring-sky-400">
          ${attivo ? '🔄 Cambia cartella OneDrive' : '📁 Seleziona cartella OneDrive'}
        </button>

        ${attivo ? `
        <button id="btn-od-disconnetti"
                class="w-full bg-red-50 text-red-600 border border-red-200 py-2.5 rounded-xl
                       text-sm font-semibold hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400">
          🔌 Disconnetti (torna a modalità locale)
        </button>` : ''}

      </div>

      <p class="text-[11px] text-slate-400 text-center">
        Compatibile con Chrome e Edge desktop.
        Su Firefox e Safari SafeHub funziona in modalità locale.
      </p>
    </div>
  `;

  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.addEventListener('keydown', e => { if (e.key === 'Escape') modal.remove(); });
  document.body.appendChild(modal);

  // Event listeners
  if (permPending) {
    modal.querySelector('#btn-od-concedi-accesso')?.addEventListener('click', async () => {
      modal.remove();
      const ok = await richiediPermessoOneDrive();
      if (ok) {
        showToast('☁️ Accesso OneDrive concesso ✓', 'success');
        // Avvia migrazione se ci sono dati locali
        if (typeof verificaEAvviaMigrazione === 'function') await verificaEAvviaMigrazione();
      } else {
        showToast('Accesso non concesso. Riprova.', 'warning');
      }
      await aggiornaStatoOneDriveUI();
    });
  }

  modal.querySelector('#btn-od-configura')?.addEventListener('click', async () => {
    modal.remove();
    const ok = await configuraArchivioOneDrive();
    if (ok) {
      // Avvia migrazione se ci sono dati locali
      if (typeof verificaEAvviaMigrazione === 'function') await verificaEAvviaMigrazione();
    }
    await aggiornaStatoOneDriveUI();
  });

  modal.querySelector('#btn-od-disconnetti')?.addEventListener('click', async () => {
    if (confirm('Disconnettere OneDrive?\n\nI dati rimangono nella cache locale e nella cartella OneDrive. Puoi riconnetterti quando vuoi.')) {
      modal.remove();
      await disconnettiArchivioOneDrive();
      await aggiornaStatoOneDriveUI();
    }
  });

  // Focus primo bottone attivo
  setTimeout(() => {
    modal.querySelector('button:not([disabled])').focus();
  }, 50);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. MODAL CONFLITTO DI SINCRONIZZAZIONE
//    Chiamato da storage.js (MOD-1) quando salvaLotto restituisce conflitto
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mostra il modal di risoluzione conflitto.
 * @param {string} lottoId
 * @param {object} datiLocali — l'oggetto che si stava tentando di salvare
 * @param {object} datiRemoti — quello letto da OneDrive (più recente)
 * @param {Function} onSovrascrivi — callback se utente sceglie "Sovrascrivi"
 * @param {Function} onAnnulla    — callback se utente sceglie "Annulla" (usa i remoti)
 */
function mostraModalConflittoSync(lottoId, datiLocali, datiRemoti, onSovrascrivi, onAnnulla) {
  const existing = document.getElementById('modal-conflitto-sync');
  if (existing) existing.remove();

  const remotoTime = datiRemoti?.updatedAt
    ? new Date(datiRemoti.updatedAt).toLocaleString('it-IT')
    : 'data sconosciuta';
  const remotoBy   = datiRemoti?.updatedBy || 'altro tecnico';

  const modal = document.createElement('div');
  modal.id        = 'modal-conflitto-sync';
  modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9990] p-4';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'conflitto-title');

  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">

      <div class="flex items-center gap-3">
        <div class="text-3xl">⚠️</div>
        <div>
          <h2 id="conflitto-title" class="text-lg font-bold text-slate-800">Conflitto di sincronizzazione</h2>
          <p class="text-xs text-slate-500 mt-0.5">Lotto <strong>${escapeHtml ? escapeHtml(lottoId) : lottoId}</strong></p>
        </div>
      </div>

      <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-1">
        <p>Il file in OneDrive è stato modificato da <strong>${escapeHtml ? escapeHtml(remotoBy) : remotoBy}</strong></p>
        <p class="text-xs">il <strong>${remotoTime}</strong></p>
        <p class="text-xs mt-2 text-amber-700">
          Hai due opzioni: mantieni i tuoi dati (sovrascrivendo quelli remoti) oppure
          annulla e ricarica i dati aggiornati dal collega.
        </p>
      </div>

      <div class="flex flex-col gap-2">
        <button id="btn-conflitto-sovrascrivi"
                class="w-full bg-red-600 text-white py-2.5 rounded-xl text-sm font-bold
                       hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400">
          💾 Salva le mie modifiche (sovrascrivi)
        </button>
        <button id="btn-conflitto-annulla"
                class="w-full bg-slate-100 text-slate-700 py-2.5 rounded-xl text-sm font-semibold
                       hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400">
          ↩ Annulla — usa i dati aggiornati
        </button>
      </div>

      <p class="text-[11px] text-slate-400 text-center">
        Suggerimento: in caso di dubbio, annulla e ricarica per confrontare prima di salvare.
      </p>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#btn-conflitto-sovrascrivi').addEventListener('click', () => {
    modal.remove();
    if (typeof onSovrascrivi === 'function') onSovrascrivi();
  });

  modal.querySelector('#btn-conflitto-annulla').addEventListener('click', () => {
    modal.remove();
    if (typeof onAnnulla === 'function') onAnnulla();
    showToast('Modifiche annullate. Ricarica il lotto per vedere i dati aggiornati.', 'info');
  });

  // Focus sul bottone "Annulla" per default (scelta più sicura)
  setTimeout(() => modal.querySelector('#btn-conflitto-annulla')?.focus(), 50);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. BADGE ACCESSO LOTTI (mostrato nell'Hub — usato da MOD-3)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aggiorna o rimuove il badge "Accesso completo / limitato" sopra la griglia cantieri.
 * @param {number} totale — lotti totali nel registro
 * @param {number} accessibili — lotti effettivamente leggibili
 */
function aggiornaBadgeAccessoLotti(totale, accessibili) {
  const container = document.getElementById('hub-onedrive-accesso');
  if (!container) return;

  if (totale === 0 || accessibili === null) {
    // OneDrive non attivo o nessun dato
    container.innerHTML = '';
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');

  if (accessibili === 0) {
    container.innerHTML = `
      <div class="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-start gap-3">
        <span class="text-2xl shrink-0">🚫</span>
        <div>
          <p class="font-bold">Nessun lotto accessibile</p>
          <p class="text-xs mt-1">
            Non hai permessi su alcun lotto della cartella OneDrive condivisa.
            Contatta il CSE per verificare le autorizzazioni.
          </p>
        </div>
      </div>`;
    return;
  }

  if (accessibili < totale) {
    container.innerHTML = `
      <div class="bg-sky-50 border border-sky-200 rounded-xl px-4 py-2 text-xs text-sky-700
                  flex items-center gap-2">
        <span>☁️</span>
        <span>
          <strong>Accesso limitato:</strong> vedi ${accessibili} di ${totale} lotti
          (filtro permessi OneDrive attivo)
        </span>
      </div>`;
  } else {
    container.innerHTML = `
      <div class="bg-sky-50 border border-sky-200 rounded-xl px-4 py-2 text-xs text-sky-700
                  flex items-center gap-2">
        <span>☁️</span>
        <span><strong>Accesso completo:</strong> ${accessibili} lotti sincronizzati con OneDrive</span>
      </div>`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. TOAST MODIFICHE ESTERNE (usato da MOD-4 polling)
// ─────────────────────────────────────────────────────────────────────────────

let _toastModificheEsterne = null;

/**
 * Mostra un toast non bloccante quando rileva modifiche esterne al lotto.
 * @param {Function} onRicarica — callback al click "Ricarica"
 */
function mostraToastModificheEsterne(onRicarica) {
  // Rimuovi eventuale toast precedente dello stesso tipo
  _toastModificheEsterne?.remove();

  const toast = document.createElement('div');
  toast.className = 'fixed bottom-20 left-1/2 -translate-x-1/2 z-[9980] ' +
                    'bg-white border border-sky-200 shadow-xl rounded-2xl ' +
                    'flex items-center gap-3 px-4 py-3 text-sm text-slate-700 ' +
                    'animate-slide-up max-w-sm w-[calc(100%-2rem)]';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  toast.innerHTML = `
    <span class="text-xl shrink-0">📝</span>
    <span class="flex-1 text-xs">Modifiche esterne rilevate sul lotto corrente.</span>
    <button class="bg-sky-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg
                   hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-400 shrink-0"
            aria-label="Ricarica dati aggiornati">
      Ricarica
    </button>
    <button class="text-slate-400 hover:text-slate-600 focus:outline-none shrink-0 text-base"
            aria-label="Ignora notifica modifiche esterne">✕</button>
  `;

  toast.querySelectorAll('button')[0].addEventListener('click', () => {
    toast.remove();
    _toastModificheEsterne = null;
    if (typeof onRicarica === 'function') onRicarica();
  });

  toast.querySelectorAll('button')[1].addEventListener('click', () => {
    toast.remove();
    _toastModificheEsterne = null;
  });

  document.body.appendChild(toast);
  _toastModificheEsterne = toast;

  // Auto-dismiss dopo 30 secondi
  setTimeout(() => {
    if (document.body.contains(toast)) {
      toast.remove();
      _toastModificheEsterne = null;
    }
  }, 30000);
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. INIT — da chiamare all'avvio dell'app
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inizializza il pannello OneDrive all'avvio della pagina.
 * Aggiorna il badge e, se necessario, mostra il banner nome.
 */
async function initOneDriveUI() {
  await aggiornaStatoOneDriveUI();
}
