// documenti-collegamento.js - Collegamento Documenti ↔ Verbali / NC / Imprese / Lavoratori

// ─────────────────────────────────────────────
// 1. Crea collegamento
// ─────────────────────────────────────────────
async function collegaDocumentoARiferimento(docId, tipo, riferimentoId) {
  const link = {
    id:             'link_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    docId,
    tipo,           // "verbale" | "nc" | "impresa" | "lavoratore"
    riferimentoId,
    createdAt:      new Date().toISOString()
  };
  await saveItem('doc_links', link);
  return link;
}

// ─────────────────────────────────────────────
// 2. Recupera documenti collegati a un riferimento
// ─────────────────────────────────────────────
async function getDocumentiCollegati(tipo, riferimentoId) {
  const allLinks = await getAll('doc_links');
  const links    = allLinks.filter(l => l.tipo === tipo && l.riferimentoId === riferimentoId);
  if (links.length === 0) return [];

  const docs = await getDocumenti();
  return links
    .map(l => docs.find(d => d.id === l.docId))
    .filter(Boolean);
}

// ─────────────────────────────────────────────
// 3. Rendering lista documenti collegati
// ─────────────────────────────────────────────
async function renderDocumentiCollegati(containerId, tipo, riferimentoId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const docs = await getDocumentiCollegati(tipo, riferimentoId);

  if (docs.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 italic">Nessun documento collegato.</p>`;
    return;
  }

  container.innerHTML = docs.map(d => `
    <div class="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 mb-2">
      <div class="flex items-center gap-3 min-w-0">
        ${renderAnteprimaIcona(d)}
        <div class="min-w-0">
          <div class="text-sm font-semibold text-slate-800 truncate">${d.nome}</div>
          <div class="text-xs text-slate-400">${(d.tags || []).join(' · ')}</div>
        </div>
      </div>
      <div class="flex gap-2 shrink-0 ml-2">
        <button onclick="mostraPreviewDocumento('${d.id}')"
                class="text-xs bg-slate-700 text-white px-2 py-1 rounded hover:bg-slate-900
                       focus:outline-none focus:ring-2 focus:ring-slate-400"
                aria-label="Anteprima ${d.nome}">
          Anteprima
        </button>
        <button onclick="scaricaDocumento('${d.id}')"
                class="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700
                       focus:outline-none focus:ring-2 focus:ring-blue-400"
                aria-label="Scarica ${d.nome}">
          Scarica
        </button>
      </div>
    </div>
  `).join('');
}

// ─────────────────────────────────────────────
// 4. Apri popup per collegare documenti
// ─────────────────────────────────────────────
function collegaDocumentoDaSelettore(tipo, riferimentoId) {
  apriPopupCollegamento(tipo, riferimentoId);
}
