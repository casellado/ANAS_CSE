// mezzi.js - Modulo Anagrafica Mezzi e Attrezzature (FASE 4.5)

let mezzoDaEliminare = null;

// ─────────────────────────────────────────────
// HELPERS & RENDERING
// ─────────────────────────────────────────────

async function caricaFiltroImpreseMezzi() {
  const projectId = sessionStorage.getItem('currentProjectId');
  const select = document.getElementById('filter-mez-impresa');
  if (!select) return;
  select.innerHTML = '<option value="Tutte">Tutte le imprese</option>';
  
  if (!projectId) return;
  
  try {
    const imprese = await getByIndex('imprese', 'projectId', projectId);
    imprese.sort((a,b) => (a.ragioneSociale || '').localeCompare(b.ragioneSociale || ''));
    imprese.forEach(imp => {
      select.innerHTML += `<option value="${imp.id}">${escapeHtml(imp.ragioneSociale)} [${imp.ruolo}]</option>`;
    });
  } catch(e) {
    console.error("Errore caricamento imprese per filtro mezzi:", e);
  }
}

async function renderMezzi() {
  const projectId = sessionStorage.getItem('currentProjectId');
  if (!projectId) return;

  const filterImpresa = document.getElementById('filter-mez-impresa')?.value || 'Tutte';
  const filterCat = document.getElementById('filter-mez-cat')?.value || 'Tutte';
  const filterPresenza = document.getElementById('filter-mez-presenza')?.value || 'Tutti';

  const grid = document.getElementById('mezzi-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="col-span-full text-center py-8 text-slate-400">Caricamento mezzi...</div>';

  try {
    const allMezzi = await getByIndex('mezzi', 'projectId', projectId);
    
    // Carichiamo imprese per i nomi nelle card
    const impreseStore = await getByIndex('imprese', 'projectId', projectId);
    const mapImprese = {};
    impreseStore.forEach(imp => mapImprese[imp.id] = imp);

    // Filtri
    let filtered = allMezzi;
    if (filterImpresa !== 'Tutte') {
      filtered = filtered.filter(m => m.impresaId === filterImpresa);
    }
    if (filterCat !== 'Tutte') {
      filtered = filtered.filter(m => {
        // La categoria è contenuta nei primi due caratteri dell'id tipologia nel catalogo? 
        // No, la tipologia è l'id (es 'gru-torre'). Dobbiamo risalire alla macro-categoria.
        const catObj = MACRO_CATEGORIE_MEZZI.find(c => c.mezzi.some(mz => mz.id === m.tipologia));
        return catObj && catObj.id === filterCat;
      });
    }
    if (filterPresenza !== 'Tutti') {
      const isPresente = filterPresenza === 'In cantiere';
      filtered = filtered.filter(m => m.presenteInCantiere === isPresente);
    }

    // Ordinamento: Marca e Modello
    filtered.sort((a,b) => {
      const sA = (a.marca + ' ' + a.modello).toLowerCase();
      const sB = (b.marca + ' ' + b.modello).toLowerCase();
      return sA.localeCompare(sB);
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full bg-white rounded-xl shadow-sm p-8 text-center border border-slate-200">
          <div class="text-4xl mb-4">🚜</div>
          <h3 class="text-lg font-bold text-slate-700">Nessun mezzo trovato</h3>
          <p class="text-sm text-slate-500">Aggiungi il primo mezzo cliccando su "Nuovo Mezzo".</p>
        </div>
      `;
      if (document.getElementById('filter-mez-impresa')?.options.length <= 1) {
        await caricaFiltroImpreseMezzi();
      }
      return;
    }

    if (document.getElementById('filter-mez-impresa')?.options.length <= 1) {
      await caricaFiltroImpreseMezzi();
    }

    grid.innerHTML = '';
    
    for (const m of filtered) {
      const impresa = mapImprese[m.impresaId] || { ragioneSociale: 'Impresa sconosciuta', ruolo: '?' };
      const nomeTipologia = typeof getNomeTipologiaMezzo === 'function' ? getNomeTipologiaMezzo(m.tipologia) : m.tipologia;
      const catObj = MACRO_CATEGORIE_MEZZI.find(c => c.mezzi.some(mz => mz.id === m.tipologia)) || { id: '??', icona: '⚙️' };

      // Badge Libretto
      const hasLibretto = m.libretto && m.libretto.documentoId;
      const librettoHtml = hasLibretto 
        ? '<span class="text-emerald-600 font-bold">✅ presente</span>' 
        : '<span class="text-slate-400">❓ mancante</span>';

      // Badge Verifiche
      let verificheHtml = '<span class="text-slate-400">Nessuna verifica</span>';
      if (m.verifichePeriodiche && m.verifichePeriodiche.length > 0) {
        const ultima = m.verifichePeriodiche.sort((a,b) => new Date(b.data) - new Date(a.data))[0];
        const scadenza = new Date(ultima.data);
        
        // Calcolo scadenza (approssimativo basato sul tipo se non esplicito, ma qui assumiamo 1 anno per il badge warning)
        scadenza.setFullYear(scadenza.getFullYear() + 1); 
        const ora = new Date();
        const diffGiorni = Math.ceil((scadenza - ora) / (1000 * 60 * 60 * 24));
        
        if (diffGiorni < 0) {
          verificheHtml = `<span class="text-red-600 font-bold">🚨 ${m.verifichePeriodiche.length} (scadute)</span>`;
        } else if (diffGiorni <= 30) {
          verificheHtml = `<span class="text-orange-600 font-bold">⚠️ ${m.verifichePeriodiche.length} (in scadenza)</span>`;
        } else {
          verificheHtml = `<span class="text-emerald-600 font-bold">✅ ${m.verifichePeriodiche.length} regolari</span>`;
        }
      }

      // Sezione Lavoratori Abilitati (Informativa)
      const lavAbilitati = await getLavoratoriAbilitatiPerMezzo(m.tipologia);
      let lavHtml = '';
      if (lavAbilitati.length > 0) {
        lavHtml = `
          <div class="mt-3 pt-3 border-t border-slate-100">
            <div class="text-[10px] font-bold text-slate-400 uppercase mb-1">Lavoratori Abilitati (${lavAbilitati.length})</div>
            <div class="flex flex-wrap gap-1">
              ${lavAbilitati.slice(0, 3).map(l => `<span class="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">${escapeHtml(l.cognome)}</span>`).join('')}
              ${lavAbilitati.length > 3 ? `<span class="text-[10px] text-slate-400">+${lavAbilitati.length - 3}</span>` : ''}
            </div>
          </div>
        `;
      }

      const card = document.createElement('div');
      card.className = "bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col hover:shadow-md transition overflow-hidden";
      card.innerHTML = `
        <div class="p-4 border-b border-slate-100 bg-slate-50/50 relative">
          <div class="flex justify-between items-start mb-1">
            <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">${catObj.icona} ${catObj.id}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${m.presenteInCantiere ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}">
              ${m.presenteInCantiere ? 'In cantiere' : 'Non in cantiere'}
            </span>
          </div>
          <h4 class="font-bold text-slate-800 text-lg leading-tight line-clamp-1" title="${escapeHtml(m.marca)} ${escapeHtml(m.modello)}">
            ${escapeHtml(m.marca)} ${escapeHtml(m.modello)}
          </h4>
          <div class="text-xs text-slate-500 mt-1 font-medium">${escapeHtml(nomeTipologia)}</div>
        </div>
        <div class="p-4 flex-1 space-y-2 text-sm text-slate-600">
          <div class="flex items-start gap-2 mb-3">
            <span class="w-5 text-center shrink-0 mt-0.5">🏢</span>
            <div class="leading-tight">
              <span class="font-bold text-slate-700 block">${escapeHtml(impresa.ragioneSociale)}</span>
              <span class="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded uppercase font-semibold">${impresa.ruolo}</span>
            </div>
          </div>
          
          <div class="grid grid-cols-2 gap-2 mb-3">
            <div>
              <span class="font-semibold block text-[10px] uppercase text-slate-400">Matricola</span>
              <span class="font-mono text-xs text-slate-700">${escapeHtml(m.matricola)}</span>
            </div>
            <div>
              <span class="font-semibold block text-[10px] uppercase text-slate-400">Anno</span>
              <span class="text-slate-700">${m.anno || 'N.D.'}</span>
            </div>
          </div>

          <div class="space-y-1.5">
            <div class="flex items-center justify-between text-xs">
              <span class="text-slate-500">📋 Libretto Uso:</span>
              ${librettoHtml}
            </div>
            <div class="flex items-center justify-between text-xs">
              <span class="text-slate-500">🔍 Verifiche:</span>
              ${verificheHtml}
            </div>
            <div class="flex items-center justify-between text-xs">
              <span class="text-slate-500">📷 Foto:</span>
              <span class="font-bold text-slate-700">${(m.foto || []).length}</span>
            </div>
          </div>

          ${lavHtml}
        </div>
        <div class="p-3 border-t border-slate-100 bg-slate-50 flex gap-2 shrink-0">
          <button onclick="apriModalMezzo('${m.id}')" class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition">
            <span>📝</span> Modifica
          </button>
          <button onclick="confermaEliminaMezzo('${m.id}', '${escapeHtml((m.marca + ' ' + m.modello).replace(/'/g, "\\'"))}')" class="flex items-center justify-center px-3 py-1.5 text-sm font-semibold text-red-600 bg-white border border-red-200 rounded hover:bg-red-50 hover:border-red-300 transition">
            <span>🗑️</span>
          </button>
        </div>
      `;
      grid.appendChild(card);
    }
  } catch (err) {
    console.error("Errore render Mezzi:", err);
    grid.innerHTML = '<div class="col-span-full text-center text-red-500">Errore nel caricamento dei dati.</div>';
  }
}

// ─────────────────────────────────────────────
// LAVORATORI ABILITATI (HELPER)
// ─────────────────────────────────────────────

async function getLavoratoriAbilitatiPerMezzo(tipologiaId) {
  const projectId = sessionStorage.getItem('currentProjectId');
  if (!projectId) return [];
  
  try {
    const allLav = await getByIndex('lavoratori', 'projectId', projectId);
    const oggi = new Date().toISOString().split('T')[0];
    
    return allLav.filter(l => {
      if (!l.abilitazioni) return false;
      return l.abilitazioni.some(ab => ab.tipologiaMezzo === tipologiaId && ab.scadenza >= oggi);
    });
  } catch (e) {
    console.error("Errore getLavoratoriAbilitatiPerMezzo:", e);
    return [];
  }
}

// ─────────────────────────────────────────────
// MODAL & FORM
// ─────────────────────────────────────────────

async function apriModalMezzo(id = null) {
  const projectId = sessionStorage.getItem('currentProjectId');
  if (!projectId) return;

  const form = document.getElementById('form-mezzo');
  if (!form) return;
  form.reset();
  document.getElementById('mezzo-id').value = '';
  document.getElementById('modal-mezzo-title').textContent = id ? 'Modifica Mezzo' : 'Nuovo Mezzo';
  document.getElementById('mezzo-verifiche-container').innerHTML = '';
  document.getElementById('mezzo-foto-count').textContent = 'Nessuna foto caricata.';

  // Popolamento dropdown imprese
  const selectImpresa = document.getElementById('mezzo-impresa');
  selectImpresa.innerHTML = '<option value="">-- Seleziona impresa --</option>';
  try {
    const imprese = await getByIndex('imprese', 'projectId', projectId);
    imprese.sort((a,b) => (a.ragioneSociale || '').localeCompare(b.ragioneSociale || ''));
    imprese.forEach(imp => {
      selectImpresa.innerHTML += `<option value="${imp.id}">${escapeHtml(imp.ragioneSociale)} [${imp.ruolo}]</option>`;
    });
  } catch (e) {
    console.error("Errore caricamento imprese modale mezzi", e);
  }

  // Popolamento tipologie (usando helper dal catalogo)
  const selectTipo = document.getElementById('mezzo-tipologia');
  if (typeof getOpzioniTipologieMezziHtml === 'function') {
    selectTipo.innerHTML = getOpzioniTipologieMezziHtml();
  }

  if (id) {
    try {
      const m = await getItem('mezzi', id);
      if (m) {
        document.getElementById('mezzo-id').value = m.id;
        document.getElementById('mezzo-impresa').value = m.impresaId || '';
        document.getElementById('mezzo-tipologia').value = m.tipologia || '';
        document.getElementById('mezzo-marca').value = m.marca || '';
        document.getElementById('mezzo-modello').value = m.modello || '';
        document.getElementById('mezzo-matricola').value = m.matricola || '';
        document.getElementById('mezzo-serie').value = m.numeroSerie || '';
        document.getElementById('mezzo-anno').value = m.anno || '';
        document.getElementById('mezzo-presenza').checked = !!m.presenteInCantiere;
        
        document.getElementById('mezzo-foto-count').textContent = `${(m.foto || []).length} foto caricate.`;

        if (m.verifichePeriodiche && m.verifichePeriodiche.length > 0) {
          m.verifichePeriodiche.forEach(v => aggiungiRigaVerificaMezzo(v));
        }
      }
    } catch (e) {
      console.error(e);
      alert("Impossibile caricare i dati");
    }
  }

  const modal = document.getElementById('modal-mezzo');
  modal.classList.remove('page-hidden');
  setTimeout(() => modal.classList.remove('opacity-0'), 10);
}

function chiudiModalMezzo() {
  const modal = document.getElementById('modal-mezzo');
  modal.classList.add('opacity-0');
  setTimeout(() => modal.classList.add('page-hidden'), 300);
}

// ─────────────────────────────────────────────
// VERIFICHE DINAMICHE
// ─────────────────────────────────────────────

function aggiungiRigaVerificaMezzo(data = null) {
  const container = document.getElementById('mezzo-verifiche-container');
  const idRiga = 'ver_' + Date.now() + Math.random().toString(36).substr(2,5);
  
  const div = document.createElement('div');
  div.className = 'bg-white border border-slate-200 p-3 rounded shadow-sm relative group mez-verifica-row';
  div.id = idRiga;
  
  div.innerHTML = `
    <button type="button" onclick="document.getElementById('${idRiga}').remove()" class="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full w-6 h-6 flex items-center justify-center font-bold text-xs shadow hover:bg-red-600 hover:text-white transition opacity-0 group-hover:opacity-100">&times;</button>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
      <div>
        <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo *</label>
        <select class="mez-ver-tipo w-full border border-slate-300 rounded px-2 py-1.5 text-xs bg-white" required>
          <option value="annuale">ANNUALE</option>
          <option value="biennale">BIENNALE</option>
          <option value="triennale">TRIENNALE</option>
          <option value="quinquennale">QUINQUENNALE</option>
          <option value="altro">ALTRO</option>
        </select>
      </div>
      <div>
        <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data Esec. *</label>
        <input type="date" class="mez-ver-data w-full border border-slate-300 rounded px-2 py-1.5 text-xs bg-white" required>
      </div>
      <div>
        <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ente Verif. *</label>
        <input type="text" class="mez-ver-ente w-full border border-slate-300 rounded px-2 py-1.5 text-xs bg-white" placeholder="Es. INAIL" required>
      </div>
      <div>
        <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Esito *</label>
        <select class="mez-ver-esito w-full border border-slate-300 rounded px-2 py-1.5 text-xs bg-white" required>
          <option value="CONFORME">CONFORME</option>
          <option value="CONFORME_CON_PRESCRIZIONI">CON PRESCRIZIONI</option>
          <option value="NON_CONFORME">NON CONFORME</option>
        </select>
      </div>
      <div class="flex items-end">
        <button type="button" class="w-full bg-slate-100 text-slate-600 px-2 py-1.5 rounded text-[10px] border border-slate-300" onclick="alert('Upload PDF in FASE 7')">📎 Verbale</button>
      </div>
    </div>
  `;
  
  container.appendChild(div);
  
  if (data) {
    div.querySelector('.mez-ver-tipo').value = data.tipo || 'annuale';
    div.querySelector('.mez-ver-data').value = data.data || '';
    div.querySelector('.mez-ver-ente').value = data.enteVerifica || '';
    div.querySelector('.mez-ver-esito').value = data.esito || 'CONFORME';
  }
}

function raccogliVerificheMezzo() {
  const container = document.getElementById('mezzo-verifiche-container');
  const righe = container.querySelectorAll('.mez-verifica-row');
  const ver = [];
  
  righe.forEach(r => {
    ver.push({
      tipo: r.querySelector('.mez-ver-tipo').value,
      data: r.querySelector('.mez-ver-data').value,
      enteVerifica: r.querySelector('.mez-ver-ente').value.trim(),
      esito: r.querySelector('.mez-ver-esito').value,
      documentoId: null // FASE 7
    });
  });
  
  return ver;
}

// ─────────────────────────────────────────────
// SALVATAGGIO
// ─────────────────────────────────────────────

async function salvaMezzo(e) {
  e.preventDefault();
  const form = document.getElementById('form-mezzo');
  if (!form || !form.checkValidity()) {
    if (form) form.reportValidity();
    return;
  }

  const projectId = sessionStorage.getItem('currentProjectId');
  if (!projectId) return;

  const id = document.getElementById('mezzo-id').value;
  
  const mezzoData = {
    id: id || 'mzo_' + Date.now(),
    projectId: projectId,
    impresaId: document.getElementById('mezzo-impresa').value,
    
    tipologia: document.getElementById('mezzo-tipologia').value,
    marca: document.getElementById('mezzo-marca').value.trim(),
    modello: document.getElementById('mezzo-modello').value.trim(),
    matricola: document.getElementById('mezzo-matricola').value.trim().toUpperCase(),
    numeroSerie: document.getElementById('mezzo-serie').value.trim().toUpperCase(),
    anno: parseInt(document.getElementById('mezzo-anno').value) || null,
    
    presenteInCantiere: document.getElementById('mezzo-presenza').checked,
    
    libretto: { documentoId: null }, // FASE 7
    verifichePeriodiche: raccogliVerificheMezzo(),
    foto: [], // FASE 7
    
    modifiedAt: new Date().toISOString(),
    modifiedBy: 'Utente' // FASE 8
  };

  try {
    await saveItem('mezzi', mezzoData);
    chiudiModalMezzo();
    renderMezzi();
  } catch (err) {
    console.error("Errore salvataggio mezzo", err);
    alert("Impossibile salvare i dati");
  }
}

// ─────────────────────────────────────────────
// ELIMINAZIONE
// ─────────────────────────────────────────────

function confermaEliminaMezzo(id, nome) {
  mezzoDaEliminare = id;
  document.getElementById('elimina-mezzo-nome').textContent = nome;
  
  const modal = document.getElementById('modal-elimina-mezzo');
  modal.classList.remove('page-hidden');
  setTimeout(() => modal.classList.remove('opacity-0'), 10);
}

function chiudiModalEliminaMezzo() {
  mezzoDaEliminare = null;
  const modal = document.getElementById('modal-elimina-mezzo');
  modal.classList.add('opacity-0');
  setTimeout(() => modal.classList.add('page-hidden'), 300);
}

async function eseguiEliminaMezzo() {
  if (!mezzoDaEliminare) return;
  
  try {
    const mezId = mezzoDaEliminare;
    await deleteItem('mezzi', mezId);
    
    // Cascade su store 'documenti'
    try {
      const docsMezzo = await getByIndex('documenti', 'entitaCollegataId', mezId);
      for (const doc of docsMezzo) {
        await deleteItem('documenti', doc.id);
      }
    } catch (e) {
      console.warn("Errore in cascade documenti mezzo:", e);
    }
    
    chiudiModalEliminaMezzo();
    renderMezzi();
    
    if (typeof mostraToast === 'function') {
      mostraToast("Mezzo eliminato con successo", "success");
    } else {
      alert("Mezzo eliminato");
    }
    
  } catch (err) {
    console.error("Errore eliminazione mezzo:", err);
    alert("Errore durante l'eliminazione.");
  }
}
