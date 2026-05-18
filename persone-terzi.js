// persone-terzi.js - Modulo Anagrafica Enti Terzi (FASE 4.3)

let currentFiltroTerzi = 'Tutti';
let terziDaEliminare = null;
let _terziCache = [];       // cache locale per evitare double-fetch
let _terziRendering = false; // lock anti race-condition sui filtri

// ─────────────────────────────────────────────
// RENDER LISTA TERZI
// ─────────────────────────────────────────────

async function renderTerzi(filtroTipo = null) {
  if (filtroTipo !== null) currentFiltroTerzi = filtroTipo;

  const projectId = sessionStorage.getItem('currentProjectId');
  if (!projectId) {
    showToast('Sessione cantiere scaduta. Torna alla dashboard e riseleziona il cantiere.', 'error');
    setTimeout(() => { window.location.href = 'index.html'; }, 1500);
    return;
  }

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

  if (_terziRendering) return;
  _terziRendering = true;

  const grid = document.getElementById('terzi-grid');
  grid.innerHTML = '<div class="col-span-full text-center py-8 text-slate-400">Caricamento enti terzi...</div>';

  try {
    const allTerzi = await getByIndex('persone_terzi', 'projectId', projectId);
    _terziCache = allTerzi;
    
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
    const fragment = document.createDocumentFragment();

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
      fragment.appendChild(card);
    }
    grid.appendChild(fragment);
  } catch (err) {
    console.error("Errore render Terzi:", err);
    grid.innerHTML = '<div class="col-span-full text-center text-red-500">Errore nel caricamento dei dati.</div>';
  } finally {
    _terziRendering = false;
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
      const persona = _terziCache.find(t => t.id === id) || await getItem('persone_terzi', id);
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
    showToast("Persona eliminata con successo", "success");

  } catch (err) {
    console.error("Errore eliminazione:", err);
    showToast("Errore durante l'eliminazione.", "error");
  }
}

// ─────────────────────────────────────────────
// RENDER VIEW — scaffold completo + modali
// ─────────────────────────────────────────────

function renderViewTerzi(container) {
  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex justify-between items-center">
        <div>
          <h2 class="text-3xl font-bold text-slate-900">Enti Terzi</h2>
          <p class="text-slate-500 text-sm mt-1">Autorità e consulenti esterni al cantiere</p>
        </div>
        <button onclick="apriModalTerzi()" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl shadow transition">+ Nuovo</button>
      </div>
      <div class="flex flex-wrap gap-2">
        <button onclick="renderTerzi('Tutti')" class="filter-btn-terzi filter-terzi-Tutti px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 bg-slate-800 text-white transition">Tutti</button>
        <button onclick="renderTerzi('SPRESAL')" class="filter-btn-terzi filter-terzi-SPRESAL px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 bg-white text-slate-600 transition">Spresal / ASL</button>
        <button onclick="renderTerzi('VVF')" class="filter-btn-terzi filter-terzi-VVF px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 bg-white text-slate-600 transition">VVF</button>
        <button onclick="renderTerzi('PROVINCIA')" class="filter-btn-terzi filter-terzi-PROVINCIA px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 bg-white text-slate-600 transition">Provincia</button>
        <button onclick="renderTerzi('CONSULENTE')" class="filter-btn-terzi filter-terzi-CONSULENTE px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 bg-white text-slate-600 transition">Consulente</button>
        <button onclick="renderTerzi('ALTRO')" class="filter-btn-terzi filter-terzi-ALTRO px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 bg-white text-slate-600 transition">Altro</button>
      </div>
      <div id="terzi-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"></div>
    </div>

    <!-- MODAL Nuova/Modifica Persona Terza -->
    <div id="modal-terzi" class="page-hidden opacity-0 fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[2000] flex items-start justify-center p-4 pt-10 transition-opacity duration-300">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div class="p-5 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white z-10">
          <h3 id="modal-terzi-title" class="text-xl font-bold text-slate-800">Nuova Persona Terza</h3>
          <button onclick="chiudiModalTerzi()" class="text-slate-400 hover:text-slate-800 text-2xl leading-none">&times;</button>
        </div>
        <form id="form-terzi" class="p-6 space-y-4">
          <input type="hidden" id="terzi-id">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Nome *</label>
              <input type="text" id="terzi-nome" required class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Cognome *</label>
              <input type="text" id="terzi-cognome" required class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">
            </div>
            <div class="sm:col-span-2">
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Qualifica</label>
              <input type="text" id="terzi-qualifica" class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400" placeholder="Es. Ispettore Tecnico">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Tipo Ente *</label>
              <select id="terzi-tipoente" required class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-white">
                <option value="SPRESAL">Spresal / ASP</option>
                <option value="VVF">Vigili del Fuoco</option>
                <option value="PROVINCIA">Provincia / Comune</option>
                <option value="CONSULENTE">Consulente esterno</option>
                <option value="ALTRO">Altro</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Nome Ente *</label>
              <input type="text" id="terzi-ente" required class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400" placeholder="Es. Spresal ASP Catanzaro">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Email</label>
              <input type="email" id="terzi-email" class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Telefono</label>
              <input type="tel" id="terzi-telefono" class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">
            </div>
          </div>
          <div class="flex gap-3 pt-3 border-t border-slate-100">
            <button type="button" onclick="chiudiModalTerzi()" class="flex-1 py-2.5 rounded-xl font-bold text-slate-500 border border-slate-200 hover:bg-slate-50 transition">Annulla</button>
            <button type="submit" class="flex-1 py-2.5 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 transition shadow">Salva</button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL Elimina Persona Terza -->
    <div id="modal-elimina-terzi" class="page-hidden opacity-0 fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[2100] flex items-center justify-center p-4 transition-opacity duration-300">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h3 class="text-lg font-bold text-slate-800">Elimina Persona Terza</h3>
        <p class="text-sm text-slate-600">Stai per eliminare: <strong id="elimina-terzi-nome"></strong></p>
        <div class="flex gap-3 pt-2">
          <button onclick="chiudiModalEliminaTerzi()" class="flex-1 py-2.5 rounded-xl font-bold text-slate-500 border border-slate-200 hover:bg-slate-50">Annulla</button>
          <button onclick="eseguiEliminaTerzi()" class="flex-1 py-2.5 rounded-xl font-bold bg-red-600 text-white hover:bg-red-700 shadow">Elimina</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('form-terzi').addEventListener('submit', salvaTerzi);

  renderTerzi();
}

window.PersoneTerziModulo = { render: renderViewTerzi };
