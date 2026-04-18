// verbali-list.js - Lista e dettaglio verbali ANAS SafeHub

// ─────────────────────────────────────────────
// 1. Recupera verbali del cantiere corrente
// ─────────────────────────────────────────────
async function getVerbaliForCurrentProject() {
  if (!window.appState?.currentProject) return [];
  return await getByIndex('verbali', 'projectId', window.appState.currentProject);
}

// ─────────────────────────────────────────────
// 2. Rendering lista verbali (nella dashboard)
// ─────────────────────────────────────────────
async function renderVerbaliList(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const verbali = await getVerbaliForCurrentProject();

  if (!verbali || verbali.length === 0) {
    container.innerHTML = `
      <div class="text-center py-10 text-slate-400">
        <div class="text-4xl mb-2">📋</div>
        <p class="text-sm font-medium">Nessun verbale presente.</p>
        <p class="text-xs mt-1">Compila il form per aggiungere il primo verbale.</p>
      </div>`;
    return;
  }

  container.innerHTML = verbali
    .sort((a, b) => new Date(b.data || b.createdAt) - new Date(a.data || a.createdAt))
    .map(v => {
      const dataLabel = v.data
        ? new Date(v.data).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : new Date(v.createdAt).toLocaleDateString('it-IT');

      // ── Distingui per tipo ──
      const tipo = v.tipo || 'sopralluogo';
      const meta = {
        'sopralluogo':            { icon: '📋', label: 'Verbale di Sopralluogo',     color: 'bg-blue-50 border-blue-200' },
        'riunione-coordinamento': { icon: '📅', label: 'Riunione di Coordinamento',   color: 'bg-indigo-50 border-indigo-200' },
        'verifica-pos':           { icon: '✅', label: 'Verifica Idoneità POS',       color: 'bg-green-50 border-green-200' },
      };
      const info = meta[tipo] || meta['sopralluogo'];

      // Dettaglio specifico per tipo
      let dettaglio = '';
      if (tipo === 'sopralluogo') {
        dettaglio = `
          <div class="text-xs text-slate-500 mt-1">
            ${v.km ? `KM: ${escapeHtml(v.km)}` : ''}
            ${v.meteo ? ` · Meteo: ${escapeHtml(v.meteo)}` : ''}
          </div>
          <div class="text-xs text-slate-500">
            Imprese presenti: ${(v.impresePresenti || []).length}
          </div>
          ${v.oggetto ? `<div class="text-sm text-slate-600 mt-1 truncate">${escapeHtml(v.oggetto)}</div>` : ''}
        `;
      } else if (tipo === 'riunione-coordinamento') {
        const tipi = (v.tipoRiunione || []).join(', ');
        dettaglio = `
          <div class="text-xs text-slate-500 mt-1">${tipi ? 'Tipo: ' + escapeHtml(tipi) : ''}</div>
        `;
      } else if (tipo === 'verifica-pos') {
        const esitoMap = {
          'idoneo': '✅ Idoneo',
          'idoneo-con-integrazioni': '⚠️ Idoneo con integrazioni',
          'non-idoneo': '❌ Non Idoneo'
        };
        dettaglio = `
          <div class="text-xs text-slate-500 mt-1">
            ${v.nomeImpresa ? 'Impresa: ' + escapeHtml(v.nomeImpresa) : ''}
          </div>
          <div class="text-xs text-slate-700 mt-1 font-semibold">
            ${esitoMap[v.esito] || ''}
          </div>
        `;
      }

      // Bottoni — apriVerbale solo per sopralluogo (gli altri non hanno dettaglio)
      const btnApri = tipo === 'sopralluogo'
        ? `<button onclick="apriVerbale('${v.id}')"
                   class="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg
                          hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                   aria-label="Apri verbale del ${dataLabel}">
             Apri →
           </button>`
        : '';

      const btnEmail = tipo === 'sopralluogo'
        ? `<button onclick="inviaEmailVerbaleRapido('${v.id}')"
                   class="bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-lg
                          hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                   aria-label="Invia verbale via email">
             ✉️
           </button>`
        : '';

      return `
        <div class="p-4 rounded-xl shadow-sm border mb-3 ${info.color}"
             role="article"
             aria-label="${info.label} del ${dataLabel}">
          <div class="flex justify-between items-start gap-4">
            <div class="flex-1 min-w-0">
              <div class="font-bold text-slate-800">
                ${info.icon} ${info.label} · ${dataLabel}
              </div>
              ${dettaglio}
            </div>

            <div class="flex flex-wrap gap-2 shrink-0">
              ${btnEmail}
              ${btnApri}
            </div>
          </div>
        </div>
      `;
    }).join('');
}

// ─────────────────────────────────────────────
// 3. Apertura verbale → pagina dettaglio
// ─────────────────────────────────────────────
function apriVerbale(verbaleId) {
  sessionStorage.setItem('currentVerbaleId', verbaleId);
  window.location.href = 'verbale-dettaglio.html';
}

// Helper email rapido dalla lista — evita template literal complessi negli onclick
function inviaEmailVerbaleRapido(verbaleId) {
  if (typeof mostraPannelloEmail === 'function') {
    mostraPannelloEmail({ tipo: 'verbale', id: verbaleId });
  } else if (typeof inviaVerbaleEmail === 'function') {
    inviaVerbaleEmail(verbaleId);
  } else {
    showToast('Email non disponibile in questa pagina.', 'warning');
  }
}

// Helper salvataggio verbale — evita arrow functions negli onclick HTML
function apriSalvataggioVerbale(verbaleId) {
  if (typeof mostraPannelloSalvataggio === 'function') {
    mostraPannelloSalvataggio({
      titolo:  'Verbale',
      onPDF:   function() { if (typeof exportVerbalePDF  === 'function') exportVerbalePDF(verbaleId);  },
      onWord:  function() { if (typeof exportVerbaleWord === 'function') exportVerbaleWord(verbaleId); },
      onJSON:  function() { if (typeof exportVerbaleJSON === 'function') exportVerbaleJSON(verbaleId); },
      onEmail: function() { inviaEmailVerbaleRapido(verbaleId); }
    });
  } else if (typeof exportVerbalePDF === 'function') {
    exportVerbalePDF(verbaleId);
  }
}

// ─────────────────────────────────────────────
// 4. Rendering dettaglio verbale (verbale-dettaglio.html)
// ─────────────────────────────────────────────
async function renderDettaglioVerbale(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Ripristina appState dal sessionStorage
  const projectId   = sessionStorage.getItem('currentProjectId');
  const projectName = sessionStorage.getItem('currentProjectName');
  const verbaleId   = sessionStorage.getItem('currentVerbaleId');

  if (!verbaleId) {
    container.innerHTML = `<p class="text-red-600 font-semibold">⚠️ Errore: nessun verbale selezionato.</p>`;
    return;
  }

  // Ripristina appState per getVerbaliForCurrentProject
  window.appState = {
    currentProject: projectId || '',
    projectName:    projectName || ''
  };

  // Cerca il verbale in tutti i verbali (non solo per progetto, per sicurezza)
  let v = null;
  try {
    const tutti = await getAll('verbali');
    v = tutti.find(x => x.id === verbaleId);
  } catch (_) {}

  if (!v) {
    container.innerHTML = `<p class="text-red-600 font-semibold">⚠️ Verbale non trovato.</p>`;
    return;
  }

  const dataLabel = v.data
    ? new Date(v.data).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '–';

  container.innerHTML = `
    <div class="bg-white p-6 rounded-xl shadow border border-slate-200 space-y-4">

      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold text-slate-800">📋 Verbale del ${dataLabel}</h2>
        <span class="text-xs text-slate-400 font-mono">${v.id}</span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">

        <div class="bg-slate-50 p-3 rounded-lg">
          <div class="text-xs text-slate-400 mb-1 font-semibold uppercase tracking-wide">Progressiva</div>
          <div class="font-medium text-slate-800">${escapeHtml(v.km) || '–'}</div>
        </div>

        <div class="bg-slate-50 p-3 rounded-lg">
          <div class="text-xs text-slate-400 mb-1 font-semibold uppercase tracking-wide">Condizioni Meteo</div>
          <div class="font-medium text-slate-800">${escapeHtml(v.meteo) || '–'}</div>
        </div>

        <div class="bg-slate-50 p-3 rounded-lg sm:col-span-2">
          <div class="text-xs text-slate-400 mb-1 font-semibold uppercase tracking-wide">Oggetto</div>
          <div class="font-medium text-slate-800">${escapeHtml(v.oggetto) || '–'}</div>
        </div>

        <div class="bg-slate-50 p-3 rounded-lg sm:col-span-2">
          <div class="text-xs text-slate-400 mb-2 font-semibold uppercase tracking-wide">Imprese Presenti</div>
          ${(v.impresePresenti || []).length > 0
            ? `<ul class="list-disc ml-4 text-slate-700 space-y-0.5">
                ${v.impresePresenti.map(i => `<li>${escapeHtml(i)}</li>`).join('')}
               </ul>`
            : '<div class="text-slate-500 text-xs">Nessuna impresa registrata</div>'
          }
        </div>

        <div class="bg-slate-50 p-3 rounded-lg sm:col-span-2">
          <div class="text-xs text-slate-400 mb-1 font-semibold uppercase tracking-wide">Referenti / Preposti presenti</div>
          <div class="text-slate-700 whitespace-pre-wrap">${escapeHtml(v.referenti) || '–'}</div>
        </div>

        <div class="bg-slate-50 p-3 rounded-lg sm:col-span-2">
          <div class="text-xs text-slate-400 mb-1 font-semibold uppercase tracking-wide">Stato dei Luoghi</div>
          <div class="text-slate-700 whitespace-pre-wrap">${escapeHtml(v.statoLuoghi) || '–'}</div>
        </div>

        ${v.note ? `
        <div class="bg-yellow-50 border border-yellow-200 p-3 rounded-lg sm:col-span-2">
          <div class="text-xs text-yellow-700 mb-1 font-semibold uppercase tracking-wide">Note CSE</div>
          <div class="text-slate-700 whitespace-pre-wrap">${escapeHtml(v.note)}</div>
        </div>` : ''}

      </div>

      <div class="flex flex-wrap gap-3 pt-2">
        <button onclick="window.location.href='dashboard-cantiere.html'"
                class="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-semibold
                       hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400">
          ← Torna alla Dashboard
        </button>
        <button onclick="apriSalvataggioVerbale('${v.id}')"
                class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold
                       hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
          💾 Salva / Esporta
        </button>
        <button onclick="inviaEmailVerbaleRapido('${v.id}')"
                class="bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold
                       hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-400">
          ✉️ Invia Email
        </button>
      </div>

    </div>
  `;
}

// ─────────────────────────────────────────────
// 5. Note: il rendering del dettaglio verbale
//    è gestito dal DOMContentLoaded inline
//    in verbale-dettaglio.html
//    (dashboard-cantiere.html: renderVerbaliList
//    viene chiamato dal suo DOMContentLoaded)
// ─────────────────────────────────────────────
