// persone-anas.js - Modulo Anagrafica Sicurezza (FASE 4.2)

let currentFiltroAnas = 'Tutti';
let currentOrdinamentoAnas = 'alfabetico'; // 'alfabetico' o 'ruolo'
let anasDaEliminare = null;
let _anasCache = []; // cache locale per evitare double-fetch

// Ordine gerarchico dei ruoli per l'ordinamento
const RUOLI_ORDER = {
  'RUP': 1,
  'DL': 2,
  'RL': 3,
  'CSE_TITOLARE': 4,
  'CSE_DELEGATO': 5,
  'ISPETTORE_CANTIERE': 6,
  'DIRIGENTE': 7,
  'ALTRO': 8
};

// ─────────────────────────────────────────────
// RENDER LISTA ANAS
// ─────────────────────────────────────────────

async function renderAnas(filtroRuolo = null, toggleOrdinamento = false) {
  if (filtroRuolo !== null) currentFiltroAnas = filtroRuolo;
  
  if (toggleOrdinamento) {
    currentOrdinamentoAnas = currentOrdinamentoAnas === 'alfabetico' ? 'ruolo' : 'alfabetico';
  }

  const projectId = sessionStorage.getItem('currentProjectId');
  if (!projectId) return;

  // Aggiorna UI filtri
  document.querySelectorAll('.filter-btn-anas').forEach(btn => {
    btn.classList.remove('active', 'bg-slate-800', 'text-white');
    btn.classList.add('bg-white', 'text-slate-600');
  });
  const btnActive = document.querySelector(`.filter-anas-${currentFiltroAnas}`);
  if (btnActive) {
    btnActive.classList.remove('bg-white', 'text-slate-600');
    btnActive.classList.add('active', 'bg-slate-800', 'text-white');
  }
  const btnSort = document.getElementById('btn-sort-anas');
  if (btnSort) btnSort.textContent = currentOrdinamentoAnas === 'ruolo' ? '⇅ Ordine: Ruolo' : '⇅ Ordine: A→Z';

  const grid = document.getElementById('anas-grid');
  grid.innerHTML = '<div class="col-span-full text-center py-8 text-slate-400">Caricamento personale...</div>';

  try {
    const allAnas = await getByIndex('persone_anas', 'projectId', projectId);
    _anasCache = allAnas;
    
    // Filtro per ruolo
    let filtered = allAnas;
    if (currentFiltroAnas !== 'Tutti') {
      filtered = allAnas.filter(p => p.ruolo === currentFiltroAnas);
    }

    // Ordinamento
    filtered.sort((a, b) => {
      if (currentOrdinamentoAnas === 'ruolo') {
        const orderA = RUOLI_ORDER[a.ruolo] || 99;
        const orderB = RUOLI_ORDER[b.ruolo] || 99;
        if (orderA !== orderB) return orderA - orderB;
        // A parità di ruolo, ordina alfabetico
      }
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
          <div class="text-4xl mb-4">👔</div>
          <h3 class="text-lg font-bold text-slate-700">Nessun personale trovato</h3>
          <p class="text-sm text-slate-500">Aggiungi la prima persona cliccando su "Nuovo".</p>
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
        persona.ruolo === 'RUP' ? 'bg-red-100 text-red-800' :
        persona.ruolo === 'DL' ? 'bg-blue-100 text-blue-800' :
        persona.ruolo === 'RL' ? 'bg-emerald-100 text-emerald-800' :
        persona.ruolo === 'CSE_TITOLARE' || persona.ruolo === 'CSE_DELEGATO' ? 'bg-amber-100 text-amber-800' :
        'bg-slate-100 text-slate-800';

      const ruoloLabel = persona.ruolo === 'CSE_TITOLARE' ? 'CSE Titolare' : 
                         persona.ruolo === 'CSE_DELEGATO' ? 'CSE Delegato' : 
                         persona.ruolo === 'ISPETTORE_CANTIERE' ? 'Ispettore' : persona.ruolo;

      card.innerHTML = `
        <div class="p-4 border-b border-slate-100 flex justify-between items-start gap-2 bg-slate-50/50">
          <div>
            <div class="text-[10px] font-bold px-2 py-0.5 rounded-md mb-2 inline-block uppercase tracking-wider ${badgeClass}">
              ${ruoloLabel}
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
            <span class="w-5 text-center shrink-0">🏢</span>
            <span class="truncate" title="${escapeHtml(persona.strutturaTerritoriale)}">${escapeHtml(persona.strutturaTerritoriale)}</span>
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
          <button onclick="apriModalAnas('${persona.id}')" class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition">
            <span>📝</span> Modifica
          </button>
          <button onclick="confermaEliminaAnas('${persona.id}', '${escapeHtml((persona.nome + ' ' + persona.cognome).replace(/'/g, "\\'"))}')" class="flex items-center justify-center px-3 py-1.5 text-sm font-semibold text-red-600 bg-white border border-red-200 rounded hover:bg-red-50 hover:border-red-300 transition">
            <span>🗑️</span>
          </button>
        </div>
      `;
      fragment.appendChild(card);
    }
    grid.appendChild(fragment);
  } catch (err) {
    console.error("Errore render Sicurezza:", err);
    grid.innerHTML = '<div class="col-span-full text-center text-red-500">Errore nel caricamento del personale di sicurezza.</div>';
  }
}

// ─────────────────────────────────────────────
// MODAL & FORM CREAZIONE/MODIFICA
// ─────────────────────────────────────────────

async function apriModalAnas(id = null) {
  const projectId = sessionStorage.getItem('currentProjectId');
  if (!projectId) return;

  const form = document.getElementById('form-anas');
  form.reset();
  document.getElementById('anas-id').value = '';
  document.getElementById('modal-anas-title').textContent = id ? 'Modifica Persona' : 'Nuova Persona';

  if (id) {
    // Modifica: pre-popola i dati
    try {
      const persona = _anasCache.find(p => p.id === id) || await getItem('persone_anas', id);
      if (persona) {
        document.getElementById('anas-id').value = persona.id;
        document.getElementById('anas-nome').value = persona.nome || '';
        document.getElementById('anas-cognome').value = persona.cognome || '';
        document.getElementById('anas-qualifica').value = persona.qualifica || '';
        document.getElementById('anas-ruolo').value = persona.ruolo || 'ALTRO';
        document.getElementById('anas-matricola').value = persona.matricolaAnas || '';
        document.getElementById('anas-struttura').value = persona.strutturaTerritoriale || '';
        document.getElementById('anas-email').value = persona.email || '';
        document.getElementById('anas-telefono').value = persona.telefono || '';
      }
    } catch (e) {
      console.error(e);
      alert("Impossibile caricare i dati");
      return;
    }
  }

  const modal = document.getElementById('modal-anas');
  modal.classList.remove('page-hidden');
  setTimeout(() => modal.classList.remove('opacity-0'), 10);
}

function chiudiModalAnas() {
  const modal = document.getElementById('modal-anas');
  modal.classList.add('opacity-0');
  setTimeout(() => modal.classList.add('page-hidden'), 300);
}

// ─────────────────────────────────────────────
// SALVATAGGIO
// ─────────────────────────────────────────────

async function salvaAnas(e) {
  e.preventDefault();
  const form = document.getElementById('form-anas');
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const projectId = sessionStorage.getItem('currentProjectId');
  if (!projectId) return;

  const id = document.getElementById('anas-id').value;

  const personaData = {
    id: id || 'pa_' + Date.now(),
    projectId: projectId,
    nome: document.getElementById('anas-nome').value.trim(),
    cognome: document.getElementById('anas-cognome').value.trim(),
    qualifica: document.getElementById('anas-qualifica').value.trim(),
    ruolo: document.getElementById('anas-ruolo').value,
    matricolaAnas: document.getElementById('anas-matricola').value.trim(),
    strutturaTerritoriale: document.getElementById('anas-struttura').value.trim(),
    email: document.getElementById('anas-email').value.trim(),
    telefono: document.getElementById('anas-telefono').value.trim(),
    modifiedAt: new Date().toISOString(),
    modifiedBy: 'Utente' // FASE 8: Auth reale
  };

  try {
    await saveItem('persone_anas', personaData);
    chiudiModalAnas();
    renderAnas();
  } catch (err) {
    console.error("Errore salvataggio persona", err);
    alert("Impossibile salvare i dati");
  }
}

// ─────────────────────────────────────────────
// ELIMINAZIONE
// ─────────────────────────────────────────────

function confermaEliminaAnas(id, nome) {
  anasDaEliminare = id;
  document.getElementById('elimina-anas-nome').textContent = nome;
  
  const modal = document.getElementById('modal-elimina-anas');
  modal.classList.remove('page-hidden');
  setTimeout(() => modal.classList.remove('opacity-0'), 10);
}

function chiudiModalEliminaAnas() {
  anasDaEliminare = null;
  const modal = document.getElementById('modal-elimina-anas');
  modal.classList.add('opacity-0');
  setTimeout(() => modal.classList.add('page-hidden'), 300);
}

async function eseguiEliminaAnas() {
  if (!anasDaEliminare) return;

  try {
    // Guard: blocca se la persona è FK attiva nell'organigramma del cantiere corrente
    const projectId = sessionStorage.getItem('currentProjectId');
    if (projectId) {
      const cantiere = await getItem('projects', projectId);
      if (cantiere) {
        const FK_ETICHETTE = {
          rupId: 'RUP', dlId: 'Direttore Lavori', cseTitolareId: 'CSE Titolare',
          cseDelegatoId: 'CSE Delegato', ispettoreCantiereId: 'Ispettore di Cantiere',
          responsabileLavoriId: 'Responsabile Lavori'
        };
        const ruoloAttivo = Object.keys(FK_ETICHETTE).find(k => cantiere[k] === anasDaEliminare);
        if (ruoloAttivo) {
          showToast(
            `Impossibile eliminare: questa persona è incaricata come ${FK_ETICHETTE[ruoloAttivo]} nel cantiere. Rimuovere l'incarico dall'Anagrafica Cantiere prima di procedere.`,
            'error'
          );
          return;
        }
      }
    }

    // FASE 4.2: Nessun cascade sui verbali (storicità)
    await deleteItem('persone_anas', anasDaEliminare);

    chiudiModalEliminaAnas();
    renderAnas();
    showToast("Persona eliminata con successo", "success");

  } catch (err) {
    console.error("Errore eliminazione:", err);
    showToast("Errore durante l'eliminazione.", "error");
  }
}

// ─────────────────────────────────────────────
// RENDER VIEW — scaffold completo + modali
// ─────────────────────────────────────────────

function renderViewAnas(container) {
  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex justify-between items-center">
        <div>
          <h2 class="text-3xl font-bold text-slate-900">Sicurezza &amp; Personale</h2>
          <p class="text-slate-500 text-sm mt-1">Referenti tecnici e ruoli di coordinamento</p>
        </div>
        <button onclick="apriModalAnas()" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl shadow transition">+ Nuovo</button>
      </div>
      <div class="flex flex-wrap gap-2">
        <button onclick="renderAnas('Tutti')" class="filter-btn-anas filter-anas-Tutti px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 bg-slate-800 text-white transition">Tutti</button>
        <button onclick="renderAnas('RUP')" class="filter-btn-anas filter-anas-RUP px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 bg-white text-slate-600 transition">RUP</button>
        <button onclick="renderAnas('DL')" class="filter-btn-anas filter-anas-DL px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 bg-white text-slate-600 transition">D.L.</button>
        <button onclick="renderAnas('RL')" class="filter-btn-anas filter-anas-RL px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 bg-white text-slate-600 transition">R.L.</button>
        <button onclick="renderAnas('CSE_TITOLARE')" class="filter-btn-anas filter-anas-CSE_TITOLARE px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 bg-white text-slate-600 transition">CSE Titolare</button>
        <button onclick="renderAnas('CSE_DELEGATO')" class="filter-btn-anas filter-anas-CSE_DELEGATO px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 bg-white text-slate-600 transition">CSE Delegato</button>
        <button onclick="renderAnas('ISPETTORE_CANTIERE')" class="filter-btn-anas filter-anas-ISPETTORE_CANTIERE px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 bg-white text-slate-600 transition">Ispettore</button>
        <button id="btn-sort-anas" onclick="renderAnas(null, true)" class="ml-auto px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition" title="Alterna ordinamento alfabetico / per ruolo">⇅ Ordine: A→Z</button>
      </div>
      <div id="anas-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"></div>
    </div>

    <!-- MODAL Nuova/Modifica Persona ANAS -->
    <div id="modal-anas" class="page-hidden opacity-0 fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[2000] flex items-start justify-center p-4 pt-10 transition-opacity duration-300">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div class="p-5 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white z-10">
          <h3 id="modal-anas-title" class="text-xl font-bold text-slate-800">Nuova Persona</h3>
          <button onclick="chiudiModalAnas()" class="text-slate-400 hover:text-slate-800 text-2xl leading-none">&times;</button>
        </div>
        <form id="form-anas" class="p-6 space-y-4">
          <input type="hidden" id="anas-id">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Nome *</label>
              <input type="text" id="anas-nome" required class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Cognome *</label>
              <input type="text" id="anas-cognome" required class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">
            </div>
            <div class="sm:col-span-2">
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Qualifica *</label>
              <input type="text" id="anas-qualifica" required class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400" placeholder="Es. Funzionario Tecnico">
            </div>
            <div class="sm:col-span-2">
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Ruolo *</label>
              <select id="anas-ruolo" required class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-white">
                <option value="RUP">RUP — Responsabile Unico Procedimento</option>
                <option value="DL">DL — Direttore Lavori</option>
                <option value="RL">RL — Responsabile Lavori</option>
                <option value="CSE_TITOLARE">CSE Titolare</option>
                <option value="CSE_DELEGATO">CSE Delegato</option>
                <option value="ISPETTORE_CANTIERE">Ispettore di Cantiere</option>
                <option value="DIRIGENTE">Dirigente</option>
                <option value="ALTRO">Altro</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Matricola</label>
              <input type="text" id="anas-matricola" class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-400" placeholder="Opzionale">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Struttura Territoriale</label>
              <input type="text" id="anas-struttura" class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400" placeholder="Es. Struttura Territoriale">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Email</label>
              <input type="email" id="anas-email" class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Telefono</label>
              <input type="tel" id="anas-telefono" class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">
            </div>
          </div>
          <div class="flex gap-3 pt-3 border-t border-slate-100">
            <button type="button" onclick="chiudiModalAnas()" class="flex-1 py-2.5 rounded-xl font-bold text-slate-500 border border-slate-200 hover:bg-slate-50 transition">Annulla</button>
            <button type="submit" class="flex-1 py-2.5 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 transition shadow">Salva</button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL Elimina Persona ANAS -->
    <div id="modal-elimina-anas" class="page-hidden opacity-0 fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[2100] flex items-center justify-center p-4 transition-opacity duration-300">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h3 class="text-lg font-bold text-slate-800">Elimina Persona</h3>
        <p class="text-sm text-slate-600">Stai per eliminare: <strong id="elimina-anas-nome"></strong></p>
        <div class="flex gap-3 pt-2">
          <button onclick="chiudiModalEliminaAnas()" class="flex-1 py-2.5 rounded-xl font-bold text-slate-500 border border-slate-200 hover:bg-slate-50">Annulla</button>
          <button onclick="eseguiEliminaAnas()" class="flex-1 py-2.5 rounded-xl font-bold bg-red-600 text-white hover:bg-red-700 shadow">Elimina</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('form-anas').addEventListener('submit', salvaAnas);

  renderAnas();
}

window.PersoneAnasModulo = { render: renderViewAnas };
