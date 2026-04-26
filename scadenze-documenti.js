// scadenze-documenti.js - Sistema scadenze documentali ANAS SafeHub

// ─────────────────────────────────────────────
// 1. Calcola stato scadenza
// ─────────────────────────────────────────────
function calcolaStatoScadenza(doc) {
  if (!doc.dataScadenza) return 'nessuna';

  const oggi     = new Date();
  const scadenza = new Date(doc.dataScadenza);

  if (scadenza < oggi)                              return 'scaduto';
  if ((scadenza - oggi) / (1000 * 60 * 60 * 24) <= 30) return 'in-scadenza';
  return 'valido';
}

// ─────────────────────────────────────────────
// 2. Recupera documenti con scadenza
// ─────────────────────────────────────────────
async function getDocumentiConScadenza() {
  const allDocs = [];
  
  // 1. Documenti fisici (file caricati)
  try {
    const docs = await getDocumenti();
    allDocs.push(...docs.filter(d => d.dataScadenza).map(d => ({
      ...d,
      tipoOrigine: 'file'
    })));
  } catch (_) {}

  // 2. Scadenze DURC (dalle imprese assegnate al cantiere)
  const currentProject = window.appState?.currentProject;
  if (currentProject) {
    try {
      const assegnazioni = await getAll('imprese_cantieri');
      const impreseLotto = assegnazioni.filter(a => a.projectId === currentProject).map(a => a.impresaId);
      const tutteImprese = await getAll('imprese');
      
      tutteImprese.filter(i => impreseLotto.includes(i.id) && i.scadenzaDurc).forEach(i => {
        allDocs.push({
          id: `durc-${i.id}`,
          nome: `DURC: ${i.nome}`,
          dataScadenza: i.scadenzaDurc,
          tipoOrigine: 'impresa',
          link: `apriSchedaImpresa('${i.id}')`
        });
      });
    } catch (_) {}

    // 3. Scadenze Visite Mediche (dai lavoratori delle imprese del cantiere)
    try {
      const tuttiLav = await getAll('lavoratori');
      const assegnazioni = await getAll('imprese_cantieri');
      const impreseLotto = assegnazioni.filter(a => a.projectId === currentProject).map(a => a.impresaId);

      tuttiLav.filter(l => impreseLotto.includes(l.impresaId) && l.scadenzaIdoneita).forEach(l => {
        allDocs.push({
          id: `visita-${l.id}`,
          nome: `Idoneità: ${l.nome} ${l.cognome}`,
          dataScadenza: l.scadenzaIdoneita,
          tipoOrigine: 'lavoratore',
          link: `apriSchedaLavoratore('${l.id}')`
        });
      });
    } catch (_) {}
  }

  return allDocs;
}

// ─────────────────────────────────────────────
// 3. KPI scadenze documentali
// ─────────────────────────────────────────────
async function calcolaKPIscadenze() {
  const docs = await getDocumentiConScadenza();
  const kpi  = { scaduti: 0, inScadenza: 0, validi: 0 };

  docs.forEach(doc => {
    const stato = calcolaStatoScadenza(doc);
    if (stato === 'scaduto')      kpi.scaduti++;
    else if (stato === 'in-scadenza') kpi.inScadenza++;
    else if (stato === 'valido')  kpi.validi++;
  });

  return kpi;
}

// ─────────────────────────────────────────────
// 4. Rendering KPI scadenze
// ─────────────────────────────────────────────
async function renderKPIscadenze() {
  const kpi = await calcolaKPIscadenze();

  const elScaduti    = document.getElementById('kpi-doc-scaduti');
  const elInScadenza = document.getElementById('kpi-doc-in-scadenza');
  const elValidi     = document.getElementById('kpi-doc-validi');

  if (elScaduti)    elScaduti.textContent    = kpi.scaduti;
  if (elInScadenza) elInScadenza.textContent = kpi.inScadenza;
  if (elValidi)     elValidi.textContent     = kpi.validi;
}

// ─────────────────────────────────────────────
// 5. Rendering lista scadenze
// ─────────────────────────────────────────────
async function renderListaScadenze(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const docs     = await getDocumentiConScadenza();
  const ordinati = docs.sort((a, b) => new Date(a.dataScadenza) - new Date(b.dataScadenza));

  if (ordinati.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 italic">Nessun documento con scadenza impostata.</p>`;
    return;
  }

  const colori = {
    'scaduto':     'bg-red-50 border-red-300',
    'in-scadenza': 'bg-yellow-50 border-yellow-300',
    'valido':      'bg-green-50 border-green-300',
    'nessuna':     'bg-slate-50 border-slate-200'
  };

  container.innerHTML = ordinati.map(doc => {
    const stato  = calcolaStatoScadenza(doc);
    const classe = colori[stato] || colori.nessuna;
    
    let icona = '📄';
    if (doc.tipoOrigine === 'impresa') icona = '🏢';
    if (doc.tipoOrigine === 'lavoratore') icona = '👷';

    const action = doc.link ? doc.link : `mostraPreviewDocumento('${doc.id}')`;

    return `
      <div class="p-3 rounded-lg border ${classe} flex justify-between items-center mb-2 shadow-sm transition-all hover:scale-[1.01]">
        <div class="flex items-center gap-3">
          <div class="text-xl">${icona}</div>
          <div>
            <div class="font-bold text-slate-800 text-sm">${doc.nome}</div>
            <div class="text-[10px] uppercase tracking-wider font-bold ${stato === 'scaduto' ? 'text-red-600' : 'text-slate-500'}">
              Scadenza: ${new Date(doc.dataScadenza).toLocaleDateString('it-IT')}
            </div>
          </div>
        </div>
        <button onclick="${action}"
                class="text-xs bg-slate-800 text-white px-3 py-1.5 rounded-lg font-semibold
                       hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
                aria-label="Gestisci ${doc.nome}">
          Vedi →
        </button>
      </div>
    `;
  }).join('');
}

// ─────────────────────────────────────────────
// 6. Toast automatico scadenze (chiamato all'avvio dashboard)
// ─────────────────────────────────────────────
async function alertScadenze() {
  const kpi = await calcolaKPIscadenze();
  if (kpi.scaduti > 0) {
    showToast(`⚠️ ${kpi.scaduti} documento/i SCADUTO/I — verifica subito!`, 'error');
  } else if (kpi.inScadenza > 0) {
    showToast(`⚠️ ${kpi.inScadenza} documento/i in scadenza entro 30 giorni.`, 'warning');
  }
}

// ─────────────────────────────────────────────
// RIMOSSO: il MutationObserver con appState.currentView
// che causava ReferenceError su ogni pagina.
// Le funzioni vengono chiamate direttamente
// dall'HTML della dashboard quando necessario.
// ─────────────────────────────────────────────
