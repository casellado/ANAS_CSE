// app.js - ANAS SafeHub v3 - SPA entry point

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initDB();
    await renderHome();
    
    // Mostra home se nessun progetto selezionato
    const projId = sessionStorage.getItem('currentProjectId');
    if (projId) {
      entraCantiere(projId); // Simulazione navigazione SPA (FASE 3)
    } else {
      mostraHome();
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
      const ncList = await getAllByIndex('nc', 'projectId', p.id);
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
    card.className = "bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-lg transition flex flex-col h-full relative";
    card.innerHTML = `
      <div class="absolute top-4 right-4 text-slate-300 hover:text-slate-600 cursor-pointer" onclick="event.stopPropagation(); alert('Menu contestuale (Modifica/Elimina cantiere)');">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
      </div>
      <div class="font-mono text-xs font-bold text-slate-400 mb-1 tracking-wider">${escapeHtml(p.id)}</div>
      <h3 class="font-extrabold text-lg leading-tight text-slate-800 mb-4 flex-1 pr-6">${escapeHtml(p.nome)}</h3>
      
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
// NAVIGAZIONE SPA BASE (FASE 3 - INCOMPLETA)
// ─────────────────────────────────────────────

function entraCantiere(projectId) {
  sessionStorage.setItem('currentProjectId', projectId);
  
  // Nascondi home
  document.getElementById('home-view').classList.add('page-hidden');
  // Mostra cantiere
  document.getElementById('cantiere-view').classList.remove('page-hidden');
  
  document.getElementById('cantiere-title').textContent = "Cantiere: " + projectId;
  
  // Temporaneo alert come prova (per FASE 2 / FASE 3 in arrivo)
  console.log("Entrato in", projectId);
}

function tornaHome() {
  sessionStorage.removeItem('currentProjectId');
  mostraHome();
}

function mostraHome() {
  document.getElementById('cantiere-view').classList.add('page-hidden');
  document.getElementById('home-view').classList.remove('page-hidden');
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
