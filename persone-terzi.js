// persone-terzi.js - Modulo Anagrafica Enti Terzi (FASE 4.3)

let currentFiltroTerzi = 'Tutti';
let terziDaEliminare = null;

// ─────────────────────────────────────────────
// RENDER LISTA TERZI
// ─────────────────────────────────────────────

async function renderTerzi(filtroTipo = null) {
  if (filtroTipo !== null) currentFiltroTerzi = filtroTipo;

  const projectId = sessionStorage.getItem('currentProjectId');
  if (!projectId) return;

  // Aggiorna UI filtri
  document.querySelectorAll('.filter-btn-terzi').forEach(btn => {
    btn.classList.remove('active', 'bg-slate-800', 'text-white');
    btn.classList.add('bg-white', 'text-slate-600');
  });
  const btnActive = document.querySelector(`.filter-terzi-${currentFiltroTerzi}`);
  if (btnActive) {
    btnActive.classList.remove('bg-white', 'text-slate-600');
    btnActive.classList.add('active', 'bg-slate-800', 'text-white');
  }

  const grid = document.getElementById('terzi-grid');
  grid.innerHTML = '<div class="col-span-full text-center py-8 text-slate-400">Caricamento enti terzi...</div>';

  try {
    const allTerzi = await getByIndex('persone_terzi', 'projectId', projectId);
    
    // Filtro per tipoEnte
    let filtered = allTerzi;
    if (currentFiltroTerzi !== 'Tutti') {
      filtered = allTerzi.filter(p => p.tipoEnte === currentFiltroTerzi);
    }

    // Ordinamento: alfabetico per cognome
    filtered.sort((a, b) => {
      const cognomeA = (a.cognome || '').toLowerCase();
      const cognomeB = (b.cognome || '').toLowerCase();
      if (cognomeA !== cognomeB) return cognomeA.localeCompare(cognomeB);
      
      const nomeA = (a.nome || '').toLowerCase();
      const nomeB = (b.nome || '').toLowerCase();
      return nomeA.localeCompare(nomeB);
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full bg-white rounded-xl shadow-sm p-8 text-center border border-slate-200">
          <div class="text-4xl mb-4">🏢</div>
          <h3 class="text-lg font-bold text-slate-700">Nessun ente terzo trovato</h3>
          <p class="text-sm text-slate-500">Aggiungi il primo ente cliccando su "Nuovo".</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = '';
    
    for (const persona of filtered) {
      const card = document.createElement('div');
      card.className = "bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col hover:shadow-md transition overflow-hidden";
      
      // Badge mapping
      const badgeClass = 
        persona.tipoEnte === 'SPRESAL' ? 'bg-red-100 text-red-800' :
        persona.tipoEnte === 'VVF' ? 'bg-orange-100 text-orange-800' :
        persona.tipoEnte === 'PROVINCIA' ? 'bg-blue-100 text-blue-800' :
        persona.tipoEnte === 'CONSULENTE' ? 'bg-purple-100 text-purple-800' :
        'bg-slate-100 text-slate-800';

      card.innerHTML = `
        <div class="p-4 border-b border-slate-100 flex justify-between items-start gap-2 bg-slate-50/50">
          <div>
            <div class="text-[10px] font-bold px-2 py-0.5 rounded-md mb-2 inline-block uppercase tracking-wider ${badgeClass}">
              ${persona.tipoEnte}
            </div>
            <h4 class="font-bold text-slate-800 text-lg leading-tight line-clamp-1" title="${escapeHtml(persona.nome)} ${escapeHtml(persona.cognome)}">
              ${escapeHtml(persona.nome)} ${escapeHtml(persona.cognome)}
            </h4>
          </div>
        </div>
        <div class="p-4 flex-1 space-y-2 text-sm text-slate-600">
          <div class="flex items-start gap-2">
            <span class="w-5 text-center shrink-0">📌</span>
            <span class="truncate font-medium text-slate-700" title="${escapeHtml(persona.qualifica)}">${escapeHtml(persona.qualifica)}</span>
          </div>
          <div class="flex items-start gap-2">
            <span class="w-5 text-center shrink-0">🏛️</span>
            <span class="truncate" title="${escapeHtml(persona.ente)}"><strong>Ente:</strong> ${escapeHtml(persona.ente)}</span>
          </div>
          ${persona.email ? `
            <div class="flex items-start gap-2 mt-2">
              <span class="w-5 text-center shrink-0">✉️</span>
              <a href="mailto:${escapeHtml(persona.email)}" class="truncate text-blue-600 hover:underline">${escapeHtml(persona.email)}</a>
            </div>
          ` : ''}
          ${persona.telefono ? `
            <div class="flex items-start gap-2 mt-1">
              <span class="w-5 text-center shrink-0">📞</span>
              <a href="tel:${escapeHtml(persona.telefono)}" class="truncate text-blue-600 hover:underline">${escapeHtml(persona.telefono)}</a>
            </div>
          ` : ''}
        </div>
        <div class="p-3 border-t border-slate-100 bg-slate-50 flex gap-2 shrink-0">
          <button onclick="apriModalTerzi('${persona.id}')" class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition">
            <span>📝</span> Modifica
          </button>
          <button onclick="confermaEliminaTerzi('${persona.id}', '${escapeHtml((persona.nome + ' ' + persona.cognome).replace(/'/g, "\\'"))}')" class="flex items-center justify-center px-3 py-1.5 text-sm font-semibold text-red-600 bg-white border border-red-200 rounded hover:bg-red-50 hover:border-red-300 transition">
            <span>🗑️</span>
          </button>
        </div>
      `;
      grid.appendChild(card);
    }
  } catch (err) {
    console.error("Errore render Terzi:", err);
    grid.innerHTML = '<div class="col-span-full text-center text-red-500">Errore nel caricamento dei dati.</div>';
  }
}

// ─────────────────────────────────────────────
// MODAL & FORM CREAZIONE/MODIFICA
// ─────────────────────────────────────────────

async function apriModalTerzi(id = null) {
  const projectId = sessionStorage.getItem('currentProjectId');
  if (!projectId) return;

  const form = document.getElementById('form-terzi');
  form.reset();
  document.getElementById('terzi-id').value = '';
  document.getElementById('modal-terzi-title').textContent = id ? 'Modifica Persona Terza' : 'Nuova Persona Terza';

  if (id) {
    // Modifica: pre-popola i dati
    try {
      const persona = await getItem('persone_terzi', id);
      if (persona) {
        document.getElementById('terzi-id').value = persona.id;
        document.getElementById('terzi-nome').value = persona.nome || '';
        document.getElementById('terzi-cognome').value = persona.cognome || '';
        document.getElementById('terzi-qualifica').value = persona.qualifica || '';
        document.getElementById('terzi-tipoente').value = persona.tipoEnte || 'ALTRO';
        document.getElementById('terzi-ente').value = persona.ente || '';
        document.getElementById('terzi-email').value = persona.email || '';
        document.getElementById('terzi-telefono').value = persona.telefono || '';
      }
    } catch (e) {
      console.error(e);
      alert("Impossibile caricare i dati");
      return;
    }
  }

  const modal = document.getElementById('modal-terzi');
  modal.classList.remove('page-hidden');
  setTimeout(() => modal.classList.remove('opacity-0'), 10);
}

function chiudiModalTerzi() {
  const modal = document.getElementById('modal-terzi');
  modal.classList.add('opacity-0');
  setTimeout(() => modal.classList.add('page-hidden'), 300);
}

// ─────────────────────────────────────────────
// SALVATAGGIO
// ─────────────────────────────────────────────

async function salvaTerzi(e) {
  e.preventDefault();
  const form = document.getElementById('form-terzi');
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const projectId = sessionStorage.getItem('currentProjectId');
  if (!projectId) return;

  const id = document.getElementById('terzi-id').value;

  const personaData = {
    id: id || 'pt_' + Date.now(),
    projectId: projectId,
    nome: document.getElementById('terzi-nome').value.trim(),
    cognome: document.getElementById('terzi-cognome').value.trim(),
    qualifica: document.getElementById('terzi-qualifica').value.trim(),
    tipoEnte: document.getElementById('terzi-tipoente').value,
    ente: document.getElementById('terzi-ente').value.trim(),
    email: document.getElementById('terzi-email').value.trim(),
    telefono: document.getElementById('terzi-telefono').value.trim(),
    modifiedAt: new Date().toISOString(),
    modifiedBy: 'Utente' // FASE 8: Auth reale
  };

  try {
    await saveItem('persone_terzi', personaData);
    chiudiModalTerzi();
    renderTerzi();
  } catch (err) {
    console.error("Errore salvataggio persona terzi", err);
    alert("Impossibile salvare i dati");
  }
}

// ─────────────────────────────────────────────
// ELIMINAZIONE
// ─────────────────────────────────────────────

function confermaEliminaTerzi(id, nome) {
  terziDaEliminare = id;
  document.getElementById('elimina-terzi-nome').textContent = nome;
  
  const modal = document.getElementById('modal-elimina-terzi');
  modal.classList.remove('page-hidden');
  setTimeout(() => modal.classList.remove('opacity-0'), 10);
}

function chiudiModalEliminaTerzi() {
  terziDaEliminare = null;
  const modal = document.getElementById('modal-elimina-terzi');
  modal.classList.add('opacity-0');
  setTimeout(() => modal.classList.add('page-hidden'), 300);
}

async function eseguiEliminaTerzi() {
  if (!terziDaEliminare) return;
  
  try {
    // FASE 4.3: Nessun cascade sui verbali (storicità)
    await deleteItem('persone_terzi', terziDaEliminare);
    
    chiudiModalEliminaTerzi();
    renderTerzi();
    
    if (typeof mostraToast === 'function') {
      mostraToast("Persona eliminata con successo", "success");
    } else {
      alert("Persona eliminata con successo");
    }
    
  } catch (err) {
    console.error("Errore eliminazione:", err);
    alert("Errore durante l'eliminazione.");
  }
}
