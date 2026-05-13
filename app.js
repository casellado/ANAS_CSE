// app.js - ANAS SafeHub v3 - SPA entry point

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initDB();
    await renderHome();
    
    // Ripristino contesto SPA
    const projId = sessionStorage.getItem('currentProjectId');
    if (projId) {
      await caricaContestoCantiere(projId);
    } else {
      // Home è visibile di default
    }
  } catch (err) {
    console.error("Errore inizializzazione DB", err);
    alert("Errore avvio: " + err);
  }
});

// ─────────────────────────────────────────────
// VISTA HOME: I MIEI CANTIERI (FASE 2)
// ─────────────────────────────────────────────

async function renderHome() {
  const grid = document.getElementById('projects-grid');
  if (!grid) return;
  
  const projects = await getAll('projects');
  
  if (projects.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full text-center py-12 text-slate-500 bg-white border border-slate-200 rounded-xl shadow-sm">
        <div class="text-4xl mb-3">🚧</div>
        <h3 class="text-lg font-bold text-slate-700">Nessun cantiere presente</h3>
        <p class="text-sm">Inizia creando il tuo primo cantiere dal pulsante in alto.</p>
      </div>
    `;
    return;
  }
  
  grid.innerHTML = '';
  
  for (const p of projects) {
    // Recupera numero NC aperte
    let ncAperte = 0;
    try {
      const ncList = await getByIndex('nc', 'projectId', p.id);
      ncAperte = ncList.filter(nc => nc.stato !== 'chiusa').length;
    } catch (e) {
      // Ignore if store not fully ready
    }
    
    // Status visual
    let statIcon = '🟢';
    let statColor = 'text-green-700 bg-green-50 border-green-200';
    let statText = 'Attivo';
    
    if (p.stato === 'sospeso') {
      statIcon = '🟡';
      statColor = 'text-yellow-700 bg-yellow-50 border-yellow-200';
      statText = 'Sospeso';
    } else if (p.stato === 'chiuso') {
      statIcon = '🔴';
      statColor = 'text-red-700 bg-red-50 border-red-200';
      statText = 'Chiuso';
    }
    
    const card = document.createElement('div');
    card.className = "bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-lg transition flex flex-col h-full relative group";
    card.innerHTML = `
      <div class="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onclick="event.stopPropagation(); typeof apriModalModificaCantiere === 'function' ? apriModalModificaCantiere('${escapeHtml(p.id)}') : alert('Modal modifica non ancora migrato')" class="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Modifica">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
        </button>
        <button onclick="event.stopPropagation(); if(confirm('Vuoi eliminare il cantiere ${escapeHtml(p.nome)}?')) { typeof eliminaCantiere === 'function' ? eliminaCantiere('${escapeHtml(p.id)}') : alert('Funzione eliminaCantiere non trovata'); if(typeof renderHome === 'function') setTimeout(renderHome, 500); }" class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded" title="Elimina">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
        </button>
      </div>
      <div class="font-mono text-xs font-bold text-slate-400 mb-1 tracking-wider">${escapeHtml(p.id)}</div>
      <h3 class="font-extrabold text-lg leading-tight text-slate-800 mb-4 flex-1 pr-16">${escapeHtml(p.nome)}</h3>
      
      <div class="flex items-center gap-2 mb-6">
        <span class="inline-flex items-center gap-1 border px-2 py-0.5 rounded-md text-[10px] uppercase font-bold tracking-widest ${statColor}">
          ${statIcon} ${statText}
        </span>
        ${ncAperte > 0 
          ? `<span class="inline-flex items-center text-[10px] uppercase tracking-widest font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">${ncAperte} NC aperte</span>` 
          : `<span class="inline-flex items-center text-[10px] uppercase tracking-widest font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">0 NC aperte</span>`}
      </div>
      
      <button onclick="entraCantiere('${escapeHtml(p.id)}')" class="w-full bg-slate-100 hover:bg-blue-600 hover:text-white text-blue-600 border border-slate-200 hover:border-blue-600 font-bold py-2.5 rounded-xl text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2">
        ENTRA <span class="text-lg leading-none mb-0.5">→</span>
      </button>
    `;
    grid.appendChild(card);
  }
}

function apriModalNuovoCantiere() {
  document.getElementById('modal-new-project').classList.remove('hidden');
  document.getElementById('new-project-id').value = '';
  document.getElementById('new-project-name').value = '';
  document.getElementById('new-project-id').focus();
}

function chiudiModalNuovoCantiere() {
  document.getElementById('modal-new-project').classList.add('hidden');
}

async function salvaNuovoCantiere() {
  const idInput = document.getElementById('new-project-id').value.trim().toUpperCase();
  const nameInput = document.getElementById('new-project-name').value.trim();
  
  if (!/^[A-Z0-9_\-]+$/.test(idInput)) {
    alert("Codice non valido. Usa solo lettere maiuscole, numeri, trattini e underscore.");
    return;
  }
  
  if (!nameInput) {
    alert("Inserisci il nome del cantiere.");
    return;
  }
  
  const existing = await getItem('projects', idInput);
  if (existing) {
    alert("Esiste già un cantiere con questo codice.");
    return;
  }
  
  const newProject = {
    id: idInput,
    nome: nameInput,
    localizzazione: '',
    dataInizio: new Date().toISOString().split('T')[0],
    dataFinePrevista: '',
    stato: 'attivo',
    modifiedAt: new Date().toISOString(),
    modifiedBy: 'Utente'
  };
  
  await saveItem('projects', newProject);
  chiudiModalNuovoCantiere();
  await renderHome();
}

// ─────────────────────────────────────────────
// NAVIGAZIONE SPA CANTIERE (FASE 3)
// ─────────────────────────────────────────────

async function entraCantiere(projectId) {
  sessionStorage.setItem('currentProjectId', projectId);
  await caricaContestoCantiere(projectId);
}

async function caricaContestoCantiere(projectId) {
  try {
    const project = await getItem('projects', projectId);
    if (!project) {
      alert("Cantiere non trovato!");
      return tornaHome();
    }
    
    // Mostra topbar cantiere, nascondi topbar home
    document.getElementById('home-topbar').classList.add('page-hidden');
    document.getElementById('cantiere-topbar').classList.remove('page-hidden');
    
    // Aggiorna intestazione
    document.getElementById('topbar-cantiere-title').textContent = "Cantiere: " + project.id + " - " + project.nome;
    
    // Passa alla view
    document.getElementById('home-view').classList.add('page-hidden');
    document.getElementById('cantiere-view').classList.remove('page-hidden');
    
    // Inizializza Dashboard
    await mostraViewCantiere('dashboard');
    
  } catch (err) {
    console.error(err);
    alert("Errore nel caricamento del cantiere.");
    tornaHome();
  }
}

async function mostraViewCantiere(viewName, faseAttesa = null) {
  const projectId = sessionStorage.getItem('currentProjectId');
  if (!projectId) return tornaHome();
  
  // 1. Reset bottoni nav
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('text-white', 'bg-slate-700', 'shadow-inner');
    btn.classList.add('hover:bg-slate-700', 'hover:text-white');
    if (btn.dataset.view === viewName) {
      btn.classList.remove('hover:bg-slate-700', 'hover:text-white');
      btn.classList.add('text-white', 'bg-slate-700', 'shadow-inner');
    }
  });

  // 2. Nascondi tutte le sub-view
  document.querySelectorAll('.cantiere-subview').forEach(v => v.classList.add('page-hidden'));
  
  // 3. Mostra view richiesta o placeholder
  const viewEl = document.getElementById('view-' + viewName);
  if (viewEl) {
    viewEl.classList.remove('page-hidden');
    // Genera dati specifici
    if (viewName === 'dashboard') {
      await generaDashboardKPI(projectId);
    } else if (viewName === 'imprese') {
      if (typeof renderImprese === 'function') {
        await renderImprese('Tutte');
      }
    } else if (viewName === 'anas') {
      if (typeof renderAnas === 'function') {
        await renderAnas('Tutti');
      }
    }
  } else {
    // Fallback al placeholder per view non ancora implementate
    const placeholder = document.getElementById('view-placeholder');
    placeholder.classList.remove('page-hidden');
    
    // Titolo formattato (es. ods_inviati -> ODS Inviati)
    const title = viewName.toUpperCase().replace('_', ' ');
    document.getElementById('placeholder-title').textContent = title;
    
    // Update FASE
    if (faseAttesa) {
      document.getElementById('placeholder-fase').textContent = "Implementazione prevista in FASE " + faseAttesa;
    } else {
      document.getElementById('placeholder-fase').textContent = "Sezione in refactoring";
    }
  }
}

async function generaDashboardKPI(projectId) {
  const grid = document.getElementById('kpi-grid');
  const alertsContainer = document.getElementById('kpi-alerts-container');
  grid.innerHTML = '<div class="col-span-full text-center text-slate-400 py-8">Caricamento indicatori...</div>';
  alertsContainer.innerHTML = '';
  
  try {
    // Fetch asincrono parallelo dai vari store FASE 1
    const [
      ncs, verbali, odsInv, imprese, lavs, mezzi, docF
    ] = await Promise.all([
      getByIndex('nc', 'projectId', projectId).catch(() => []),
      getByIndex('verbali', 'projectId', projectId).catch(() => []),
      getByIndex('ods_inviati', 'projectId', projectId).catch(() => []),
      getByIndex('imprese', 'projectId', projectId).catch(() => []),
      getByIndex('lavoratori', 'projectId', projectId).catch(() => []),
      getByIndex('mezzi', 'projectId', projectId).catch(() => []),
      getByIndex('doc_fondamentali', 'projectId', projectId).catch(() => [])
    ]);

    // Calcoli NC
    const ncAperteList = ncs.filter(n => n.stato !== 'chiusa');
    const ncAperte = ncAperteList.length;
    const ncScadute = ncAperteList.filter(n => n.scadenza && new Date(n.scadenza) < new Date()).length;
    const ncChiuse = ncs.length - ncAperte;
    
    // Calcoli temporali (mese corrente)
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const verbaliMese = verbali.filter(v => {
      // Verbali di sopralluogo del mese
      if (v.tipo !== 'sopralluogo' && !v.tipo) return true; // assumiamo default sopralluogo per ora
      if (!v.data) return false;
      const d = new Date(v.data);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).length;
    
    // Mezzi in cantiere
    const mezziPresenti = mezzi.filter(m => m.presenteInCantiere === true || m.presenteInCantiere === 'true' || m.presenteInCantiere === 1).length;

    // Doc fondamentali
    const docValidi = docF.filter(d => d.stato === 'valido').length;
    const docScadutiList = docF.filter(d => d.scadenza && new Date(d.scadenza) < new Date() && d.stato !== 'valido');

    // Rendering KPI Cards
    grid.innerHTML = `
      ${createKPICard('Non Conformità', `${ncAperte} aperte / ${ncScadute} scad. / ${ncChiuse} chiuse`, ncScadute > 0 ? 'bg-red-50 border-red-200 text-red-700' : (ncAperte > 0 ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-white'))}
      ${createKPICard('Verbali (mese)', verbaliMese, 'bg-white')}
      ${createKPICard('Imprese', imprese.length, 'bg-white')}
      ${createKPICard('Lavoratori', lavs.length, 'bg-white')}
      ${createKPICard('Mezzi', mezziPresenti, 'bg-white')}
      ${createKPICard('Doc. Fondamentali', `${docValidi} validi / ${docF.length} totali`, docValidi < docF.length ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-green-50 border-green-200 text-green-700')}
    `;
    
    // Rendering Alerts
    if (ncScadute > 0) {
      alertsContainer.innerHTML += `
        <div class="bg-red-100 border border-red-300 text-red-800 p-4 rounded-xl flex items-center gap-3 shadow-sm">
          <span class="text-2xl">🚨</span>
          <div>
            <div class="font-bold">Attenzione: NC in Scadenza</div>
            <div class="text-sm">Ci sono ${ncScadute} Non Conformità scadute e non ancora chiuse.</div>
          </div>
        </div>
      `;
    }
    
    if (docScadutiList.length > 0) {
      alertsContainer.innerHTML += `
        <div class="bg-orange-100 border border-orange-300 text-orange-800 p-4 rounded-xl flex items-center gap-3 shadow-sm">
          <span class="text-2xl">⚠️</span>
          <div>
            <div class="font-bold">Attenzione: Documenti in Scadenza</div>
            <div class="text-sm">Ci sono ${docScadutiList.length} documenti fondamentali scaduti o in scadenza imminente.</div>
          </div>
        </div>
      `;
    }
    
  } catch (err) {
    console.error("Errore generazione KPI:", err);
    grid.innerHTML = '<div class="col-span-full text-center text-red-500 py-8">Errore caricamento indicatori.</div>';
  }
}

function createKPICard(label, value, colorClass = "bg-white") {
  return `
    <div class="border border-slate-200 rounded-xl p-4 shadow-sm ${colorClass}">
      <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">${label}</div>
      <div class="text-2xl font-extrabold text-slate-800">${value}</div>
    </div>
  `;
}

function tornaHome() {
  sessionStorage.removeItem('currentProjectId');
  document.getElementById('cantiere-view').classList.add('page-hidden');
  document.getElementById('home-view').classList.remove('page-hidden');
  document.getElementById('cantiere-topbar').classList.add('page-hidden');
  document.getElementById('home-topbar').classList.remove('page-hidden');
  renderHome();
}

// ─────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}
