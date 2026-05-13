// lavoratori.js - Modulo Anagrafica Lavoratori (FASE 4.4)

let lavoratoreDaEliminare = null;

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
    return { stato: 'in-scadenza', label: \`⚠️ scade tra \${diffDays}gg\`, color: 'text-orange-600 font-bold' };
  } else {
    return { stato: 'valido', label: \`✅ valido (\${scadData.toLocaleDateString('it-IT')})\`, color: 'text-emerald-600' };
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
  select.innerHTML = '<option value="Tutte">Tutte le imprese</option>';
  
  if (!projectId) return;
  
  try {
    const imprese = await getByIndex('imprese', 'projectId', projectId);
    imprese.sort((a,b) => (a.ragioneSociale || '').localeCompare(b.ragioneSociale || ''));
    
    imprese.forEach(imp => {
      select.innerHTML += \`<option value="\${imp.id}">\${escapeHtml(imp.ragioneSociale)} [\${imp.ruolo}]</option>\`;
    });
  } catch(e) {
    console.error("Errore caricamento imprese per filtro:", e);
  }
}

async function renderLavoratori() {
  const projectId = sessionStorage.getItem('currentProjectId');
  if (!projectId) return;

  const filterImpresa = document.getElementById('filter-lav-impresa').value;
  const filterDocs = document.getElementById('filter-lav-docs').value;

  const grid = document.getElementById('lavoratori-grid');
  grid.innerHTML = '<div class="col-span-full text-center py-8 text-slate-400">Caricamento lavoratori...</div>';

  try {
    const allLavoratori = await getByIndex('lavoratori', 'projectId', projectId);
    
    // Serve caricare le imprese per mostrare il nome
    const impreseStore = await getByIndex('imprese', 'projectId', projectId);
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
      grid.innerHTML = \`
        <div class="col-span-full bg-white rounded-xl shadow-sm p-8 text-center border border-slate-200">
          <div class="text-4xl mb-4">👷</div>
          <h3 class="text-lg font-bold text-slate-700">Nessun lavoratore trovato</h3>
          <p class="text-sm text-slate-500">Aggiungi il primo lavoratore cliccando su "Nuovo Lavoratore".</p>
        </div>
      \`;
      // Se le imprese sono vuote, ricarica il select per sicurezza al primo render
      if (document.getElementById('filter-lav-impresa').options.length <= 1) {
        await caricaFiltroImprese();
      }
      return;
    }

    // Se le imprese non sono state caricate nel filtro
    if (document.getElementById('filter-lav-impresa').options.length <= 1) {
      await caricaFiltroImprese();
    }

    grid.innerHTML = '';
    
    for (const item of finalFiltered) {
      const l = item.lav;
      const impresa = mapImprese[l.impresaId] || { ragioneSociale: 'Impresa sconosciuta', ruolo: '?' };
      
      const card = document.createElement('div');
      card.className = "bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col hover:shadow-md transition overflow-hidden";
      
      const countPat = (l.abilitazioni || []).length;
      let patentiniHtml = \`<div class="flex items-start gap-2 mt-2 pt-2 border-t border-slate-100">
        <span class="w-5 text-center shrink-0">🔧</span>
        <span class="text-xs text-slate-500">\${countPat > 0 ? \`\${countPat} abilitazioni registrate\` : 'Nessuna abilitazione'}</span>
      </div>\`;

      card.innerHTML = \`
        <div class="p-4 border-b border-slate-100 bg-slate-50/50 relative">
          <div class="text-[10px] font-bold text-slate-500 mb-1">\${escapeHtml(l.codiceFiscale)}</div>
          <h4 class="font-bold text-slate-800 text-lg leading-tight line-clamp-1" title="\${escapeHtml(l.nome)} \${escapeHtml(l.cognome)}">
            \${escapeHtml(l.nome)} \${escapeHtml(l.cognome)}
          </h4>
          <div class="text-xs text-slate-500 mt-1 font-medium">\${escapeHtml(l.mansione)}</div>
        </div>
        <div class="p-4 flex-1 space-y-2 text-sm text-slate-600">
          <div class="flex items-start gap-2 mb-3">
            <span class="w-5 text-center shrink-0 mt-0.5">🏢</span>
            <div class="leading-tight">
              <span class="font-bold text-slate-700 block">\${escapeHtml(impresa.ragioneSociale)}</span>
              <span class="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded uppercase font-semibold">\${impresa.ruolo}</span>
            </div>
          </div>
          
          <div class="flex items-start gap-2">
            <span class="w-5 text-center shrink-0">📋</span>
            <div class="flex-1">
              <span class="font-semibold block text-xs uppercase text-slate-400">Formazione</span>
              <span class="\${item.formazioneStato.color}">\${item.formazioneStato.label}</span>
            </div>
          </div>
          
          <div class="flex items-start gap-2">
            <span class="w-5 text-center shrink-0">🏥</span>
            <div class="flex-1">
              <span class="font-semibold block text-xs uppercase text-slate-400">Visita Medica</span>
              <span class="\${item.visitaStato.color}">\${item.visitaStato.label}</span>
            </div>
          </div>
          
          \${patentiniHtml}
        </div>
        <div class="p-3 border-t border-slate-100 bg-slate-50 flex gap-2 shrink-0">
          <button onclick="apriModalLavoratore('\${l.id}')" class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition">
            <span>📝</span> Modifica
          </button>
          <button onclick="confermaEliminaLavoratore('\${l.id}', '\${escapeHtml((l.nome + ' ' + l.cognome).replace(/'/g, "\\\\\\'"))}')" class="flex items-center justify-center px-3 py-1.5 text-sm font-semibold text-red-600 bg-white border border-red-200 rounded hover:bg-red-50 hover:border-red-300 transition">
            <span>🗑️</span>
          </button>
        </div>
      \`;
      grid.appendChild(card);
    }
  } catch (err) {
    console.error("Errore render Lavoratori:", err);
    grid.innerHTML = '<div class="col-span-full text-center text-red-500">Errore nel caricamento dei dati.</div>';
  }
}

// ─────────────────────────────────────────────
// MODAL & FORM CREAZIONE/MODIFICA
// ─────────────────────────────────────────────

async function apriModalLavoratore(id = null) {
  const projectId = sessionStorage.getItem('currentProjectId');
  if (!projectId) return;

  const form = document.getElementById('form-lavoratore');
  form.reset();
  document.getElementById('lavoratore-id').value = '';
  document.getElementById('modal-lavoratore-title').textContent = id ? 'Modifica Lavoratore' : 'Nuovo Lavoratore';
  document.getElementById('lavoratore-cambio-impresa-warn').classList.add('page-hidden');
  
  // Svuota righe abilitazioni
  document.getElementById('lav-abilitazioni-container').innerHTML = '';

  // Popola dropdown imprese
  const selectImpresa = document.getElementById('lavoratore-impresa');
  selectImpresa.innerHTML = '<option value="">-- Seleziona impresa --</option>';
  try {
    const imprese = await getByIndex('imprese', 'projectId', projectId);
    imprese.sort((a,b) => (a.ragioneSociale || '').localeCompare(b.ragioneSociale || ''));
    imprese.forEach(imp => {
      selectImpresa.innerHTML += \`<option value="\${imp.id}">\${escapeHtml(imp.ragioneSociale)} [\${imp.ruolo}]</option>\`;
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
        }
        
        // Abilitazioni
        if (lav.abilitazioni && lav.abilitazioni.length > 0) {
          lav.abilitazioni.forEach(ab => {
            aggiungiRigaAbilitazioneLav(ab);
          });
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
  
  div.innerHTML = \`
    <button type="button" onclick="document.getElementById('\${idRiga}').remove()" class="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full w-6 h-6 flex items-center justify-center font-bold text-xs shadow hover:bg-red-600 hover:text-white transition opacity-0 group-hover:opacity-100">&times;</button>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      <div class="lg:col-span-2">
        <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Tipologia Mezzo *</label>
        <select class="lav-ab-tipo w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white" required>
          \${optionsHtml}
        </select>
      </div>
      <div>
        <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Scadenza *</label>
        <input type="date" class="lav-ab-scad w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white" required>
      </div>
      <div class="flex items-end">
        <button type="button" class="w-full bg-slate-100 text-slate-600 px-2 py-1.5 rounded text-xs border border-slate-300" onclick="alert('Upload in FASE 7')">📎 PDF</button>
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
  \`;
  
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
      documentoId: null // FASE 7
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
  if (!form.checkValidity()) {
    form.reportValidity();
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
    
    attestatoFormazione: {
      numero: document.getElementById('lav-formazione-num').value.trim(),
      scadenza: document.getElementById('lav-formazione-scad').value,
      documentoId: null // FASE 7
    },
    
    visitaMedica: {
      ente: document.getElementById('lav-visita-ente').value.trim(),
      data: document.getElementById('lav-visita-data').value,
      scadenza: document.getElementById('lav-visita-scad').value,
      documentoId: null // FASE 7
    },
    
    abilitazioni: raccogliAbilitazioni(),
    
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
      const allDocs = await getAll('documenti');
      const docsLavoratore = allDocs.filter(d => d.entitaCollegataId === lavId);
      for (const doc of docsLavoratore) {
        await deleteItem('documenti', doc.id);
      }
    } catch (e) {
      console.warn("Nessun db 'documenti' ancora inizializzato o errore in cascade", e);
    }
    
    chiudiModalEliminaLavoratore();
    renderLavoratori();
    
    if (typeof mostraToast === 'function') {
      mostraToast("Lavoratore eliminato con successo", "success");
    } else {
      alert("Lavoratore eliminato");
    }
    
  } catch (err) {
    console.error("Errore eliminazione lavoratore:", err);
    alert("Errore durante l'eliminazione.");
  }
}
