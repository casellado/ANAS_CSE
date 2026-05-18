// lavoratori.js - Modulo Anagrafica Lavoratori (FASE 4.4)

let lavoratoreDaEliminare = null;
let _impreseCache = [];      // cache imprese per evitare I/O ripetuti
let _lavRendering = false;   // lock anti race-condition sui filtri
let _lavRenderPending = false; // segnala che arrivò una nuova richiesta durante il lock
// TODO ARCH: i campi base64 di formazione/visita/abilitazioni vanno spostati
//            in un Object Store IndexedDB dedicato (Blob) collegato per FK.
//            Finché sono inline nel record lavoratore, getByIndex() scarica
//            TUTTI i binari in RAM ad ogni render (rischio OOM su mobile).

// ─────────────────────────────────────────────
// HELPERS STATO DOCUMENTI
// ─────────────────────────────────────────────

function calcolaStatoDocumento(scadenza) {
  if (!scadenza) return { stato: 'mancante', label: '❓ mancante', color: 'text-slate-400' };
  
  const now = new Date();
  const scadData = new Date(scadenza);
  
  if (isNaN(scadData.getTime())) return { stato: 'mancante', label: '❓ mancante', color: 'text-slate-400' };
  
  now.setHours(0,0,0,0);
  scadData.setHours(0,0,0,0);
  
  const diffTime = scadData - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return { stato: 'scaduto', label: '🚨 scaduto', color: 'text-red-600 font-bold' };
  } else if (diffDays <= 30) {
    return { stato: 'in-scadenza', label: `⚠️ scade tra ${diffDays}gg`, color: 'text-orange-600 font-bold' };
  } else {
    return { stato: 'valido', label: `✅ valido (${scadData.toLocaleDateString('it-IT')})`, color: 'text-emerald-600' };
  }
}

function getPeggiorStatoGlobale(formazioneStato, visitaStato, patentiniStati) {
  const tuttiStati = [formazioneStato.stato, visitaStato.stato, ...patentiniStati.map(p => p.stato)];
  
  if (tuttiStati.includes('scaduto')) return 'Scaduti';
  if (tuttiStati.includes('in-scadenza')) return 'In scadenza';
  return 'Validi'; // Consideriamo validi anche se "mancanti" (se non richiesti)
}

// ─────────────────────────────────────────────
// RENDER LISTA LAVORATORI
// ─────────────────────────────────────────────

async function caricaFiltroImprese() {
  const projectId = sessionStorage.getItem('currentProjectId');
  const select = document.getElementById('filter-lav-impresa');
  if (!select) return;
  select.innerHTML = '<option value="Tutte">Tutte le imprese</option>';
  
  if (!projectId) return;
  
  try {
    const imprese = await getByIndex('imprese', 'projectId', projectId);
    _impreseCache = imprese; // popola cache condivisa
    imprese.sort((a,b) => (a.ragioneSociale || '').localeCompare(b.ragioneSociale || ''));

    imprese.forEach(imp => {
      select.innerHTML += `<option value="${imp.id}">${escapeHtml(imp.ragioneSociale)} [${imp.ruolo}]</option>`;
    });
  } catch(e) {
    console.error("Errore caricamento imprese per filtro:", e);
  }
}

async function renderLavoratori() {
  // Lock: se già in esecuzione, segna la richiesta come pendente ed esci
  if (_lavRendering) { _lavRenderPending = true; return; }
  _lavRendering = true;
  _lavRenderPending = false;

  const projectId = sessionStorage.getItem('currentProjectId');
  if (!projectId) { _lavRendering = false; return; }

  const filterImpresaEl = document.getElementById('filter-lav-impresa');
  const filterDocsEl = document.getElementById('filter-lav-docs');
  if (!filterImpresaEl || !filterDocsEl) { _lavRendering = false; return; }

  // Leggo i filtri DOPO aver acquisito il lock — sempre aggiornati
  const filterImpresa = filterImpresaEl.value;
  const filterDocs = filterDocsEl.value;

  const grid = document.getElementById('lavoratori-grid');
  if (!grid) { _lavRendering = false; return; }
  grid.innerHTML = '<div class="col-span-full text-center py-8 text-slate-400">Caricamento lavoratori...</div>';

  try {
    const allLavoratori = await getByIndex('lavoratori', 'projectId', projectId);

    // Usa la cache delle imprese; ricarica solo se vuota
    const impreseStore = _impreseCache.length
      ? _impreseCache
      : await getByIndex('imprese', 'projectId', projectId);
    const mapImprese = {};
    impreseStore.forEach(imp => mapImprese[imp.id] = imp);

    // Filtro per impresa
    let filtered = allLavoratori;
    if (filterImpresa !== 'Tutte') {
      filtered = filtered.filter(l => l.impresaId === filterImpresa);
    }

    const lavoratoriElaborati = filtered.map(lav => {
      const formazioneStato = calcolaStatoDocumento(lav.attestatoFormazione?.scadenza);
      const visitaStato = calcolaStatoDocumento(lav.visitaMedica?.scadenza);
      const patentiniStati = (lav.abilitazioni || []).map(p => calcolaStatoDocumento(p.scadenza));
      
      const statoGlobale = getPeggiorStatoGlobale(formazioneStato, visitaStato, patentiniStati);
      
      return { lav, formazioneStato, visitaStato, patentiniStati, statoGlobale };
    });

    // Filtro per stato documenti
    let finalFiltered = lavoratoriElaborati;
    if (filterDocs !== 'Tutti') {
      finalFiltered = lavoratoriElaborati.filter(item => item.statoGlobale === filterDocs);
    }

    // Ordinamento alfabetico
    finalFiltered.sort((a, b) => {
      const cA = (a.lav.cognome || '').toLowerCase();
      const cB = (b.lav.cognome || '').toLowerCase();
      if (cA !== cB) return cA.localeCompare(cB);
      return (a.lav.nome || '').toLowerCase().localeCompare((b.lav.nome || '').toLowerCase());
    });

    if (finalFiltered.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full bg-white rounded-xl shadow-sm p-8 text-center border border-slate-200">
          <div class="text-4xl mb-4">👷</div>
          <h3 class="text-lg font-bold text-slate-700">Nessun lavoratore trovato</h3>
          <p class="text-sm text-slate-500">Aggiungi il primo lavoratore cliccando su "Nuovo Lavoratore".</p>
        </div>
      `;
      // Se le imprese sono vuote, ricarica il select per sicurezza al primo render
      if (filterImpresaEl.options.length <= 1) {
        await caricaFiltroImprese();
      }
      return;
    }

    // Se le imprese non sono state caricate nel filtro
    if (filterImpresaEl.options.length <= 1) {
      await caricaFiltroImprese();
    }

    grid.innerHTML = '';
    const fragment = document.createDocumentFragment();

    for (const item of finalFiltered) {
      const l = item.lav;
      const impresa = mapImprese[l.impresaId] || { ragioneSociale: 'Impresa sconosciuta', ruolo: '?' };
      
      const card = document.createElement('div');
      card.className = "bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col hover:shadow-md transition overflow-hidden";
      
      const countPat = (l.abilitazioni || []).length;
      let patentiniHtml = `<div class="flex items-start gap-2 mt-2 pt-2 border-t border-slate-100">
        <span class="w-5 text-center shrink-0">🔧</span>
        <span class="text-xs text-slate-500">${countPat > 0 ? `${countPat} abilitazioni registrate` : 'Nessuna abilitazione'}</span>
      </div>`;

      card.innerHTML = `
        <div class="p-4 border-b border-slate-100 bg-slate-50/50 relative">
          <div class="text-[10px] font-bold text-slate-500 mb-1">${escapeHtml(l.codiceFiscale)}</div>
          <h4 class="font-bold text-slate-800 text-lg leading-tight line-clamp-1" title="${escapeHtml(l.nome)} ${escapeHtml(l.cognome)}">
            ${escapeHtml(l.nome)} ${escapeHtml(l.cognome)}
          </h4>
          <div class="text-xs text-slate-500 mt-1 font-medium">${escapeHtml(l.mansione)}</div>
        </div>
        <div class="p-4 flex-1 space-y-2 text-sm text-slate-600">
          <div class="flex items-start gap-2 mb-3">
            <span class="w-5 text-center shrink-0 mt-0.5">🏢</span>
            <div class="leading-tight">
              <span class="font-bold text-slate-700 block">${escapeHtml(impresa.ragioneSociale)}</span>
              <span class="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded uppercase font-semibold">${impresa.ruolo}</span>
            </div>
          </div>
          
          <div class="flex items-start gap-2">
            <span class="w-5 text-center shrink-0">📋</span>
            <div class="flex-1">
              <span class="font-semibold block text-xs uppercase text-slate-400">Formazione</span>
              <span class="${item.formazioneStato.color}">${item.formazioneStato.label}</span>
            </div>
          </div>
          
          <div class="flex items-start gap-2">
            <span class="w-5 text-center shrink-0">🏥</span>
            <div class="flex-1">
              <span class="font-semibold block text-xs uppercase text-slate-400">Visita Medica</span>
              <span class="${item.visitaStato.color}">${item.visitaStato.label}</span>
            </div>
          </div>
          
          ${patentiniHtml}
          
          <!-- Foto e Info Extra -->
          <div class="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
            <div class="flex -space-x-2">
              ${(l.foto || []).slice(0, 3).map(f => `<img src="${f.base64}" class="w-8 h-8 rounded-full border-2 border-white object-cover shadow-sm" alt="Foto">`).join('')}
              ${(l.foto || []).length > 3 ? `<div class="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 shadow-sm">+${l.foto.length - 3}</div>` : ''}
              ${(l.foto || []).length === 0 ? `<span class="text-[10px] text-slate-400 italic">Nessuna foto</span>` : ''}
            </div>
            <div class="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-tighter">
              ID: ${l.id.substring(0, 8)}
            </div>
          </div>
        </div>
        <div class="p-3 border-t border-slate-100 bg-slate-50 flex gap-2 shrink-0">
          <button onclick="apriModalLavoratore('${l.id}')" class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition">
            <span>📝</span> Modifica
          </button>
          <button onclick="confermaEliminaLavoratore('${l.id}', '${escapeHtml((l.nome + ' ' + l.cognome).replace(/'/g, "\\'"))}')" class="flex items-center justify-center px-3 py-1.5 text-sm font-semibold text-red-600 bg-white border border-red-200 rounded hover:bg-red-50 hover:border-red-300 transition">
            <span>🗑️</span>
          </button>
        </div>
      `;
      fragment.appendChild(card);
    }
    grid.appendChild(fragment);
  } catch (err) {
    console.error("Errore render Lavoratori:", err);
    grid.innerHTML = '<div class="col-span-full text-center text-red-500">Errore nel caricamento dei dati.</div>';
  } finally {
    _lavRendering = false;
    // Se è arrivata una nuova richiesta mentre eravamo bloccati, esegui un ultimo render
    if (_lavRenderPending) { _lavRenderPending = false; renderLavoratori(); }
  }
}

// ─────────────────────────────────────────────
// MODAL & FORM CREAZIONE/MODIFICA
// ─────────────────────────────────────────────

async function apriModalLavoratore(id = null) {
  const projectId = sessionStorage.getItem('currentProjectId');
  if (!projectId) return;

  const form = document.getElementById('form-lavoratore');
  if (!form) return;
  form.reset();
  document.getElementById('lavoratore-id').value = '';
  document.getElementById('modal-lavoratore-title').textContent = id ? 'Modifica Lavoratore' : 'Nuovo Lavoratore';
  document.getElementById('lavoratore-cambio-impresa-warn').classList.add('page-hidden');
  
  // Svuota righe abilitazioni
  document.getElementById('lav-abilitazioni-container').innerHTML = '';

  // Popola dropdown imprese dalla cache (evita fetch ridondante)
  const selectImpresa = document.getElementById('lavoratore-impresa');
  selectImpresa.innerHTML = '<option value="">-- Seleziona impresa --</option>';
  try {
    const imprese = _impreseCache.length
      ? _impreseCache
      : await getByIndex('imprese', 'projectId', projectId);
    const imprOrdiniate = [...imprese].sort((a,b) => (a.ragioneSociale || '').localeCompare(b.ragioneSociale || ''));
    imprOrdiniate.forEach(imp => {
      selectImpresa.innerHTML += `<option value="${imp.id}">${escapeHtml(imp.ragioneSociale)} [${imp.ruolo}]</option>`;
    });
  } catch (e) {
    console.error("Errore caricamento imprese modale", e);
  }

  if (id) {
    // Gestione alert al cambio impresa
    selectImpresa.onchange = (e) => {
      document.getElementById('lavoratore-cambio-impresa-warn').classList.remove('page-hidden');
    };
    
    try {
      const lav = await getItem('lavoratori', id);
      if (lav) {
        document.getElementById('lavoratore-id').value = lav.id;
        document.getElementById('lavoratore-impresa').value = lav.impresaId || '';
        document.getElementById('lavoratore-nome').value = lav.nome || '';
        document.getElementById('lavoratore-cognome').value = lav.cognome || '';
        document.getElementById('lavoratore-cf').value = lav.codiceFiscale || '';
        document.getElementById('lavoratore-mansione').value = lav.mansione || '';
        document.getElementById('lavoratore-data-nascita').value = lav.dataNascita || '';
        document.getElementById('lavoratore-luogo-nascita').value = lav.luogoNascita || '';
        document.getElementById('lavoratore-telefono').value = lav.telefono || '';
        document.getElementById('lavoratore-email').value = lav.email || '';
        
        // Formazione
        if (lav.attestatoFormazione) {
          document.getElementById('lav-formazione-num').value = lav.attestatoFormazione.numero || '';
          document.getElementById('lav-formazione-scad').value = lav.attestatoFormazione.scadenza || '';
        }
        
        // Visita
        if (lav.visitaMedica) {
          document.getElementById('lav-visita-ente').value = lav.visitaMedica.ente || '';
          document.getElementById('lav-visita-data').value = lav.visitaMedica.data || '';
          document.getElementById('lav-visita-scad').value = lav.visitaMedica.scadenza || '';
          if (lav.visitaMedica.base64) {
            impostaStatoFileLavoratore('btn-upload-visita', lav.visitaMedica.filename);
            document.getElementById('lav-visita-base64').value = lav.visitaMedica.base64;
            document.getElementById('lav-visita-filename').value = lav.visitaMedica.filename;
          }
        }

        if (lav.attestatoFormazione && lav.attestatoFormazione.base64) {
          impostaStatoFileLavoratore('btn-upload-formazione', lav.attestatoFormazione.filename);
          document.getElementById('lav-formazione-base64').value = lav.attestatoFormazione.base64;
          document.getElementById('lav-formazione-filename').value = lav.attestatoFormazione.filename;
        }
        
        // Abilitazioni
        if (lav.abilitazioni && lav.abilitazioni.length > 0) {
          lav.abilitazioni.forEach(ab => {
            aggiungiRigaAbilitazioneLav(ab);
          });
        }

        // Foto
        const fotoCountEl = document.getElementById('lavoratore-foto-count');
        if (fotoCountEl) {
          const count = (lav.foto || []).length;
          fotoCountEl.textContent = count > 0 ? `${count} foto caricate.` : 'Nessuna foto caricata.';
        }
      }
    } catch (e) {
      console.error(e);
      alert("Impossibile caricare i dati");
      return;
    }
  } else {
    selectImpresa.onchange = null;
  }

  const modal = document.getElementById('modal-lavoratore');
  modal.classList.remove('page-hidden');
  setTimeout(() => modal.classList.remove('opacity-0'), 10);
}

function chiudiModalLavoratore() {
  const modal = document.getElementById('modal-lavoratore');
  modal.classList.add('opacity-0');
  setTimeout(() => modal.classList.add('page-hidden'), 300);
}

// ─────────────────────────────────────────────
// ABILITAZIONI DINAMICHE
// ─────────────────────────────────────────────

function aggiungiRigaAbilitazioneLav(data = null) {
  const container = document.getElementById('lav-abilitazioni-container');
  const idRiga = 'ab_' + Date.now() + Math.random().toString(36).substr(2,5);
  
  const div = document.createElement('div');
  div.className = 'bg-white border border-slate-200 p-3 rounded shadow-sm relative group lav-abilitazione-row';
  div.id = idRiga;
  
  const optionsHtml = typeof getOpzioniTipologieMezziHtml === 'function' ? getOpzioniTipologieMezziHtml() : '';
  
  div.innerHTML = `
    <button type="button" onclick="document.getElementById('${idRiga}').remove()" class="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full w-6 h-6 flex items-center justify-center font-bold text-xs shadow hover:bg-red-600 hover:text-white transition opacity-0 group-hover:opacity-100">&times;</button>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      <div class="lg:col-span-2">
        <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Tipologia Mezzo *</label>
        <select class="lav-ab-tipo w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white" required>
          ${optionsHtml}
        </select>
      </div>
      <div>
        <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Scadenza *</label>
        <input type="date" class="lav-ab-scad w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white" required>
      </div>
      <div class="flex items-end">
        <input type="file" class="hidden" onchange="gestisciUploadFileLav(this)">
        <button type="button" class="btn-file-lav w-full ${data && data.base64 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-600 border-slate-300'} px-2 py-1.5 rounded text-xs border" onclick="this.previousElementSibling.click()">
          ${data && data.base64 ? '✅ File' : '📎 PDF'}
        </button>
        <input type="hidden" class="lav-ab-base64" value="${data && data.base64 ? data.base64 : ''}">
        <input type="hidden" class="lav-ab-filename" value="${escapeHtml(data && data.filename ? data.filename : '')}">
      </div>
      <div>
        <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">N. Patentino</label>
        <input type="text" class="lav-ab-num w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white" placeholder="Opz.">
      </div>
      <div>
        <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Ente Rilascio</label>
        <input type="text" class="lav-ab-ente w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white" placeholder="Es. INAIL">
      </div>
    </div>
  `;
  
  container.appendChild(div);
  
  if (data) {
    div.querySelector('.lav-ab-tipo').value = data.tipologiaMezzo || '';
    div.querySelector('.lav-ab-scad').value = data.scadenza || '';
    div.querySelector('.lav-ab-num').value = data.numero || '';
    div.querySelector('.lav-ab-ente').value = data.ente || '';
  }
}

function raccogliAbilitazioni() {
  const container = document.getElementById('lav-abilitazioni-container');
  const righe = container.querySelectorAll('.lav-abilitazione-row');
  const abil = [];
  
  righe.forEach(r => {
    abil.push({
      tipologiaMezzo: r.querySelector('.lav-ab-tipo').value,
      scadenza: r.querySelector('.lav-ab-scad').value,
      numero: r.querySelector('.lav-ab-num').value.trim(),
      ente: r.querySelector('.lav-ab-ente').value.trim(),
      base64: r.querySelector('.lav-ab-base64').value,
      filename: r.querySelector('.lav-ab-filename').value
    });
  });
  
  return abil;
}

// ─────────────────────────────────────────────
// SALVATAGGIO
// ─────────────────────────────────────────────

async function salvaLavoratore(e) {
  e.preventDefault();
  const form = document.getElementById('form-lavoratore');
  if (!form || !form.checkValidity()) {
    if (form) form.reportValidity();
    return;
  }

  const projectId = sessionStorage.getItem('currentProjectId');
  if (!projectId) return;

  const id = document.getElementById('lavoratore-id').value;
  
  // Costruisco l'oggetto rispettando rigorosamente lo schema
  const lavData = {
    id: id || 'lav_' + Date.now(),
    projectId: projectId,
    impresaId: document.getElementById('lavoratore-impresa').value,
    nome: document.getElementById('lavoratore-nome').value.trim(),
    cognome: document.getElementById('lavoratore-cognome').value.trim(),
    codiceFiscale: document.getElementById('lavoratore-cf').value.trim().toUpperCase(),
    mansione: document.getElementById('lavoratore-mansione').value.trim(),
    
    dataNascita: document.getElementById('lavoratore-data-nascita').value,
    luogoNascita: document.getElementById('lavoratore-luogo-nascita').value.trim(),
    telefono: document.getElementById('lavoratore-telefono').value.trim(),
    email: document.getElementById('lavoratore-email').value.trim(),

    attestatoFormazione: {
      numero: document.getElementById('lav-formazione-num').value.trim(),
      scadenza: document.getElementById('lav-formazione-scad').value,
      base64: document.getElementById('lav-formazione-base64').value,
      filename: document.getElementById('lav-formazione-filename').value
    },
    
    visitaMedica: {
      ente: document.getElementById('lav-visita-ente').value.trim(),
      data: document.getElementById('lav-visita-data').value,
      scadenza: document.getElementById('lav-visita-scad').value,
      base64: document.getElementById('lav-visita-base64').value,
      filename: document.getElementById('lav-visita-filename').value
    },
    
    abilitazioni: raccogliAbilitazioni(),
    foto: id ? (await getItem('lavoratori', id))?.foto || [] : [],
    
    modifiedAt: new Date().toISOString(),
    modifiedBy: 'Utente' // FASE 8
  };

  try {
    await saveItem('lavoratori', lavData);
    chiudiModalLavoratore();
    renderLavoratori();
  } catch (err) {
    console.error("Errore salvataggio lavoratore", err);
    alert("Impossibile salvare i dati");
  }
}

// ─────────────────────────────────────────────
// ELIMINAZIONE
// ─────────────────────────────────────────────

function confermaEliminaLavoratore(id, nome) {
  lavoratoreDaEliminare = id;
  document.getElementById('elimina-lavoratore-nome').textContent = nome;
  
  const modal = document.getElementById('modal-elimina-lavoratore');
  modal.classList.remove('page-hidden');
  setTimeout(() => modal.classList.remove('opacity-0'), 10);
}

function chiudiModalEliminaLavoratore() {
  lavoratoreDaEliminare = null;
  const modal = document.getElementById('modal-elimina-lavoratore');
  modal.classList.add('opacity-0');
  setTimeout(() => modal.classList.add('page-hidden'), 300);
}

async function eseguiEliminaLavoratore() {
  if (!lavoratoreDaEliminare) return;
  
  try {
    const lavId = lavoratoreDaEliminare;
    
    // Elimino prima il lavoratore
    await deleteItem('lavoratori', lavId);
    
    // Cascade su store 'documenti' correlati a questo lavoratore
    try {
      // Ottimizzato: uso l'indice invece di getAll()
      const docsLavoratore = await getByIndex('documenti', 'entitaCollegataId', lavId);
      for (const doc of docsLavoratore) {
        await deleteItem('documenti', doc.id);
      }
    } catch (e) {
      console.warn("Errore in cascade documenti:", e);
    }
    
    chiudiModalEliminaLavoratore();
    renderLavoratori();
    
    if (typeof showToast === 'function') {
      showToast("Lavoratore eliminato con successo", "success");
    } else {
      alert("Lavoratore eliminato");
    }
    
  } catch (err) {
    console.error("Errore eliminazione lavoratore:", err);
    alert("Errore durante l'eliminazione.");
  }
}

/** Utility per caricare stato file da UI */
function impostaStatoFileLavoratore(btnId, filename) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.innerHTML = '✅ ' + (filename ? filename.substring(0, 10) + '...' : 'File');
  btn.classList.remove('bg-slate-200', 'text-slate-700', 'bg-slate-100', 'text-slate-600');
  btn.classList.add('bg-green-50', 'text-green-700', 'border-green-200');
}

/** Gestione Upload generica per Lavoratore */
async function gestisciUploadFileLav(input, targetIdPrefix = null) {
  const file = input.files[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    alert("File troppo grande (max 2MB)");
    input.value = '';
    return;
  }

  try {
    const base64 = await convertiInBase64(file);
    if (targetIdPrefix) {
      document.getElementById(targetIdPrefix + '-base64').value = base64;
      document.getElementById(targetIdPrefix + '-filename').value = file.name;
      impostaStatoFileLavoratore('btn-upload-' + targetIdPrefix.split('-')[1], file.name);
    } else {
      const riga = input.closest('div');
      const btn = riga.querySelector('.btn-file-lav');
      const hBase64 = riga.querySelector('.lav-ab-base64');
      const hFilename = riga.querySelector('.lav-ab-filename');
      
      if (hBase64) hBase64.value = base64;
      if (hFilename) hFilename.value = file.name;
      if (btn) {
        btn.innerHTML = '✅ ' + file.name.substring(0, 10) + '...';
        btn.classList.remove('bg-slate-100', 'text-slate-600');
        btn.classList.add('bg-green-50', 'text-green-700', 'border-green-200');
      }
    }
  } catch (err) {
    console.error("Errore upload lavoratore:", err);
  }
}

function convertiInBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

// ─────────────────────────────────────────────
// RENDER VIEW — scaffold completo + modali
// ─────────────────────────────────────────────

async function renderViewLavoratori(container) {
  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex justify-between items-center">
        <div>
          <h2 class="text-3xl font-bold text-slate-900">Lavoratori</h2>
          <p class="text-slate-500 text-sm mt-1">Maestranze operanti nel cantiere</p>
        </div>
        <button onclick="apriModalLavoratore()" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl shadow transition">+ Nuovo Lavoratore</button>
      </div>
      <div class="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap gap-4 items-center">
        <div class="flex items-center gap-2">
          <label class="text-xs font-bold text-slate-500 uppercase tracking-wide">Impresa:</label>
          <select id="filter-lav-impresa" onchange="renderLavoratori()" class="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-white min-w-[180px]">
            <option value="Tutte">Tutte le imprese</option>
          </select>
        </div>
        <div class="flex items-center gap-2">
          <label class="text-xs font-bold text-slate-500 uppercase tracking-wide">Documenti:</label>
          <select id="filter-lav-docs" onchange="renderLavoratori()" class="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-white">
            <option value="Tutti">Tutti</option>
            <option value="Scaduti">Con scaduti</option>
            <option value="In scadenza">In scadenza</option>
            <option value="Validi">Tutti validi</option>
          </select>
        </div>
      </div>
      <div id="lavoratori-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"></div>
    </div>

    <!-- MODAL Nuovo/Modifica Lavoratore -->
    <div id="modal-lavoratore" class="page-hidden opacity-0 fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[2000] flex items-start justify-center p-4 pt-6 transition-opacity duration-300">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div class="p-5 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white z-10">
          <h3 id="modal-lavoratore-title" class="text-xl font-bold text-slate-800">Nuovo Lavoratore</h3>
          <button onclick="chiudiModalLavoratore()" class="text-slate-400 hover:text-slate-800 text-2xl leading-none">&times;</button>
        </div>
        <form id="form-lavoratore" class="p-6 space-y-5">
          <input type="hidden" id="lavoratore-id">

          <div id="lavoratore-cambio-impresa-warn" class="page-hidden bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs text-orange-700">
            ⚠️ Stai cambiando l'impresa di appartenenza di questo lavoratore.
          </div>

          <!-- Impresa -->
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Impresa *</label>
            <select id="lavoratore-impresa" required class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-white">
              <option value="">-- Seleziona impresa --</option>
            </select>
          </div>

          <!-- Dati anagrafici -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Nome *</label>
              <input type="text" id="lavoratore-nome" required class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Cognome *</label>
              <input type="text" id="lavoratore-cognome" required class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Codice Fiscale *</label>
              <input type="text" id="lavoratore-cf" required maxlength="16" class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-mono uppercase outline-none focus:ring-2 focus:ring-blue-400">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Mansione *</label>
              <input type="text" id="lavoratore-mansione" required class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400" placeholder="Es. Operaio specializzato">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Data di Nascita</label>
              <input type="date" id="lavoratore-data-nascita" class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Luogo di Nascita</label>
              <input type="text" id="lavoratore-luogo-nascita" class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Telefono</label>
              <input type="tel" id="lavoratore-telefono" class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Email</label>
              <input type="email" id="lavoratore-email" class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">
            </div>
          </div>

          <!-- Attestato Formazione -->
          <div class="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <h4 class="text-xs font-bold text-slate-600 uppercase tracking-wide">📋 Attestato Formazione</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">N. Attestato</label>
                <input type="text" id="lav-formazione-num" class="w-full border border-slate-300 rounded px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-white">
              </div>
              <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Scadenza</label>
                <input type="date" id="lav-formazione-scad" class="w-full border border-slate-300 rounded px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-white">
              </div>
            </div>
            <div class="flex items-center gap-2">
              <input type="file" class="hidden" id="input-file-formazione" accept=".pdf,.jpg,.png" onchange="gestisciUploadFileLav(this, 'lav-formazione')">
              <button type="button" id="btn-upload-formazione" onclick="document.getElementById('input-file-formazione').click()"
                      class="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition border border-slate-300">
                📎 Allega PDF
              </button>
              <input type="hidden" id="lav-formazione-base64">
              <input type="hidden" id="lav-formazione-filename">
            </div>
          </div>

          <!-- Visita Medica -->
          <div class="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <h4 class="text-xs font-bold text-slate-600 uppercase tracking-wide">🏥 Visita Medica</h4>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ente Sanitario</label>
                <input type="text" id="lav-visita-ente" class="w-full border border-slate-300 rounded px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-white" placeholder="Es. Medico Competente">
              </div>
              <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data Visita</label>
                <input type="date" id="lav-visita-data" class="w-full border border-slate-300 rounded px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-white">
              </div>
              <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Scadenza</label>
                <input type="date" id="lav-visita-scad" class="w-full border border-slate-300 rounded px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-white">
              </div>
            </div>
            <div class="flex items-center gap-2">
              <input type="file" class="hidden" id="input-file-visita" accept=".pdf,.jpg,.png" onchange="gestisciUploadFileLav(this, 'lav-visita')">
              <button type="button" id="btn-upload-visita" onclick="document.getElementById('input-file-visita').click()"
                      class="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition border border-slate-300">
                📎 Allega PDF
              </button>
              <input type="hidden" id="lav-visita-base64">
              <input type="hidden" id="lav-visita-filename">
            </div>
          </div>

          <!-- Abilitazioni (Patentini) -->
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <h4 class="text-xs font-bold text-slate-600 uppercase tracking-wide">🔧 Abilitazioni / Patentini</h4>
              <button type="button" onclick="aggiungiRigaAbilitazioneLav()" class="text-xs text-blue-600 font-bold hover:underline">+ Aggiungi</button>
            </div>
            <div id="lav-abilitazioni-container" class="space-y-2"></div>
          </div>

          <!-- Foto -->
          <div class="text-xs text-slate-400 italic" id="lavoratore-foto-count">Nessuna foto caricata.</div>

          <div class="flex gap-3 pt-3 border-t border-slate-100">
            <button type="button" onclick="chiudiModalLavoratore()" class="flex-1 py-2.5 rounded-xl font-bold text-slate-500 border border-slate-200 hover:bg-slate-50 transition">Annulla</button>
            <button type="submit" class="flex-1 py-2.5 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 transition shadow">Salva Lavoratore</button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL Elimina Lavoratore -->
    <div id="modal-elimina-lavoratore" class="page-hidden opacity-0 fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[2100] flex items-center justify-center p-4 transition-opacity duration-300">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h3 class="text-lg font-bold text-slate-800">Elimina Lavoratore</h3>
        <p class="text-sm text-slate-600">Stai per eliminare: <strong id="elimina-lavoratore-nome"></strong></p>
        <div class="flex gap-3 pt-2">
          <button onclick="chiudiModalEliminaLavoratore()" class="flex-1 py-2.5 rounded-xl font-bold text-slate-500 border border-slate-200 hover:bg-slate-50">Annulla</button>
          <button onclick="eseguiEliminaLavoratore()" class="flex-1 py-2.5 rounded-xl font-bold bg-red-600 text-white hover:bg-red-700 shadow">Elimina</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('form-lavoratore').addEventListener('submit', salvaLavoratore);

  await caricaFiltroImprese();
  await renderLavoratori();
}

window.LavoratoriModulo = { render: renderViewLavoratori };
