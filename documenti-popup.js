// documenti-popup.js - Popup selezione documenti da collegare

async function apriPopupCollegamento(tipo, riferimentoId) {
  const existing = document.getElementById('popup-collega-doc');
  if (existing) existing.remove();

  const docs = await getDocumenti();

  const modal = document.createElement('div');
  modal.id        = 'popup-collega-doc';
  modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'popup-collega-title');

  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[88vh] flex flex-col overflow-hidden">

      <div class="p-4 border-b border-slate-200 flex justify-between items-center shrink-0">
        <h3 id="popup-collega-title" class="text-lg font-bold text-slate-800">
          🔗 Collega Documenti
        </h3>
        <button onclick="chiudiPopupCollegamento()"
                class="text-slate-400 hover:text-slate-800 text-2xl leading-none
                       focus:outline-none focus:ring-2 focus:ring-slate-400 rounded"
                aria-label="Chiudi popup">✕</button>
      </div>

      <div class="p-3 border-b border-slate-100 shrink-0">
        <input id="popup-doc-search"
               type="search"
               placeholder="🔍 Cerca per nome o tag (es. PSC, POS, sicurezza...)"
               class="w-full p-2.5 rounded-lg border border-slate-300 text-sm
                      focus:ring-2 focus:ring-blue-400 focus:outline-none"
               aria-label="Cerca documento da collegare" />
      </div>

      <div id="popup-doc-list"
           class="flex-1 overflow-auto p-3 space-y-2"
           role="list"
           aria-label="Lista documenti selezionabili">
        ${docs.length > 0
          ? docs.map(d => renderRigaDocumentoPopup(d)).join('')
          : '<p class="text-sm text-slate-400 text-center py-8">Nessun documento disponibile.<br>Carica prima un documento nella sezione Documenti.</p>'
        }
      </div>

      <div class="p-4 border-t border-slate-200 flex justify-end gap-3 shrink-0">
        <button onclick="chiudiPopupCollegamento()"
                class="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold
                       hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400">
          Annulla
        </button>
        <button onclick="confermaCollegamento('${tipo}', '${riferimentoId}')"
                class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold
                       hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
          ✅ Collega Selezionati
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => { if (e.target === modal) chiudiPopupCollegamento(); });
  modal.addEventListener('keydown', (e) => { if (e.key === 'Escape') chiudiPopupCollegamento(); });

  document.getElementById('popup-doc-search').addEventListener('input', (e) => {
    filtraPopupDocumenti(e.target.value);
  });
}

function chiudiPopupCollegamento() {
  document.getElementById('popup-collega-doc')?.remove();
}

function renderRigaDocumentoPopup(doc) {
  return `
    <label class="flex items-center justify-between p-3 bg-white border border-slate-200
                  rounded-xl cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition"
           role="listitem">
      <div class="flex items-center gap-3 min-w-0">
        <input type="checkbox"
               class="doc-select-checkbox w-4 h-4 rounded accent-blue-600"
               value="${doc.id}"
               aria-label="Seleziona ${doc.nome}" />
        ${renderAnteprimaIcona(doc)}
        <div class="min-w-0">
          <div class="font-semibold text-slate-800 text-sm truncate">${doc.nome}</div>
          <div class="text-xs text-slate-400">${(doc.tags || []).join(' · ') || 'Nessun tag'}</div>
        </div>
      </div>
      <button onclick="mostraPreviewDocumento('${doc.id}'); event.preventDefault(); event.stopPropagation();"
              class="shrink-0 ml-2 text-xs bg-slate-700 text-white px-2 py-1 rounded
                     hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
              aria-label="Anteprima ${doc.nome}">
        Anteprima
      </button>
    </label>
  `;
}

async function filtraPopupDocumenti(term) {
  const lower    = (term || '').toLowerCase();
  const docs     = await getDocumenti();
  const filtrati = lower
    ? docs.filter(d =>
        (d.nome || '').toLowerCase().includes(lower) ||
        (d.tags || []).some(t => t.toLowerCase().includes(lower))
      )
    : docs;

  const list = document.getElementById('popup-doc-list');
  if (!list) return;

  list.innerHTML = filtrati.length > 0
    ? filtrati.map(d => renderRigaDocumentoPopup(d)).join('')
    : `<p class="text-sm text-slate-400 text-center py-8">Nessun documento trovato per "<strong>${term}</strong>".</p>`;
}

async function confermaCollegamento(tipo, riferimentoId) {
  const checkboxes = document.querySelectorAll('.doc-select-checkbox:checked');

  if (checkboxes.length === 0) {
    showToast('Seleziona almeno un documento.', 'warning');
    return;
  }

  let count = 0;
  for (const cb of checkboxes) {
    try {
      await collegaDocumentoARiferimento(cb.value, tipo, riferimentoId);
      count++;
    } catch (_) {}
  }

  chiudiPopupCollegamento();

  // Aggiorna UI documento collegato
  const containerId = tipo === 'verbale'    ? 'documenti-verbale'
                    : tipo === 'nc'         ? 'documenti-nc'
                    : tipo === 'impresa'    ? 'documenti-impresa'
                    : tipo === 'lavoratore' ? 'documenti-lavoratore'
                    : null;

  if (containerId) {
    await renderDocumentiCollegati(containerId, tipo, riferimentoId);
  }

  showToast(`${count} documento/i collegato/i correttamente ✓`, 'success');
}
