// imprese.js - Modulo Anagrafica Imprese (FASE 4.1)

let currentFiltroRuolo = 'Tutte';
let impresaDaEliminare = null;

// ─────────────────────────────────────────────
// RENDER LISTA IMPRESE
// ─────────────────────────────────────────────

async function renderImprese(filtroRuolo = currentFiltroRuolo) {
  currentFiltroRuolo = filtroRuolo;
  const projectId = sessionStorage.getItem('currentProjectId');
  if (!projectId) return;

  // Aggiorna UI filtri
  document.querySelectorAll('.filter-btn-impresa').forEach(btn => {
    btn.classList.remove('active', 'bg-slate-800', 'text-white');
    btn.classList.add('bg-white', 'text-slate-600');
  });
  const btnActive = document.querySelector(`.filter-${filtroRuolo}`);
  if (btnActive) {
    btnActive.classList.remove('bg-white', 'text-slate-600');
    btnActive.classList.add('active', 'bg-slate-800', 'text-white');
  }

  const grid = document.getElementById('imprese-grid');
  grid.innerHTML = '<div class="col-span-full text-center py-8 text-slate-400">Caricamento imprese...</div>';

  try {
    const allImprese = await getByIndex('imprese', 'projectId', projectId);
    
    // Filtro per ruolo
    let filtered = allImprese;
    if (filtroRuolo !== 'Tutte') {
      filtered = allImprese.filter(i => i.ruolo === filtroRuolo);
    }

    // Sort alfabetico
    filtered.sort((a, b) => (a.ragioneSociale || '').localeCompare(b.ragioneSociale || ''));

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full bg-white rounded-xl shadow-sm p-8 text-center border border-slate-200">
          <div class="text-4xl mb-4">🏢</div>
          <h3 class="text-lg font-bold text-slate-700">Nessuna impresa trovata</h3>
          <p class="text-sm text-slate-500">Aggiungi la prima impresa cliccando su "Nuova Impresa".</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = '';
    
    for (const impresa of filtered) {
      // Mappa per nome subappaltatrice
      let nomeSub = '';
      if (impresa.ruolo === 'SUBAPPALTO' && impresa.subAppaltoDi) {
        const sub = allImprese.find(i => i.id === impresa.subAppaltoDi);
        nomeSub = sub ? sub.ragioneSociale : 'Non trovata';
      }

      // Analizza Documenti per Badge
      const docBadgeHtml = generaBadgeDocumentiHtml(impresa.documenti || []);

      const card = document.createElement('div');
      card.className = "bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col hover:shadow-md transition overflow-hidden";
      
      card.innerHTML = `
        <div class="p-4 border-b border-slate-100 flex justify-between items-start gap-2 bg-slate-50/50">
          <div>
            <div class="text-[10px] font-bold px-2 py-0.5 rounded-md mb-2 inline-block uppercase tracking-wider
              ${impresa.ruolo === 'AFFIDATARIA' ? 'bg-blue-100 text-blue-800' : 
                impresa.ruolo === 'ESECUTRICE' ? 'bg-indigo-100 text-indigo-800' :
                impresa.ruolo === 'SUBAPPALTO' ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-200 text-slate-800'}">
              ${impresa.ruolo}
            </div>
            <h4 class="font-bold text-slate-800 text-lg leading-tight line-clamp-2" title="${escapeHtml(impresa.ragioneSociale)}">
              ${escapeHtml(impresa.ragioneSociale)}
            </h4>
          </div>
        </div>
        <div class="p-4 flex-1 space-y-2 text-sm text-slate-600">
          <div class="flex items-start gap-2">
            <span class="w-5 text-center shrink-0">📄</span>
            <span class="truncate"><strong>P.IVA:</strong> ${escapeHtml(impresa.partitaIva)}</span>
          </div>
          ${impresa.ruolo === 'SUBAPPALTO' ? `
            <div class="flex items-start gap-2">
              <span class="w-5 text-center shrink-0">🔗</span>
              <span class="truncate" title="Sub. di: ${escapeHtml(nomeSub)}"><strong>Sub. di:</strong> ${escapeHtml(nomeSub)}</span>
            </div>
          ` : ''}
          <div class="flex items-start gap-2 mt-3 pt-3 border-t border-slate-100">
            ${docBadgeHtml}
          </div>
        </div>
        <div class="p-3 border-t border-slate-100 bg-slate-50 flex gap-2 shrink-0">
          <button onclick="apriModalImpresa('${impresa.id}')" class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition">
            <span>📝</span> Modifica
          </button>
          <button onclick="confermaEliminaImpresa('${impresa.id}', '${escapeHtml((impresa.ragioneSociale||'').replace(/'/g, "\\'"))}')" class="flex items-center justify-center px-3 py-1.5 text-sm font-semibold text-red-600 bg-white border border-red-200 rounded hover:bg-red-50 hover:border-red-300 transition">
            <span>🗑️</span>
          </button>
        </div>
      `;
      grid.appendChild(card);
    }
  } catch (err) {
    console.error("Errore render imprese:", err);
    grid.innerHTML = '<div class="col-span-full text-center text-red-500">Errore nel caricamento delle imprese.</div>';
  }
}

function generaBadgeDocumentiHtml(documenti) {
  if (!documenti || documenti.length === 0) {
    return `<span class="w-5 text-center shrink-0">❓</span> <span class="text-slate-400">Nessun documento inserito</span>`;
  }
  
  // Trova il DURC se c'è
  const durc = documenti.find(d => d.tipo === 'DURC');
  if (!durc || !durc.scadenza) {
    return `<span class="w-5 text-center shrink-0">❓</span> <span class="text-slate-400">DURC mancante</span>`;
  }

  const scadenza = new Date(durc.scadenza);
  const oggi = new Date();
  const diffTime = scadenza - oggi;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return `<span class="w-5 text-center shrink-0">🚨</span> <span class="text-red-600 font-bold">DURC Scaduto</span>`;
  } else if (diffDays <= 30) {
    return `<span class="w-5 text-center shrink-0">⚠️</span> <span class="text-orange-600 font-bold">DURC Scade tra ${diffDays} gg</span>`;
  } else {
    return `<span class="w-5 text-center shrink-0">✅</span> <span class="text-green-600 font-semibold">DURC Valido</span>`;
  }
}

// ─────────────────────────────────────────────
// MODAL & FORM CREAZIONE/MODIFICA
// ─────────────────────────────────────────────

async function apriModalImpresa(id = null) {
  const projectId = sessionStorage.getItem('currentProjectId');
  if (!projectId) return;

  const form = document.getElementById('form-impresa');
  form.reset();
  document.getElementById('impresa-id').value = '';
  document.getElementById('impresa-docs-container').innerHTML = '';
  document.getElementById('modal-impresa-title').textContent = id ? 'Modifica Impresa' : 'Nuova Impresa';
  document.getElementById('impresa-subappalto-di').disabled = false;
  document.getElementById('msg-subappalto-locked').classList.add('page-hidden');

  // Popola Dropdown Affidatarie/Esecutrici
  const selectSub = document.getElementById('impresa-subappalto-di');
  selectSub.innerHTML = '<option value="">-- Seleziona impresa --</option>';
  try {
    const allImprese = await getByIndex('imprese', 'projectId', projectId);
    const primarie = allImprese.filter(i => (i.ruolo === 'AFFIDATARIA' || i.ruolo === 'ESECUTRICE') && i.id !== id);
    primarie.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.ragioneSociale + ' (' + p.ruolo + ')';
      selectSub.appendChild(opt);
    });
  } catch (err) {
    console.error("Errore fetch imprese primarie", err);
  }

  if (id) {
    // Modifica: pre-popola i dati
    try {
      const impresa = await getItem('imprese', id);
      if (impresa) {
        document.getElementById('impresa-id').value = impresa.id;
        document.getElementById('impresa-ragione-sociale').value = impresa.ragioneSociale || '';
        document.getElementById('impresa-piva').value = impresa.partitaIva || '';
        document.getElementById('impresa-cf').value = impresa.codiceFiscale || '';
        document.getElementById('impresa-sede').value = impresa.sedeLegale || '';
        document.getElementById('impresa-pec').value = impresa.pec || '';
        document.getElementById('impresa-referente').value = impresa.referente || '';
        document.getElementById('impresa-telefono').value = impresa.telefono || '';
        document.getElementById('impresa-email').value = impresa.email || '';
        
        // Check radio ruolo
        const radio = document.querySelector(`input[name="impresa-ruolo"][value="${impresa.ruolo}"]`);
        if (radio) radio.checked = true;

        if (impresa.ruolo === 'SUBAPPALTO') {
          selectSub.value = impresa.subAppaltoDi || '';
        }

        // Carica Documenti
        if (impresa.documenti && Array.isArray(impresa.documenti)) {
          impresa.documenti.forEach(doc => aggiungiRigaDocImpresa(doc));
        }

        // Controlla se ha dipendenti o mezzi per bloccare il cambio subappalto
        const [lavs, mezzi] = await Promise.all([
          getByIndex('lavoratori', 'impresaId', id).catch(()=>[]),
          getByIndex('mezzi', 'impresaId', id).catch(()=>[])
        ]);
        if (lavs.length > 0 || mezzi.length > 0) {
          selectSub.disabled = true;
          document.getElementById('msg-subappalto-locked').classList.remove('page-hidden');
        }
      }
    } catch (e) {
      console.error(e);
      alert("Impossibile caricare l'impresa");
      return;
    }
  } else {
    // Nuova: aggiunge un DURC vuoto di default
    aggiungiRigaDocImpresa({ tipo: 'DURC', scadenza: '' });
  }

  aggiornaFormImpresa(); // Mostra/nasconde step 3

  const modal = document.getElementById('modal-impresa');
  modal.classList.remove('page-hidden');
  // Trigger animazione
  setTimeout(() => modal.classList.remove('opacity-0'), 10);
}

function chiudiModalImpresa() {
  const modal = document.getElementById('modal-impresa');
  modal.classList.add('opacity-0');
  setTimeout(() => modal.classList.add('page-hidden'), 300);
}

function aggiornaFormImpresa() {
  const radioSelected = document.querySelector('input[name="impresa-ruolo"]:checked');
  const sezSubappalto = document.getElementById('sezione-subappalto');
  const selectSub = document.getElementById('impresa-subappalto-di');
  
  if (radioSelected && radioSelected.value === 'SUBAPPALTO') {
    sezSubappalto.classList.remove('page-hidden');
    selectSub.required = true;
  } else {
    sezSubappalto.classList.add('page-hidden');
    selectSub.required = false;
    selectSub.value = '';
  }
}

// ─────────────────────────────────────────────
// DOCUMENTI DINAMICI
// ─────────────────────────────────────────────

function aggiungiRigaDocImpresa(doc = null) {
  const container = document.getElementById('impresa-docs-container');
  const riga = document.createElement('div');
  riga.className = "flex flex-col sm:flex-row gap-3 items-end bg-white p-3 border border-slate-200 rounded-lg shadow-sm row-documento";
  
  const vTipo = doc && doc.tipo ? doc.tipo : '';
  const vScad = doc && doc.scadenza ? doc.scadenza : '';

  riga.innerHTML = `
    <div class="w-full sm:w-1/3">
      <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Tipo Doc.</label>
      <select class="doc-tipo w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none">
        <option value="DURC" ${vTipo === 'DURC' ? 'selected' : ''}>DURC</option>
        <option value="ISCRIZIONE_CCIAA" ${vTipo === 'ISCRIZIONE_CCIAA' ? 'selected' : ''}>Visura CCIAA</option>
        <option value="IDONEITA_TECNICO_PROF" ${vTipo === 'IDONEITA_TECNICO_PROF' ? 'selected' : ''}>Idoneità T.P.</option>
        <option value="POS" ${vTipo === 'POS' ? 'selected' : ''}>P.O.S.</option>
        <option value="ALTRO" ${vTipo === 'ALTRO' ? 'selected' : ''}>Altro</option>
      </select>
    </div>
    <div class="w-full sm:w-1/3">
      <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Scadenza</label>
      <input type="date" class="doc-scadenza w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none" value="${vScad}">
    </div>
    <div class="w-full sm:w-auto mt-2 sm:mt-0 flex gap-2">
      <input type="file" class="hidden doc-file-input" onchange="gestisciUploadFile(this)">
      <button type="button" class="btn-file flex-1 ${doc && doc.base64 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-600 border-slate-300'} px-3 py-1.5 rounded text-sm hover:bg-slate-200 border" onclick="this.previousElementSibling.click()">
        ${doc && doc.base64 ? '✅ File' : '📎 File'}
      </button>
      <input type="hidden" class="doc-base64" value="${doc && doc.base64 ? doc.base64 : ''}">
      <input type="hidden" class="doc-filename" value="${doc && doc.filename ? doc.filename : ''}">
      <button type="button" class="bg-red-50 text-red-600 px-3 py-1.5 rounded text-sm hover:bg-red-100 border border-red-200" onclick="rimuoviRigaDocImpresa(this)">🗑️</button>
    </div>
  `;
  container.appendChild(riga);
}

function rimuoviRigaDocImpresa(btn) {
  const riga = btn.closest('.row-documento');
  if (riga) riga.remove();
}

/** Gestisce l'upload e la conversione in Base64 */
async function gestisciUploadFile(input) {
  const file = input.files[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    alert("File troppo grande. Massimo 2MB per il database locale.");
    input.value = '';
    return;
  }

  const riga = input.closest('.row-documento');
  const btn = riga.querySelector('.btn-file');
  const hBase64 = riga.querySelector('.doc-base64');
  const hFilename = riga.querySelector('.doc-filename');

  btn.innerHTML = '⌛ Caricamento...';

  try {
    const base64 = await convertiInBase64(file);
    hBase64.value = base64;
    hFilename.value = file.name;
    btn.innerHTML = '✅ ' + file.name.substring(0, 10) + '...';
    btn.classList.remove('bg-slate-100', 'text-slate-600', 'border-slate-300');
    btn.classList.add('bg-green-50', 'text-green-700', 'border-green-200');
  } catch (err) {
    console.error("Errore upload:", err);
    btn.innerHTML = '❌ Errore';
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
// SALVATAGGIO
// ─────────────────────────────────────────────

async function salvaImpresa(e) {
  e.preventDefault();
  const form = document.getElementById('form-impresa');
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const projectId = sessionStorage.getItem('currentProjectId');
  if (!projectId) return;

  const id = document.getElementById('impresa-id').value;
  const ruoloChecked = document.querySelector('input[name="impresa-ruolo"]:checked');
  const ruolo = ruoloChecked ? ruoloChecked.value : '';
  
  const subAppaltoDi = document.getElementById('impresa-subappalto-di').value;

  // Raccolta documenti
  const documenti = [];
  document.querySelectorAll('.row-documento').forEach(row => {
    const tipo = row.querySelector('.doc-tipo').value;
    const scadenza = row.querySelector('.doc-scadenza').value;
    const base64 = row.querySelector('.doc-base64').value;
    const filename = row.querySelector('.doc-filename').value;
    if (tipo) {
      documenti.push({ tipo, scadenza, base64, filename });
    }
  });

  const impresaData = {
    id: id || 'imp_' + Date.now(),
    projectId: projectId,
    ragioneSociale: document.getElementById('impresa-ragione-sociale').value.trim(),
    partitaIva: document.getElementById('impresa-piva').value.trim(),
    codiceFiscale: document.getElementById('impresa-cf').value.trim().toUpperCase(),
    sedeLegale: document.getElementById('impresa-sede').value.trim(),
    pec: document.getElementById('impresa-pec').value.trim(),
    referente: document.getElementById('impresa-referente').value.trim(),
    telefono: document.getElementById('impresa-telefono').value.trim(),
    email: document.getElementById('impresa-email').value.trim(),
    ruolo: ruolo,
    subAppaltoDi: ruolo === 'SUBAPPALTO' ? subAppaltoDi : null,
    documenti: documenti,
    modifiedAt: new Date().toISOString(),
    modifiedBy: 'Utente' // FASE 8: Auth reale
  };

  try {
    await saveItem('imprese', impresaData);
    chiudiModalImpresa();
    renderImprese();
  } catch (err) {
    console.error("Errore salvataggio impresa", err);
    alert("Impossibile salvare l'impresa");
  }
}

// ─────────────────────────────────────────────
// ELIMINAZIONE & CASCADE
// ─────────────────────────────────────────────

async function confermaEliminaImpresa(id, nome) {
  impresaDaEliminare = id;
  document.getElementById('elimina-impresa-nome').textContent = nome;
  
  const cascadeInfo = document.getElementById('elimina-impresa-cascade-info');
  const cascadeList = document.getElementById('elimina-impresa-cascade-list');
  cascadeList.innerHTML = '';
  
  try {
    const [lavs, mezzi, subs] = await Promise.all([
      getByIndex('lavoratori', 'impresaId', id).catch(()=>[]),
      getByIndex('mezzi', 'impresaId', id).catch(()=>[]),
      getByIndex('imprese', 'subAppaltoDi', id).catch(()=>[]) // subappaltatrici
    ]);
    
    let haCascade = false;
    
    if (lavs.length > 0) {
      cascadeList.innerHTML += `<li>${lavs.length} lavoratori associati</li>`;
      haCascade = true;
    }
    if (mezzi.length > 0) {
      cascadeList.innerHTML += `<li>${mezzi.length} mezzi associati</li>`;
      haCascade = true;
    }
    if (subs.length > 0) {
      cascadeList.innerHTML += `<li>${subs.length} imprese in subappalto a questa</li>`;
      haCascade = true;
    }
    
    if (haCascade) {
      cascadeInfo.classList.remove('page-hidden');
    } else {
      cascadeInfo.classList.add('page-hidden');
    }
    
    const modal = document.getElementById('modal-elimina-impresa');
    modal.classList.remove('page-hidden');
    setTimeout(() => modal.classList.remove('opacity-0'), 10);
    
  } catch (err) {
    console.error(err);
    alert("Errore nel conteggio entità collegate");
  }
}

function chiudiModalEliminaImpresa() {
  impresaDaEliminare = null;
  const modal = document.getElementById('modal-elimina-impresa');
  modal.classList.add('opacity-0');
  setTimeout(() => modal.classList.add('page-hidden'), 300);
}

async function eseguiEliminaImpresa() {
  if (!impresaDaEliminare) return;
  
  try {
    // 1. Elimina Lavoratori
    const lavs = await getByIndex('lavoratori', 'impresaId', impresaDaEliminare).catch(()=>[]);
    for (const l of lavs) {
      await deleteItem('lavoratori', l.id);
    }
    
    // 2. Elimina Mezzi
    const mezzi = await getByIndex('mezzi', 'impresaId', impresaDaEliminare).catch(()=>[]);
    for (const m of mezzi) {
      await deleteItem('mezzi', m.id);
    }
    
    // 3. Elimina Subappaltatrici in cascade (flat delete per ora)
    const subs = await getByIndex('imprese', 'subAppaltoDi', impresaDaEliminare).catch(()=>[]);
    for (const s of subs) {
      await deleteItem('imprese', s.id); 
    }

    // 4. Elimina Impresa principale
    await deleteItem('imprese', impresaDaEliminare);
    
    chiudiModalEliminaImpresa();
    renderImprese();
    
    if (typeof showToast === 'function') {
      showToast("Impresa eliminata con successo", "success");
    } else {
      alert("Impresa eliminata con successo");
    }
    
  } catch (err) {
    console.error("Errore eliminazione cascade:", err);
    alert("Errore durante l'eliminazione dell'impresa.");
  }
}

// ─────────────────────────────────────────────
// RENDER VIEW — inietta scaffold completo + modali
// ─────────────────────────────────────────────

function renderViewImprese(container) {
  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex justify-between items-center">
        <div>
          <h2 class="text-3xl font-bold text-slate-900">Imprese</h2>
          <p class="text-slate-500 text-sm mt-1">Anagrafica imprese operanti nel cantiere</p>
        </div>
        <button onclick="apriModalImpresa()" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl shadow transition">+ Nuova Impresa</button>
      </div>
      <div class="flex flex-wrap gap-2">
        <button onclick="renderImprese('Tutte')" class="filter-btn-impresa filter-Tutte px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 bg-slate-800 text-white transition">Tutte</button>
        <button onclick="renderImprese('AFFIDATARIA')" class="filter-btn-impresa filter-AFFIDATARIA px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 bg-white text-slate-600 transition">Affidataria</button>
        <button onclick="renderImprese('ESECUTRICE')" class="filter-btn-impresa filter-ESECUTRICE px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 bg-white text-slate-600 transition">Esecutrice</button>
        <button onclick="renderImprese('SUBAPPALTO')" class="filter-btn-impresa filter-SUBAPPALTO px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 bg-white text-slate-600 transition">Sub-Appalto</button>
        <button onclick="renderImprese('FORNITORE')" class="filter-btn-impresa filter-FORNITORE px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 bg-white text-slate-600 transition">Fornitore</button>
      </div>
      <div id="imprese-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"></div>
    </div>

    <!-- MODAL Nuova/Modifica Impresa -->
    <div id="modal-impresa" class="page-hidden opacity-0 fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[2000] flex items-start justify-center p-4 pt-10 transition-opacity duration-300">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div class="p-5 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white z-10">
          <h3 id="modal-impresa-title" class="text-xl font-bold text-slate-800">Nuova Impresa</h3>
          <button onclick="chiudiModalImpresa()" class="text-slate-400 hover:text-slate-800 text-2xl leading-none">&times;</button>
        </div>
        <form id="form-impresa" onsubmit="salvaImpresa(event)" class="p-6 space-y-5">
          <input type="hidden" id="impresa-id">
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Ruolo nel cantiere *</label>
            <div class="grid grid-cols-2 gap-3">
              <label class="flex items-center gap-2 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-blue-50">
                <input type="radio" name="impresa-ruolo" value="AFFIDATARIA" onchange="aggiornaFormImpresa()" required class="accent-blue-600">
                <span class="text-sm font-semibold">Affidataria</span>
              </label>
              <label class="flex items-center gap-2 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-indigo-50">
                <input type="radio" name="impresa-ruolo" value="ESECUTRICE" onchange="aggiornaFormImpresa()" class="accent-indigo-600">
                <span class="text-sm font-semibold">Esecutrice</span>
              </label>
              <label class="flex items-center gap-2 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-yellow-50">
                <input type="radio" name="impresa-ruolo" value="SUBAPPALTO" onchange="aggiornaFormImpresa()" class="accent-yellow-600">
                <span class="text-sm font-semibold">Sub-Appalto</span>
              </label>
              <label class="flex items-center gap-2 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                <input type="radio" name="impresa-ruolo" value="FORNITORE" onchange="aggiornaFormImpresa()" class="accent-slate-600">
                <span class="text-sm font-semibold">Fornitore</span>
              </label>
            </div>
          </div>
          <div id="sezione-subappalto" class="page-hidden bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-2">
            <label class="block text-xs font-bold text-slate-600 uppercase tracking-wide">Sub-appaltatrice di *</label>
            <select id="impresa-subappalto-di" class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none bg-white">
              <option value="">-- Seleziona impresa --</option>
            </select>
            <div id="msg-subappalto-locked" class="page-hidden text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded p-2">
              ⚠️ Impresa con dipendenti o mezzi — cambio bloccato.
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="sm:col-span-2">
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Ragione Sociale *</label>
              <input type="text" id="impresa-ragione-sociale" required class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400" placeholder="Es. Rossi Costruzioni S.r.l.">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Partita IVA *</label>
              <input type="text" id="impresa-piva" required maxlength="11" pattern="[0-9]{11}" class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-400" placeholder="11 cifre">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Codice Fiscale</label>
              <input type="text" id="impresa-cf" class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-400" placeholder="Facoltativo">
            </div>
            <div class="sm:col-span-2">
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Sede Legale</label>
              <input type="text" id="impresa-sede" class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400" placeholder="Via Roma 1, Crotone (KR)">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">PEC</label>
              <input type="email" id="impresa-pec" class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Referente cantiere</label>
              <input type="text" id="impresa-referente" class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400" placeholder="Nome Cognome">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Telefono</label>
              <input type="tel" id="impresa-telefono" class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Email</label>
              <input type="email" id="impresa-email" class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">
            </div>
          </div>
          <div>
            <div class="flex justify-between items-center mb-2">
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide">Documenti &amp; Scadenze</label>
              <button type="button" onclick="aggiungiRigaDocImpresa()" class="text-xs text-blue-600 font-bold hover:underline">+ Aggiungi documento</button>
            </div>
            <div id="impresa-docs-container" class="space-y-2"></div>
          </div>
          <div class="flex gap-3 pt-3 border-t border-slate-100">
            <button type="button" onclick="chiudiModalImpresa()" class="flex-1 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition border border-slate-200">Annulla</button>
            <button type="submit" class="flex-1 py-2.5 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 transition shadow">Salva Impresa</button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL Elimina Impresa -->
    <div id="modal-elimina-impresa" class="page-hidden opacity-0 fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[2100] flex items-center justify-center p-4 transition-opacity duration-300">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h3 class="text-lg font-bold text-slate-800">Elimina Impresa</h3>
        <p class="text-sm text-slate-600">Stai per eliminare: <strong id="elimina-impresa-nome"></strong></p>
        <div id="elimina-impresa-cascade-info" class="page-hidden bg-red-50 border border-red-200 rounded-lg p-3">
          <p class="text-xs font-bold text-red-700 mb-1">⚠️ Saranno eliminati anche:</p>
          <ul id="elimina-impresa-cascade-list" class="list-disc list-inside text-xs text-red-600 space-y-0.5"></ul>
        </div>
        <div class="flex gap-3 pt-2">
          <button onclick="chiudiModalEliminaImpresa()" class="flex-1 py-2.5 rounded-xl font-bold text-slate-500 border border-slate-200 hover:bg-slate-50">Annulla</button>
          <button onclick="eseguiEliminaImpresa()" class="flex-1 py-2.5 rounded-xl font-bold bg-red-600 text-white hover:bg-red-700 shadow">Elimina</button>
        </div>
      </div>
    </div>
  `;

  renderImprese();
}

window.ImpreseModulo = { render: renderViewImprese };
