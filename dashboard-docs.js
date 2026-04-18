// dashboard-docs.js - KPI documentali per Dashboard Cantiere ANAS SafeHub

// ─────────────────────────────────────────────
// 1. Documenti obbligatori per un cantiere ANAS
// ─────────────────────────────────────────────
const DOCUMENTI_OBBLIGATORI = [
  { tag: 'PSC',         nome: 'Piano di Sicurezza e Coordinamento (PSC)'    },
  { tag: 'POS',         nome: 'Piano Operativo di Sicurezza (POS)'          },
  { tag: 'DVR',         nome: 'Documento Valutazione Rischi (DVR)'          },
  { tag: 'segnaletica', nome: 'Piano Segnaletica Temporanea (D.I. 2019)'    }
];

// ─────────────────────────────────────────────
// 2. Calcola KPI documentali
// ─────────────────────────────────────────────
async function calcolaKPIDocumenti() {
  const docs  = await getDocumenti().catch(() => []);
  const links = await getAll('doc_links').catch(() => []);
  const nc    = await getNCList().catch(() => []);

  return {
    totali:          docs.length,
    collegatiVerbali: links.filter(l => l.tipo === 'verbale').length,
    collegatiNC:      links.filter(l => l.tipo === 'nc').length,
    ncAperte:         nc.filter(n => n.stato === 'aperta').length
  };
}

// ─────────────────────────────────────────────
// 3. Verifica documenti obbligatori presenti
// ─────────────────────────────────────────────
async function renderDocumentiObbligatori() {
  const container = document.getElementById('doc-obbligatori-list');
  if (!container) return;

  const docs = await getDocumenti().catch(() => []);

  container.innerHTML = DOCUMENTI_OBBLIGATORI.map(req => {
    const presente = docs.some(d => (d.tags || []).includes(req.tag));
    return `
      <div class="flex items-center justify-between p-3 rounded-lg border
                  ${presente ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'} mb-2">
        <div>
          <div class="font-semibold text-slate-800 text-sm">${req.nome}</div>
          <div class="text-xs text-slate-400">Tag: <code>${req.tag}</code></div>
        </div>
        <span class="text-xl" aria-label="${presente ? 'Presente' : 'Mancante'}">
          ${presente ? '✅' : '❌'}
        </span>
      </div>
    `;
  }).join('');
}

// ─────────────────────────────────────────────
// NOTA: Non usiamo MutationObserver né appState.currentView.
// Le funzioni vengono chiamate esplicitamente
// dall'HTML della dashboard.
// ─────────────────────────────────────────────
