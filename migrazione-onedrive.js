// migrazione-onedrive.js — MOD-2: Migrazione dati IndexedDB → OneDrive
// ANAS SafeHub v2.0 — Geom. Dogano Casella · CSE ANAS SpA Calabria
//
// Trigger: chiamato da onedrive-ui.js dopo configuraArchivioOneDrive() / richiediPermessoOneDrive()
// Comportamento:
//   1. Conta gli item presenti in IndexedDB (store condivisi)
//   2. Se totale > 0: mostra modal con conteggi e tre opzioni
//   3. "Carica tutti" → migra per lotto (atomico)
//   4. "Decidi per cantiere" → checkbox per singolo lotto
//   5. "Non ora" → chiude senza fare nulla
//   6. Merge per id: non sovrascrive item già presenti in OneDrive

// ─────────────────────────────────────────────────────────────────────────────
// STORE DA MIGRARE (esclude store sempre locali)
// ─────────────────────────────────────────────────────────────────────────────
const MIGRAZIONE_STORES_PROGETTO = ['verbali', 'nc', 'imprese_cantieri', 'documenti'];
const MIGRAZIONE_STORES_GLOBALI  = ['imprese', 'lavoratori'];

// ─────────────────────────────────────────────────────────────────────────────
// 1. ENTRY POINT — da chiamare dopo configurazione OneDrive riuscita
// ─────────────────────────────────────────────────────────────────────────────

async function verificaEAvviaMigrazione() {
  // Conta i dati presenti in IndexedDB locale
  const conteggi = await _contaItemLocali();
  const totale   = Object.values(conteggi).reduce((s, n) => s + n, 0);

  if (totale === 0) {
    // Nessun dato locale → niente da migrare
    return;
  }

  _mostraModalMigrazione(conteggi, totale);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. CONTEGGIO ITEM LOCALI (legge direttamente da IndexedDB, NON dal router)
// ─────────────────────────────────────────────────────────────────────────────

async function _contaItemLocali() {
  const stores  = ['projects', ...MIGRAZIONE_STORES_PROGETTO, ...MIGRAZIONE_STORES_GLOBALI];
  const conteggi = {};

  for (const s of stores) {
    try {
      // Usa window.__origGetAll (funzione IndexedDB pura, bypassa il router OneDrive)
      var fn = window.__origGetAll || (typeof getAll === 'function' ? getAll : null);
      const items = fn ? await fn(s) : [];
      // Conta solo item senza _source: 'onedrive' (item realmente locali)
      conteggi[s] = items.filter(function(x) { return x._source !== 'onedrive'; }).length;
    } catch (_) {
      conteggi[s] = 0;
    }
  }
  return conteggi;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. MODAL DI MIGRAZIONE
// ─────────────────────────────────────────────────────────────────────────────

function _mostraModalMigrazione(conteggi, totale) {
  const existing = document.getElementById('modal-migrazione-onedrive');
  if (existing) existing.remove();

  const nCantieri  = conteggi.projects || 0;
  const nNC        = conteggi.nc || 0;
  const nVerbali   = conteggi.verbali || 0;
  const nImprese   = conteggi.imprese || 0;
  const nLavoratori = conteggi.lavoratori || 0;

  const righe = [
    nCantieri  > 0 ? `<strong>${nCantieri}</strong> cantiere${nCantieri > 1 ? 'i' : ''}` : '',
    nNC        > 0 ? `<strong>${nNC}</strong> NC` : '',
    nVerbali   > 0 ? `<strong>${nVerbali}</strong> verbale${nVerbali > 1 ? 'i' : ''}` : '',
    nImprese   > 0 ? `<strong>${nImprese}</strong> impresa${nImprese > 1 ? 'e' : ''}` : '',
    nLavoratori > 0 ? `<strong>${nLavoratori}</strong> lavoratore${nLavoratori > 1 ? 'i' : ''}` : '',
  ].filter(Boolean).join(', ');

  const modal = document.createElement('div');
  modal.id        = 'modal-migrazione-onedrive';
  modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'migr-title');

  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">

      <div class="flex items-start gap-3">
        <div class="text-3xl shrink-0">📦</div>
        <div>
          <h2 id="migr-title" class="text-lg font-bold text-slate-800">Migrazione dati locali</h2>
          <p class="text-xs text-slate-500 mt-1">Trovati dati salvati localmente nel dispositivo.</p>
        </div>
      </div>

      <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        Hai ${righe} salvati localmente.<br>
        <span class="text-xs mt-1 block text-blue-700">
          Vuoi caricarli nella cartella condivisa OneDrive?
        </span>
      </div>

      <div class="text-xs text-slate-500 space-y-1">
        <p>• I dati già presenti in OneDrive non verranno sovrascritti (merge per ID)</p>
        <p>• La migrazione è <strong>reversibile</strong>: i dati rimangono anche in locale</p>
        <p>• Puoi migrare un cantiere alla volta con "Decidi per cantiere"</p>
      </div>

      <div class="flex flex-col gap-2">
        <button id="btn-migr-tutti"
                class="w-full bg-sky-600 text-white py-2.5 rounded-xl text-sm font-bold
                       hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-400">
          ☁️ Carica tutti
        </button>
        <button id="btn-migr-seleziona"
                class="w-full bg-slate-100 text-slate-700 py-2.5 rounded-xl text-sm font-semibold
                       hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400">
          ☑️ Decidi per cantiere
        </button>
        <button id="btn-migr-dopo"
                class="w-full text-slate-400 py-2 text-sm font-semibold
                       hover:text-slate-600 focus:outline-none">
          Non ora — continua senza migrare
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#btn-migr-tutti').addEventListener('click', async () => {
    modal.remove();
    await _migrazioneCompleta();
  });

  modal.querySelector('#btn-migr-seleziona').addEventListener('click', async () => {
    modal.remove();
    await _mostraModalSelezioneLotti();
  });

  modal.querySelector('#btn-migr-dopo').addEventListener('click', () => {
    modal.remove();
    showToast('Migrazione rinviata. Potrai farla in seguito dal pannello OneDrive.', 'info');
  });

  // Focus primo bottone
  setTimeout(function() { var b = modal.querySelector('#btn-migr-tutti'); if (b) b.focus(); }, 50);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. MIGRAZIONE COMPLETA (tutti i lotti)
// ─────────────────────────────────────────────────────────────────────────────

async function _migrazioneCompleta() {
  const toastId = _mostraProgressoMigrazione('Preparazione migrazione...');

  try {
    // Legge tutti i dati locali (bypassa il router)
    var fn = window.__origGetAll || getAll;
    const projects = (await fn('projects')).filter(function(x) { return x._source !== 'onedrive'; });

    let migrati = 0;
    let errori  = 0;

    // 1. Migra le imprese globali
    try {
      await _migraImprese(fn);
    } catch (e) {
      console.warn('[Migrazione] Errore imprese:', e.message);
      errori++;
    }

    // 2. Migra ogni cantiere
    for (const [i, project] of projects.entries()) {
      _aggiornaProgressoMigrazione(toastId, `Migrazione ${i + 1}/${projects.length}: ${project.nome || project.id}`);
      try {
        await _migraLotto(project, fn);
        migrati++;
      } catch (e) {
        console.warn(`[Migrazione] Errore lotto ${project.id}:`, e.message);
        errori++;
      }
    }

    _rimuoviProgressoMigrazione(toastId);

    const msg = errori > 0
      ? `Migrazione completata: ${migrati} cantieri migrati, ${errori} errori.`
      : `☁️ Migrazione completata: ${migrati} cantieri caricati su OneDrive ✓`;
    showToast(msg, errori > 0 ? 'warning' : 'success');

    // Aggiorna la griglia
    if (typeof refreshProjectsGrid === 'function') await refreshProjectsGrid();

  } catch (err) {
    _rimuoviProgressoMigrazione(toastId);
    console.error('[Migrazione] Errore critico:', err);
    showToast('Errore durante la migrazione: ' + err.message, 'error');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. MIGRAZIONE SINGOLO LOTTO
// ─────────────────────────────────────────────────────────────────────────────

async function _migraLotto(project, fn) {
  if (!project || !project.id) return;

  // Salva il cantiere nel registro OneDrive
  await aggiornaRegistroLotti({
    id:        project.id,
    nome:      project.nome || '',
    loc:       project.loc  || '',
    status:    project.status || 'ok',
    createdAt: project.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: await (typeof _getNomeTecnicoRouter === 'function' ? _getNomeTecnicoRouter() : Promise.resolve('Migrazione'))
  });

  // Crea struttura cartelle (non bloccante)
  if (typeof creaStrutturaLotto === 'function') {
    creaStrutturaLotto(project.id).catch(() => {});
  }

  // Leggi il lotto esistente in OneDrive (per merge)
  let lottoDaOneDrive;
  try {
    lottoDaOneDrive = await leggiLotto(project.id);
  } catch (_) {
    lottoDaOneDrive = null;
  }

  // Prepara il payload di merge
  const payload = {
    lottoId:          project.id,
    nc:               [],
    verbali:          [],
    imprese_cantieri: [],
    documenti:        [],
    foto_meta:        [],
    createdAt:        project.createdAt || new Date().toISOString(),
    updatedAt:        new Date().toISOString(),
    updatedBy:        'migrazione'
  };

  // Per ogni store del lotto: leggi locali e fai merge con quelli già in OneDrive
  for (const store of MIGRAZIONE_STORES_PROGETTO) {
    const locali = [];
    try {
      const tutti = await fn(store);
      locali.push(...tutti.filter(x => x.projectId === project.id && x._source !== 'onedrive'));
    } catch (_) { /* store vuoto o errore */ }

    const remoti = (lottoDaOneDrive && Array.isArray(lottoDaOneDrive[store]))
      ? lottoDaOneDrive[store]
      : [];

    // Merge: aggiungi solo item non già presenti per id
    const idRemoti = new Set(remoti.map(x => x.id));
    const nuovi    = locali.filter(x => !idRemoti.has(x.id));

    payload[store] = [...remoti, ...nuovi];

    if (typeof aggiungiAudit === 'function' && nuovi.length > 0) {
      await aggiungiAudit({
        azione:    'migrazione.merge',
        lotto:     project.id,
        dettaglio: `${nuovi.length} ${store} aggiunti`
      }).catch(() => {});
    }
  }

  await salvaLotto(project.id, payload, { forzato: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. MIGRAZIONE IMPRESE GLOBALI
// ─────────────────────────────────────────────────────────────────────────────

async function _migraImprese(fn) {
  const imprese    = (await fn('imprese')).filter(x => x._source !== 'onedrive');
  const lavoratori = (await fn('lavoratori')).filter(x => x._source !== 'onedrive');

  if (imprese.length === 0 && lavoratori.length === 0) return;

  // Leggi stato remoto
  const remoti     = await leggiImprese().catch(() => ({ imprese: [], lavoratori: [] }));
  const remImprese    = Array.isArray(remoti.imprese)    ? remoti.imprese    : [];
  const remLavoratori = Array.isArray(remoti.lavoratori) ? remoti.lavoratori : [];

  const idRemImp = new Set(remImprese.map(x => x.id));
  const idRemLav = new Set(remLavoratori.map(x => x.id));

  const nuoveImprese    = imprese.filter(x => !idRemImp.has(x.id));
  const nuoviLavoratori = lavoratori.filter(x => !idRemLav.has(x.id));

  if (nuoveImprese.length > 0 || nuoviLavoratori.length > 0) {
    await salvaImprese({
      imprese:    [...remImprese,    ...nuoveImprese],
      lavoratori: [...remLavoratori, ...nuoviLavoratori]
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. MODAL SELEZIONE CANTIERI (migrazione selettiva)
// ─────────────────────────────────────────────────────────────────────────────

async function _mostraModalSelezioneLotti() {
  var fn = window.__origGetAll || getAll;
  const projects = (await fn('projects')).filter(function(x) { return x._source !== 'onedrive'; });

  if (projects.length === 0) {
    showToast('Nessun cantiere locale da migrare.', 'info');
    return;
  }

  const existing = document.getElementById('modal-migr-selezione');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id        = 'modal-migr-selezione';
  modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  const righeCheckbox = projects.map(p => `
    <label class="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 cursor-pointer border border-slate-100">
      <input type="checkbox" value="${escapeHtml ? escapeHtml(p.id) : p.id}"
             class="migr-check w-4 h-4 rounded accent-sky-600"
             checked />
      <div>
        <div class="text-sm font-semibold text-slate-800">${escapeHtml ? escapeHtml(p.nome || p.id) : (p.nome || p.id)}</div>
        <div class="text-xs text-slate-400">${escapeHtml ? escapeHtml(p.id) : p.id}</div>
      </div>
    </label>
  `).join('');

  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 max-h-[80vh] flex flex-col">
      <h2 class="text-lg font-bold text-slate-800 shrink-0">☑️ Seleziona cantieri da migrare</h2>

      <div class="flex-1 overflow-y-auto space-y-2 pr-1">
        ${righeCheckbox}
      </div>

      <div class="flex gap-2 shrink-0 pt-2 border-t border-slate-100">
        <button id="btn-migr-sel-annulla"
                class="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-xl text-sm font-semibold
                       hover:bg-slate-200 focus:outline-none">
          Annulla
        </button>
        <button id="btn-migr-sel-conferma"
                class="flex-1 bg-sky-600 text-white py-2.5 rounded-xl text-sm font-bold
                       hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-400">
          ☁️ Migra selezionati
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#btn-migr-sel-annulla').addEventListener('click', () => modal.remove());

  modal.querySelector('#btn-migr-sel-conferma').addEventListener('click', async () => {
    const selezionati = Array.from(modal.querySelectorAll('.migr-check:checked')).map(cb => cb.value);
    modal.remove();

    if (selezionati.length === 0) {
      showToast('Nessun cantiere selezionato.', 'info');
      return;
    }

    const toastId = _mostraProgressoMigrazione('Migrazione in corso...');
    let migrati = 0;

    for (const id of selezionati) {
      const project = projects.find(p => p.id === id);
      if (!project) continue;
      try {
        await _migraLotto(project, fn);
        migrati++;
      } catch (e) {
        console.warn(`[Migrazione] Errore lotto ${id}:`, e.message);
      }
    }

    // Migra anche imprese globali se non già fatto
    await _migraImprese(fn).catch(() => {});

    _rimuoviProgressoMigrazione(toastId);
    showToast(`☁️ ${migrati} cantiere${migrati !== 1 ? 'i' : ''} migrato${migrati !== 1 ? 'i' : ''} su OneDrive ✓`, 'success');

    if (typeof refreshProjectsGrid === 'function') await refreshProjectsGrid();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. HELPER: PROGRESSO MIGRAZIONE (toast persistente)
// ─────────────────────────────────────────────────────────────────────────────

function _mostraProgressoMigrazione(messaggio) {
  const id    = 'toast-migrazione-' + Date.now();
  const toast = document.createElement('div');
  toast.id        = id;
  toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] ' +
                    'bg-slate-800 text-white text-xs font-medium px-4 py-3 rounded-2xl shadow-xl ' +
                    'flex items-center gap-2 max-w-xs w-[calc(100%-2rem)]';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.innerHTML = `
    <span class="animate-spin text-sm" aria-hidden="true">⏳</span>
    <span id="${id}-msg">${messaggio}</span>
  `;
  document.body.appendChild(toast);
  return id;
}

function _aggiornaProgressoMigrazione(id, messaggio) {
  const el = document.getElementById(`${id}-msg`);
  if (el) el.textContent = messaggio;
}

function _rimuoviProgressoMigrazione(id) {
  var el = document.getElementById(id);
  if (el) el.remove();
}
